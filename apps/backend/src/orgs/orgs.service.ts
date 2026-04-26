import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrgsService {
  constructor(private prisma: PrismaService) {}

  async listForUser(userId: string, role: string) {
    // SUPER_ADMIN sees ALL organizations
    if (role === 'SUPER_ADMIN') {
      return this.prisma.organization.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { users: true, deals: true } } },
      });
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    return this.prisma.organization.findMany({
      where: { id: user.organizationId },
      include: { _count: { select: { users: true, deals: true } } },
    });
  }

  async create(name: string) {
    if (!name?.trim()) throw new BadRequestException('Name is required');
    return this.prisma.organization.create({ data: { name: name.trim() } });
  }

  async assertOrgExists(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async deleteOrg(id: string, requesterId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    // Prevent deleting the org the requester belongs to (would log them out)
    const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
    if (requester?.organizationId === id) {
      throw new BadRequestException('Нельзя удалить свой текущий офис');
    }

    const total = await this.prisma.organization.count();
    if (total <= 1) throw new BadRequestException('Нельзя удалить последний офис');

    // Cascade deletes users, deals, clients, expenses via schema onDelete: Cascade
    await this.prisma.organization.delete({ where: { id } });
    return { ok: true };
  }
}
