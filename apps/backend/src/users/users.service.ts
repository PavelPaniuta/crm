import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  listPublic(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    organizationId: string,
    data: { email: string; password: string; role: Role },
  ) {
    if (!data.email?.trim()) throw new BadRequestException('login required');
    if (!data.password || data.password.length < 6)
      throw new BadRequestException('password too short');

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        organizationId,
        email: data.email.trim(),
        passwordHash,
        role: data.role ?? Role.MANAGER,
      },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
    });
  }

  async setRole(organizationId: string, userId: string, role: Role) {
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!existing) throw new NotFoundException();
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
    });
  }

  async resetPassword(organizationId: string, userId: string, password: string) {
    if (!password || password.length < 6) throw new BadRequestException('password too short');
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!existing) throw new NotFoundException();
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
    });
  }
}

