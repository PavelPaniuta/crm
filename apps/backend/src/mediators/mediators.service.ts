import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  breakdownToUsd,
  getDealPayoutBreakdown,
  getEffectiveRates,
} from '../deals/deal-payout.util';

const DEAL_TEMPLATE_SELECT = {
  incomeFieldKey: true,
  calcPreset: true,
  payrollPoolPct: true,
  calcGrossFieldKey: true,
  calcMediatorPctKey: true,
  calcAiPctKey: true,
  calcSteps: true,
  fields: { select: { key: true, type: true } },
} as const;

function getDealCurrency(
  tpl: { fields?: Array<{ key: string; type: string }> } | null | undefined,
  data: Record<string, unknown> | undefined,
): string {
  if (!tpl?.fields || !data) return 'USD';
  const cf = tpl.fields.find((f) => f.type === 'CURRENCY');
  if (!cf) return 'USD';
  return String(data[cf.key] ?? 'USD');
}

function periodRange(period?: string, from?: string, to?: string) {
  if (from && to) {
    return { fromDate: new Date(from), toDate: new Date(to) };
  }
  const p = period ?? new Date().toISOString().slice(0, 7);
  const [year, month] = p.split('-').map(Number);
  const fromDate = new Date(Date.UTC(year, month - 1, 1));
  const toDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { fromDate, toDate };
}

@Injectable()
export class MediatorsService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string, activeOnly = true) {
    return this.prisma.mediator.findMany({
      where: { organizationId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    organizationId: string,
    dto: { name: string; phone?: string; note?: string; defaultPct?: number },
  ) {
    if (!dto.name?.trim()) throw new BadRequestException('Укажите имя посредника');
    return this.prisma.mediator.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        note: dto.note?.trim() || null,
        defaultPct:
          dto.defaultPct != null && Number.isFinite(dto.defaultPct)
            ? new Prisma.Decimal(String(dto.defaultPct))
            : null,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: { name?: string; phone?: string | null; note?: string | null; defaultPct?: number | null; isActive?: boolean },
  ) {
    const m = await this.prisma.mediator.findFirst({ where: { id, organizationId } });
    if (!m) throw new NotFoundException();
    return this.prisma.mediator.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.defaultPct !== undefined && {
          defaultPct:
            dto.defaultPct == null ? null : new Prisma.Decimal(String(dto.defaultPct)),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async delete(organizationId: string, id: string) {
    const m = await this.prisma.mediator.findFirst({ where: { id, organizationId } });
    if (!m) throw new NotFoundException();
    const links = await this.prisma.dealMediator.count({ where: { mediatorId: id } });
    if (links > 0) {
      return this.prisma.mediator.update({ where: { id }, data: { isActive: false } });
    }
    await this.prisma.mediator.delete({ where: { id } });
    return { ok: true };
  }

  /** Карточка посредника + сделки с % и суммой (пересчёт по шаблону за период). */
  async getDetail(
    organizationId: string,
    id: string,
    opts: { period?: string; from?: string; to?: string },
  ) {
    const mediator = await this.prisma.mediator.findFirst({ where: { id, organizationId } });
    if (!mediator) throw new NotFoundException();

    const { fromDate, toDate } = periodRange(opts.period, opts.from, opts.to);
    const ratesRows = await this.prisma.exchangeRate.findMany();
    const rates: Record<string, number> = {};
    for (const r of ratesRows) rates[r.code] = Number(r.rateToUsd);

    const links = await this.prisma.dealMediator.findMany({
      where: {
        mediatorId: id,
        deal: { organizationId, dealDate: { gte: fromDate, lte: toDate } },
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            dealDate: true,
            status: true,
            rateSnapshot: true,
            dataRows: { select: { data: true } },
            template: { select: DEAL_TEMPLATE_SELECT },
          },
        },
      },
      orderBy: { deal: { dealDate: 'desc' } },
    });

    let totalUsd = 0;
    const deals = links.map((link) => {
      const deal = link.deal;
      const first = deal.dataRows[0]?.data as Record<string, unknown> | undefined;
      const currency = getDealCurrency(deal.template as any, first);
      const effectiveRates = getEffectiveRates(deal, rates);
      const raw = getDealPayoutBreakdown(deal as any);
      const usd = breakdownToUsd(
        { ...raw, mediator: raw.mediator > 0 ? raw.mediator : Number(link.pct) ? (raw.gross * Number(link.pct)) / 100 : 0 },
        currency,
        effectiveRates,
      );
      const amountUsd = Math.round(usd.mediator * 100) / 100;
      totalUsd += amountUsd;
      return {
        dealId: deal.id,
        title: deal.title,
        dealDate: deal.dealDate,
        status: deal.status,
        pct: Number(link.pct),
        amountUsd,
        currency,
        amountInDealCurrency: Math.round(usd.mediator * (currency === 'USD' ? 1 : (rates[currency] ?? 1)) * 100) / 100,
      };
    });

    return {
      mediator: {
        ...mediator,
        defaultPct: mediator.defaultPct != null ? Number(mediator.defaultPct) : null,
      },
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      totalUsd: Math.round(totalUsd * 100) / 100,
      dealsCount: deals.length,
      deals,
    };
  }

  /** Сводка по всем посредникам офиса за период (для дашборда). */
  async getOrgSummary(organizationId: string, fromDate: Date, toDate: Date) {
    const ratesRows = await this.prisma.exchangeRate.findMany();
    const rates: Record<string, number> = {};
    for (const r of ratesRows) rates[r.code] = Number(r.rateToUsd);

    const links = await this.prisma.dealMediator.findMany({
      where: {
        deal: { organizationId, dealDate: { gte: fromDate, lte: toDate } },
      },
      include: {
        mediator: { select: { id: true, name: true, isActive: true } },
        deal: {
          select: {
            rateSnapshot: true,
            dataRows: { select: { data: true } },
            template: { select: DEAL_TEMPLATE_SELECT },
          },
        },
      },
    });

    const byMediator = new Map<string, { mediatorId: string; name: string; totalUsd: number; dealsCount: number }>();

    for (const link of links) {
      const deal = link.deal;
      const first = deal.dataRows[0]?.data as Record<string, unknown> | undefined;
      const currency = getDealCurrency(deal.template as any, first);
      const effectiveRates = getEffectiveRates(deal, rates);
      const raw = getDealPayoutBreakdown(deal as any);
      const mediatorAmt =
        raw.mediator > 0 ? raw.mediator : raw.gross > 0 ? (raw.gross * Number(link.pct)) / 100 : 0;
      const usd = breakdownToUsd({ ...raw, mediator: mediatorAmt }, currency, effectiveRates).mediator;

      const key = link.mediatorId;
      const prev = byMediator.get(key) ?? {
        mediatorId: key,
        name: link.mediator.name,
        totalUsd: 0,
        dealsCount: 0,
      };
      prev.totalUsd += usd;
      prev.dealsCount += 1;
      byMediator.set(key, prev);
    }

    const rows = Array.from(byMediator.values())
      .map((r) => ({ ...r, totalUsd: Math.round(r.totalUsd * 100) / 100 }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    const totalUsd = Math.round(rows.reduce((s, r) => s + r.totalUsd, 0) * 100) / 100;
    return { totalUsd, rows, dealsWithMediator: links.length };
  }
}
