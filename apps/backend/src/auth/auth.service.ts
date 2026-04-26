import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(email: string, password: string, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email },
    });
    if (!user) throw new BadRequestException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new BadRequestException('Invalid credentials');

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

