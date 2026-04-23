import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrgsService {
  constructor(private prisma: PrismaService) {}

  async listForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    // MVP: 1 org per user (their own). Later we can add membership table.
    return this.prisma.organization.findMany({ where: { id: user.organizationId } });
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
}

