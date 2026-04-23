import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DealStatus } from '@prisma/client';

@Injectable()
export class DealsService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.deal.findMany({
      where: { organizationId },
      include: { client: true, amounts: true, participants: { include: { user: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(organizationId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId },
      include: { client: true, amounts: true, participants: { include: { user: true } } },
    });
    if (!deal) throw new NotFoundException();
    return deal;
  }

  create(organizationId: string, data: { title: string; clientId?: string | null; dealDate?: string }) {
    return this.prisma.deal.create({
      data: {
        organizationId,
        title: data.title,
        clientId: data.clientId ?? null,
        dealDate: data.dealDate ? new Date(data.dealDate) : new Date(),
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: { title?: string; status?: DealStatus; clientId?: string | null; dealDate?: string },
  ) {
    const existing = await this.prisma.deal.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException();
    return this.prisma.deal.update({
      where: { id },
      data: {
        title: data.title,
        status: data.status,
        clientId: data.clientId === undefined ? undefined : data.clientId,
        dealDate: data.dealDate ? new Date(data.dealDate) : undefined,
      },
    });
  }

  async addAmount(
    organizationId: string,
    dealId: string,
    data: {
      amount: number;
      currency: string;
      mediatorPct: number;
      rateToUsdt: number;
      branchPct: number;
      payoutUsdt?: number;
    },
  ) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, organizationId } });
    if (!deal) throw new NotFoundException();
    const comm = (data.amount * data.mediatorPct) / 100;
    const afterComm = data.amount - comm;
    const payoutUsdt = data.payoutUsdt ?? Math.round((afterComm / data.rateToUsdt) * 100) / 100;
    const branchShareUsdt = Math.round((payoutUsdt * data.branchPct) * 100) / 10000;

    return this.prisma.dealAmount.create({
      data: {
        dealId,
        amount: data.amount,
        currency: data.currency,
        mediatorPct: data.mediatorPct,
        rateToUsdt: data.rateToUsdt,
        payoutUsdt,
        branchPct: data.branchPct,
        branchShareUsdt,
      },
    });
  }

  async replaceAmounts(
    organizationId: string,
    dealId: string,
    amounts: Array<{
      amount: number;
      currency: string;
      mediatorPct: number;
      rateToUsdt: number;
      branchPct: number;
      payoutUsdt?: number;
    }>,
  ) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, organizationId } });
    if (!deal) throw new NotFoundException();
    await this.prisma.dealAmount.deleteMany({ where: { dealId } });
    for (const a of amounts) {
      await this.addAmount(organizationId, dealId, a);
    }
    return { ok: true };
  }

  async setParticipants(
    organizationId: string,
    dealId: string,
    parts: Array<{ userId: string; pct: number }>,
  ) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, organizationId } });
    if (!deal) throw new NotFoundException();
    const total = parts.reduce((s, p) => s + (p.pct || 0), 0);
    if (total !== 100) throw new BadRequestException('Participants pct must sum to 100');

    await this.prisma.dealParticipant.deleteMany({ where: { dealId } });
    await this.prisma.dealParticipant.createMany({
      data: parts.map((p) => ({ dealId, userId: p.userId, pct: p.pct })),
    });
    return { ok: true };
  }
}

