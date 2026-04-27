import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DealStatus, OperationType } from '@prisma/client';

/** Load current exchange rates from DB as a plain map { code → rateToUsd } */
async function loadRateSnapshot(prisma: PrismaService): Promise<Record<string, number>> {
  const rows = await prisma.exchangeRate.findMany();
  const map: Record<string, number> = {};
  for (const r of rows) map[r.code] = Number(r.rateToUsd);
  return map;
}

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

  private readonly dealInclude = {
    client: true,
    amounts: true,
    dataRows: { orderBy: { order: 'asc' as const } },
    template: { include: { fields: { orderBy: { order: 'asc' as const } } } },
    participants: {
      include: {
        user: { select: { id: true, email: true, role: true, position: true, organizationId: true, organization: { select: { name: true } } } },
      },
    },
  };

  list(organizationId: string) {
    return this.prisma.deal.findMany({
      where: { organizationId },
      include: this.dealInclude,
      orderBy: { dealDate: 'desc' },
    });
  }

  async get(organizationId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId },
      include: this.dealInclude,
    });
    if (!deal) throw new NotFoundException();
    return deal;
  }

  async create(
    organizationId: string,
    data: {
      title: string;
      clientId?: string | null;
      dealDate?: string;
      status?: DealStatus;
      comment?: string | null;
      templateId?: string | null;
      dataRows?: Array<{ data: Record<string, unknown>; order?: number }>;
    },
  ) {
    const rateSnapshot = await loadRateSnapshot(this.prisma);
    return this.prisma.deal.create({
      data: {
        organizationId,
        title: data.title,
        clientId: data.clientId ?? null,
        dealDate: data.dealDate ? new Date(data.dealDate) : new Date(),
        status: data.status ?? 'NEW',
        comment: data.comment ?? null,
        templateId: data.templateId ?? null,
        rateSnapshot: Object.keys(rateSnapshot).length > 0 ? rateSnapshot : undefined,
        dataRows: data.dataRows
          ? { create: data.dataRows.map((r, i) => ({ data: r.data as object, order: r.order ?? i })) }
          : undefined,
      },
      include: this.dealInclude,
    });
  }

  async delete(organizationId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, organizationId } });
    if (!deal) throw new NotFoundException();
    await this.prisma.dealDataRow.deleteMany({ where: { dealId: id } });
    await this.prisma.dealAmount.deleteMany({ where: { dealId: id } });
    await this.prisma.dealParticipant.deleteMany({ where: { dealId: id } });
    await this.prisma.deal.delete({ where: { id } });
    return { ok: true };
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
      templateId?: string | null;
      dataRows?: Array<{ data: Record<string, unknown>; order?: number }>;
    },
  ) {
    const existing = await this.prisma.deal.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException();

    if (data.dataRows !== undefined) {
      await this.prisma.dealDataRow.deleteMany({ where: { dealId: id } });
      if (data.dataRows.length > 0) {
        await this.prisma.dealDataRow.createMany({
          data: data.dataRows.map((r, i) => ({ dealId: id, data: r.data as object, order: r.order ?? i })),
        });
      }
    }

    return this.prisma.deal.update({
      where: { id },
      data: {
        title: data.title,
        status: data.status,
        clientId: data.clientId === undefined ? undefined : data.clientId,
        dealDate: data.dealDate ? new Date(data.dealDate) : undefined,
        comment: data.comment === undefined ? undefined : data.comment,
        templateId: data.templateId === undefined ? undefined : data.templateId,
      },
      include: this.dealInclude,
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
