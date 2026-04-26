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

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getMessages(organizationId: string, limit = 50, before?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (before) where.createdAt = { lt: new Date(before) };

    const rows = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { sender: { select: { id: true, name: true, email: true } } },
    });

    return rows.reverse().map((m) => ({
      ...m,
      body: decrypt(m.body),
    }));
  }

  async sendMessage(organizationId: string, senderId: string, text: string) {
    const encrypted = encrypt(text.trim());
    const msg = await this.prisma.chatMessage.create({
      data: { organizationId, senderId, body: encrypted },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });
    return { ...msg, body: text.trim() };
  }

  async markRead(organizationId: string, userId: string) {
    await this.prisma.chatLastRead.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      update: { lastReadAt: new Date() },
      create: { userId, organizationId, lastReadAt: new Date() },
    });
    return { ok: true };
  }

  async unreadCount(organizationId: string, userId: string) {
    const read = await this.prisma.chatLastRead.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    const count = await this.prisma.chatMessage.count({
      where: {
        organizationId,
        senderId: { not: userId },
        ...(read ? { createdAt: { gt: read.lastReadAt } } : {}),
      },
    });
    return { count };
  }
}
