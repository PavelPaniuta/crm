import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  /** All extra-org memberships for a user */
  async getUserMemberships(userId: string) {
    return this.prisma.userMembership.findMany({
      where: { userId },
      include: { organization: { select: { id: true, name: true } } },
    });
  }

  /** Add a user to an additional org */
  async addMembership(actorRole: string, actorOrgId: string, userId: string, targetOrgId: string) {
    // Only SUPER_ADMIN can add to any org; ADMIN can only add to own org
    if (actorRole !== 'SUPER_ADMIN' && actorOrgId !== targetOrgId) {
      throw new BadRequestException('Access denied');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Don't duplicate the primary org
    if (user.organizationId === targetOrgId) {
      throw new BadRequestException('Это уже основной офис пользователя');
    }

    return this.prisma.userMembership.upsert({
      where: { userId_organizationId: { userId, organizationId: targetOrgId } },
      update: {},
      create: { userId, organizationId: targetOrgId },
    });
  }

  /** Remove a user from an additional org */
  async removeMembership(actorRole: string, actorOrgId: string, userId: string, orgId: string) {
    if (actorRole !== 'SUPER_ADMIN' && actorOrgId !== orgId) {
      throw new BadRequestException('Access denied');
    }
    await this.prisma.userMembership.deleteMany({
      where: { userId, organizationId: orgId },
    });
    return { ok: true };
  }

  /** Get all users visible in an org: primary members + membership members */
  async getOrgWorkers(orgId: string) {
    const [primary, extra] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, email: true, role: true, position: true,
          organizationId: true, organization: { select: { name: true } } },
      }),
      this.prisma.userMembership.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { id: true, name: true, email: true, role: true, position: true,
          organizationId: true, organization: { select: { name: true } } } } },
      }),
    ]);
    const seen = new Set<string>(primary.map(u => u.id));
    const result = [...primary];
    for (const m of extra) {
      if (!seen.has(m.user.id)) {
        seen.add(m.user.id);
        result.push(m.user);
      }
    }
    return result;
  }
}
