import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string, q?: string) {
    return this.prisma.client.findMany({
      where: {
        organizationId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(organizationId: string, data: { name: string; phone: string; note?: string }) {
    return this.prisma.client.create({
      data: { organizationId, ...data },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: { name?: string; phone?: string; note?: string | null },
  ) {
    const existing = await this.prisma.client.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException();
    return this.prisma.client.update({ where: { id }, data });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.prisma.client.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }
}

