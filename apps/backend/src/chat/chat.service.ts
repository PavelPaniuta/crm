import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.CHAT_SECRET ?? 'biscrm-default-chat-secret-key!!';
  return Buffer.from(raw.padEnd(32, '!').slice(0, 32), 'utf8');
}

function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(data: string): string {
  try {
    const [ivHex, authTagHex, encHex] = data.split(':');
    const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
  } catch {
    return '[зашифровано]';
  }
}

const userSelect = { id: true, name: true, email: true, role: true, position: true };

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  /** All users in org (to start a conversation with) */
  async getOrgUsers(organizationId: string, currentUserId: string) {
    return this.prisma.user.findMany({
      where: { organizationId, id: { not: currentUserId } },
      select: userSelect,
      orderBy: { name: 'asc' },
    });
  }

  /** List of conversations (users you've exchanged DMs with) + last message + unread count */
  async getConversations(organizationId: string, userId: string) {
    // Find all users this person has chatted with
    const sent = await this.prisma.chatMessage.findMany({
      where: { organizationId, senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });
    const received = await this.prisma.chatMessage.findMany({
      where: { organizationId, receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const partnerIds = new Set([
      ...sent.map((m) => m.receiverId),
      ...received.map((m) => m.senderId),
    ]);

    const conversations = await Promise.all(
      [...partnerIds].map(async (otherId) => {
        const [lastMsg, readEntry] = await Promise.all([
          this.prisma.chatMessage.findFirst({
            where: {
              organizationId,
              OR: [
                { senderId: userId, receiverId: otherId },
                { senderId: otherId, receiverId: userId },
              ],
            },
            orderBy: { createdAt: 'desc' },
            include: { sender: { select: userSelect } },
          }),
          this.prisma.chatLastRead.findUnique({
            where: { userId_otherUserId: { userId, otherUserId: otherId } },
          }),
        ]);

        const unread = await this.prisma.chatMessage.count({
          where: {
            organizationId,
            senderId: otherId,
            receiverId: userId,
            ...(readEntry ? { createdAt: { gt: readEntry.lastReadAt } } : {}),
          },
        });

        const other = await this.prisma.user.findUnique({
          where: { id: otherId },
          select: userSelect,
        });

        return {
          user: other,
          lastMessage: lastMsg
            ? { ...lastMsg, body: decrypt(lastMsg.body) }
            : null,
          unread,
          lastAt: lastMsg?.createdAt ?? new Date(0),
        };
      }),
    );

    return conversations.sort((a, b) => (a.lastAt > b.lastAt ? -1 : a.lastAt < b.lastAt ? 1 : 0));
  }

  /** Messages between two users */
  async getMessages(organizationId: string, userId: string, otherId: string, limit = 50, before?: string) {
    const where: Record<string, unknown> = {
      organizationId,
      OR: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId },
      ],
    };
    if (before) (where as any).createdAt = { lt: new Date(before) };

    const rows = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { sender: { select: userSelect } },
    });

    return rows.reverse().map((m) => ({ ...m, body: decrypt(m.body) }));
  }

  /** Send DM */
  async sendMessage(organizationId: string, senderId: string, receiverId: string, text: string) {
    const encrypted = encrypt(text.trim());
    const msg = await this.prisma.chatMessage.create({
      data: { organizationId, senderId, receiverId, body: encrypted },
      include: { sender: { select: userSelect } },
    });
    return { ...msg, body: text.trim() };
  }

  /** Mark conversation as read */
  async markRead(userId: string, otherUserId: string) {
    await this.prisma.chatLastRead.upsert({
      where: { userId_otherUserId: { userId, otherUserId } },
      update: { lastReadAt: new Date() },
      create: { userId, otherUserId, lastReadAt: new Date() },
    });
    return { ok: true };
  }

  /** Total unread across all conversations */
  async unreadTotal(organizationId: string, userId: string) {
    const reads = await this.prisma.chatLastRead.findMany({ where: { userId } });
    const readMap = new Map(reads.map((r) => [r.otherUserId, r.lastReadAt]));

    const count = await this.prisma.chatMessage.count({
      where: {
        organizationId,
        receiverId: userId,
        OR: reads.length
          ? [
              { senderId: { notIn: [...readMap.keys()] } },
              ...reads.map((r) => ({
                senderId: r.otherUserId,
                createdAt: { gt: r.lastReadAt },
              })),
            ]
          : [{ receiverId: userId }],
      },
    });
    return { count };
  }
}
