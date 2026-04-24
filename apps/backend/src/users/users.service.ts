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
      select: { id: true, email: true, role: true, position: true, organizationId: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  listPublic() {
    // Returns ALL users across ALL orgs so workers can be assigned to cross-org deals
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        position: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
      orderBy: [{ organizationId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(
    activeOrganizationId: string,
    data: { email: string; password: string; role: Role; position?: string | null; targetOrgId?: string | null },
    requesterRole?: string,
  ) {
    if (!data.email?.trim()) throw new BadRequestException('login required');
    if (!data.password || data.password.length < 6)
      throw new BadRequestException('password too short');

    // ADMIN can create user in any org via targetOrgId; MANAGER only in their own
    const orgId = (requesterRole === 'ADMIN' && data.targetOrgId) ? data.targetOrgId : activeOrganizationId;

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        organizationId: orgId,
        email: data.email.trim(),
        passwordHash,
        role: data.role ?? Role.MANAGER,
        position: data.position?.trim() || null,
      },
      select: { id: true, email: true, role: true, position: true, organizationId: true, createdAt: true, updatedAt: true },
    });
  }

  async setRole(organizationId: string, userId: string, role: Role, requesterRole?: string) {
    const where = requesterRole === 'ADMIN' ? { id: userId } : { id: userId, organizationId };
    const existing = await this.prisma.user.findFirst({ where });
    if (!existing) throw new NotFoundException();
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true, position: true, organizationId: true, createdAt: true, updatedAt: true },
    });
  }

  async resetPassword(organizationId: string, userId: string, password: string, requesterRole?: string) {
    if (!password || password.length < 6) throw new BadRequestException('password too short');
    const where = requesterRole === 'ADMIN' ? { id: userId } : { id: userId, organizationId };
    const existing = await this.prisma.user.findFirst({ where });
    if (!existing) throw new NotFoundException();
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true, email: true, role: true, position: true, organizationId: true, createdAt: true, updatedAt: true },
    });
  }

  async setPosition(organizationId: string, userId: string, position: string | null, requesterRole?: string) {
    const where = requesterRole === 'ADMIN' ? { id: userId } : { id: userId, organizationId };
    const existing = await this.prisma.user.findFirst({ where });
    if (!existing) throw new NotFoundException();
    return this.prisma.user.update({
      where: { id: userId },
      data: { position: position?.trim() || null },
      select: { id: true, email: true, role: true, position: true, organizationId: true, createdAt: true, updatedAt: true },
    });
  }
}

