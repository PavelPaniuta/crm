import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DealStatus, OperationType } from '@prisma/client';

type AmountInput = {
  amountIn: number;
  currencyIn: string;
  amountOut: number;
  currencyOut: string;
  bank: string;
  operationType: OperationType;
  shopName?: string | null;
};

@Injectable()
export class DealsService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.deal.findMany({
      where: { organizationId },
      include: { client: true, amounts: true, participants: { include: { user: true } } },
      orderBy: { dealDate: 'desc' },
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

  create(
    organizationId: string,
    data: { title: string; clientId?: string | null; dealDate?: string; comment?: string | null },
  ) {
    return this.prisma.deal.create({
      data: {
        organizationId,
        title: data.title,
        clientId: data.clientId ?? null,
        dealDate: data.dealDate ? new Date(data.dealDate) : new Date(),
        comment: data.comment ?? null,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: {
      title?: string;
      status?: DealStatus;
      clientId?: string | null;
      dealDate?: string;
      comment?: string | null;
    },
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
        comment: data.comment === undefined ? undefined : data.comment,
      },
    });
  }

  async addAmount(organizationId: string, dealId: string, data: AmountInput) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, organizationId } });
    if (!deal) throw new NotFoundException();

    return this.prisma.dealAmount.create({
      data: {
        dealId,
        amountIn: data.amountIn,
        currencyIn: data.currencyIn,
        amountOut: data.amountOut,
        currencyOut: data.currencyOut,
        bank: data.bank,
        operationType: data.operationType,
        shopName: data.shopName ?? null,
      },
    });
  }

  async replaceAmounts(organizationId: string, dealId: string, amounts: AmountInput[]) {
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
