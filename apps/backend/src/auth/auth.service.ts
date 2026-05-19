import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(email: string, password: string, ip?: string, userAgent?: string) {
    const normalized = email?.trim().toLowerCase();
    const pwd = password?.trim() ?? '';
    if (!normalized || !pwd) throw new BadRequestException('Invalid credentials');

    // Same login can exist in multiple offices — check password against each match
    const candidates = await this.prisma.user.findMany({
      where: { email: { equals: normalized, mode: 'insensitive' } },
    });
    if (candidates.length === 0) throw new BadRequestException('Invalid credentials');

    let user: (typeof candidates)[number] | null = null;
    for (const u of candidates) {
      if (u.role === 'AI_PARTNER') continue;
      if (await bcrypt.compare(pwd, u.passwordHash)) {
        user = u;
        break;
      }
    }
    if (!user) throw new BadRequestException('Invalid credentials');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await this.prisma.session.create({
      data: {
        token,
        expiresAt,
        userId: user.id,
        activeOrganizationId: user.organizationId,
        ip,
        userAgent,
      },
    });

    return { token, expiresAt, user };
  }

  async logout(token: string) {
    await this.prisma.session.deleteMany({ where: { token } });
  }

  async switchOrganization(token: string, organizationId: string) {
    const s = await this.prisma.session.findUnique({ where: { token } });
    if (!s) throw new BadRequestException('Invalid session');
    await this.prisma.session.update({
      where: { id: s.id },
      data: { activeOrganizationId: organizationId },
    });
  }
}

