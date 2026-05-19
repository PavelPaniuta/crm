import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class OfficeAiService {
  constructor(private prisma: PrismaService) {}

  /** Один AI-партнёр на офис; создаётся при первом обращении. */
  async ensureForOrganization(organizationId: string, name = 'AI') {
    const existing = await this.prisma.organizationAiPartner.findUnique({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
    if (existing) return existing;

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new Error('Organization not found');

    const email = `ai.${organizationId.slice(0, 12)}@biscrm.internal`;
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email,
        passwordHash,
        role: Role.AI_PARTNER,
        name: name.trim() || 'AI',
        position: 'AI партнёр офиса',
      },
    });

    return this.prisma.organizationAiPartner.create({
      data: {
        organizationId,
        userId: user.id,
        name: name.trim() || 'AI',
      },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
  }

  async getForOrganization(organizationId: string) {
    await this.ensureForOrganization(organizationId);
    return this.prisma.organizationAiPartner.findUnique({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
  }

  async updateName(organizationId: string, name: string) {
    const partner = await this.ensureForOrganization(organizationId, name);
    await this.prisma.user.update({
      where: { id: partner.userId },
      data: { name: name.trim() || 'AI' },
    });
    return this.prisma.organizationAiPartner.update({
      where: { organizationId },
      data: { name: name.trim() || 'AI' },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
  }
}
