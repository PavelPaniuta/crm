import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OfficeInfoService {
  constructor(private prisma: PrismaService) {}

  async ensureForOrganization(organizationId: string, name = 'Инфо') {
    const existing = await this.prisma.organizationInfoPartner.findUnique({
      where: { organizationId },
    });
    if (existing) return existing;
    return this.prisma.organizationInfoPartner.create({
      data: { organizationId, name: name.trim() || 'Инфо' },
    });
  }

  async getForOrganization(organizationId: string) {
    await this.ensureForOrganization(organizationId);
    const row = await this.prisma.organizationInfoPartner.findUnique({
      where: { organizationId },
    });
    if (!row) return null;
    return {
      ...row,
      defaultPct: row.defaultPct != null ? Number(row.defaultPct) : null,
    };
  }

  async update(
    organizationId: string,
    dto: { name?: string; defaultPct?: number | null },
  ) {
    await this.ensureForOrganization(organizationId, dto.name ?? 'Инфо');
    return this.prisma.organizationInfoPartner.update({
      where: { organizationId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() || 'Инфо' }),
        ...(dto.defaultPct !== undefined && {
          defaultPct:
            dto.defaultPct == null ? null : new Prisma.Decimal(String(dto.defaultPct)),
        }),
      },
    }).then((row) => ({
      ...row,
      defaultPct: row.defaultPct != null ? Number(row.defaultPct) : null,
    }));
  }
}
