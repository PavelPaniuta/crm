import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const isSuperAdmin = (role?: string) => role === 'SUPER_ADMIN';
const isAtLeastAdmin = (role?: string) => role === 'SUPER_ADMIN' || role === 'ADMIN';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true, name: true, role: true, position: true, organizationId: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  listPublic() {
    return this.prisma.user.findMany({
      select: {
        id: true, email: true, name: true, role: true, position: true,
        organizationId: true, organization: { select: { name: true } },
      },
      orderBy: [{ organizationId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Returns workers visible when creating deals for a given org:
   *  primary members of that org + users who have extra membership there */
  async listPublicForOrg(orgId: string, role: string) {
    if (role === 'SUPER_ADMIN') return this.listPublic();

    const [primary, extra] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId: orgId },
        select: { id: true, email: true, name: true, role: true, position: true,
          organizationId: true, organization: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.userMembership.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { id: true, email: true, name: true, role: true, position: true,
          organizationId: true, organization: { select: { name: true } } } } },
      }),
    ]);
    const seen = new Set(primary.map(u => u.id));
    const result = [...primary];
    for (const m of extra) {
      if (!seen.has(m.user.id)) { seen.add(m.user.id); result.push(m.user); }
    }
    return result;
  }

  async create(
    activeOrganizationId: string,
    data: { email: string; password: string; role: Role; name?: string | null; position?: string | null; targetOrgId?: string | null },
    requesterRole?: string,
  ) {
    if (!data.email?.trim()) throw new BadRequestException('login required');
    if (!data.password || data.password.length < 6)
      throw new BadRequestException('password too short');

    // SUPER_ADMIN can create in any org via targetOrgId
    // ADMIN can only create in their own org
    const orgId = (isSuperAdmin(requesterRole) && data.targetOrgId) ? data.targetOrgId : activeOrganizationId;

    // ADMIN cannot create SUPER_ADMIN
    if (!isSuperAdmin(requesterRole) && data.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Недостаточно прав для создания SUPER_ADMIN');
    }

    const duplicate = await this.prisma.user.findFirst({
      where: { organizationId: orgId, email: data.email.trim() },
    });
    if (duplicate) {
      throw new ConflictException(`Пользователь с логином «${data.email.trim()}» уже существует в этом офисе`);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        organizationId: orgId,
        email: data.email.trim(),
        passwordHash,
        role: data.role ?? Role.MANAGER,
        name: data.name?.trim() || null,
        position: data.position?.trim() || null,
      },
      select: { id: true, email: true, name: true, role: true, position: true, organizationId: true, createdAt: true, updatedAt: true },
    });
  }

  async setRole(organizationId: string, userId: string, role: Role, requesterRole?: string) {
    // ADMIN cannot elevate to SUPER_ADMIN
    if (!isSuperAdmin(requesterRole) && role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Недостаточно прав');
    }
    const where = isSuperAdmin(requesterRole) ? { id: userId } : { id: userId, organizationId };
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
    const where = isSuperAdmin(requesterRole) ? { id: userId } : { id: userId, organizationId };
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
    const where = isSuperAdmin(requesterRole) ? { id: userId } : { id: userId, organizationId };
    const existing = await this.prisma.user.findFirst({ where });
    if (!existing) throw new NotFoundException();
    return this.prisma.user.update({
      where: { id: userId },
      data: { position: position?.trim() || null },
      select: { id: true, email: true, role: true, position: true, organizationId: true, createdAt: true, updatedAt: true },
    });
  }

  async deleteUser(organizationId: string, userId: string, requesterId: string, requesterRole?: string) {
    if (userId === requesterId) throw new BadRequestException('Нельзя удалить себя');
    const where = isSuperAdmin(requesterRole) ? { id: userId } : { id: userId, organizationId };
    const existing = await this.prisma.user.findFirst({ where });
    if (!existing) throw new NotFoundException();
    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  }
}
