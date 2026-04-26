import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const USER_SELECT = {
  id: true, email: true, role: true, position: true,
  name: true, phone: true, telegram: true, contacts: true,
  organizationId: true, createdAt: true,
  organization: { select: { name: true } },
};

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!user) throw new NotFoundException();
    return user;
  }

  async updateProfile(
    userId: string,
    data: { name?: string | null; email?: string; phone?: string | null; telegram?: string | null; contacts?: string | null },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException();

    if (data.email && data.email.trim() !== existing.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: data.email.trim(), organizationId: existing.organizationId, NOT: { id: userId } },
      });
      if (conflict) throw new BadRequestException('Этот email уже занят');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name === undefined ? undefined : (data.name?.trim() || null),
        email: data.email?.trim() || undefined,
        phone: data.phone === undefined ? undefined : (data.phone?.trim() || null),
        telegram: data.telegram === undefined ? undefined : (data.telegram?.trim() || null),
        contacts: data.contacts === undefined ? undefined : (data.contacts?.trim() || null),
      },
      select: USER_SELECT,
    });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) throw new BadRequestException('Новый пароль слишком короткий (минимум 6 символов)');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Неверный текущий пароль');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }
}
