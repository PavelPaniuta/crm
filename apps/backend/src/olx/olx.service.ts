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
export class OlxService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string, activeOnly = true) {
    return this.prisma.olx.findMany({
      where: { organizationId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    organizationId: string,
    dto: { name: string; phone?: string; note?: string; defaultPct?: number },
  ) {
    if (!dto.name?.trim()) throw new BadRequestException('Укажите имя ОЛХ');
    return this.prisma.olx.create({
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
    dto: {
      name?: string;
      phone?: string | null;
      note?: string | null;
      defaultPct?: number | null;
      isActive?: boolean;
    },
  ) {
    const row = await this.prisma.olx.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException();
    return this.prisma.olx.update({
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
    const row = await this.prisma.olx.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException();
    const links = await this.prisma.dealOlx.count({ where: { olxId: id } });
    if (links > 0) {
      return this.prisma.olx.update({ where: { id }, data: { isActive: false } });
    }
    await this.prisma.olx.delete({ where: { id } });
    return { ok: true };
  }

  async getDetail(
    organizationId: string,
    id: string,
    opts: { period?: string; from?: string; to?: string },
  ) {
    const olx = await this.prisma.olx.findFirst({ where: { id, organizationId } });
    if (!olx) throw new NotFoundException();

    const { fromDate, toDate } = periodRange(opts.period, opts.from, opts.to);
    const ratesRows = await this.prisma.exchangeRate.findMany();
    const rates: Record<string, number> = {};
    for (const r of ratesRows) rates[r.code] = Number(r.rateToUsd);

    const links = await this.prisma.dealOlx.findMany({
      where: {
        olxId: id,
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
            mediatorLink: { select: { pct: true } },
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
      const raw = getDealPayoutBreakdown({
        ...deal,
        olxLink: { pct: link.pct },
      } as any);
      const usd = breakdownToUsd(raw, currency, effectiveRates);
      const amountUsd = Math.round(usd.olx * 100) / 100;
      totalUsd += amountUsd;
      return {
        dealId: deal.id,
        title: deal.title,
        dealDate: deal.dealDate,
        status: deal.status,
        pct: Number(link.pct),
        amountUsd,
        currency,
      };
    });

    return {
      olx: {
        ...olx,
        defaultPct: olx.defaultPct != null ? Number(olx.defaultPct) : null,
      },
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      totalUsd: Math.round(totalUsd * 100) / 100,
      dealsCount: deals.length,
      deals,
    };
  }

  async getOrgSummary(organizationId: string, fromDate: Date, toDate: Date) {
    const ratesRows = await this.prisma.exchangeRate.findMany();
    const rates: Record<string, number> = {};
    for (const r of ratesRows) rates[r.code] = Number(r.rateToUsd);

    const infoPartner = await this.prisma.organizationInfoPartner.findUnique({
      where: { organizationId },
    });
    const orgInfoPct =
      infoPartner?.defaultPct != null ? Number(infoPartner.defaultPct) : null;

    const links = await this.prisma.dealOlx.findMany({
      where: {
        deal: { organizationId, dealDate: { gte: fromDate, lte: toDate } },
      },
      include: {
        olx: { select: { id: true, name: true, isActive: true } },
        deal: {
          select: {
            rateSnapshot: true,
            dataRows: { select: { data: true } },
            template: { select: DEAL_TEMPLATE_SELECT },
            mediatorLink: { select: { pct: true } },
          },
        },
      },
    });

    const byOlx = new Map<
      string,
      { olxId: string; name: string; totalUsd: number; dealsCount: number }
    >();

    for (const link of links) {
      const deal = link.deal;
      const first = deal.dataRows[0]?.data as Record<string, unknown> | undefined;
      const currency = getDealCurrency(deal.template as any, first);
      const effectiveRates = getEffectiveRates(deal, rates);
      const raw = getDealPayoutBreakdown({
        ...deal,
        olxLink: { pct: link.pct },
        organizationInfoPct: orgInfoPct,
      } as any);
      const usd = breakdownToUsd(raw, currency, effectiveRates).olx;

      const key = link.olxId;
      const prev = byOlx.get(key) ?? {
        olxId: key,
        name: link.olx?.name ?? '—',
        totalUsd: 0,
        dealsCount: 0,
      };
      prev.totalUsd += usd;
      prev.dealsCount += 1;
      byOlx.set(key, prev);
    }

    const rows = Array.from(byOlx.values())
      .map((r) => ({ ...r, totalUsd: Math.round(r.totalUsd * 100) / 100 }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    const totalUsd = Math.round(rows.reduce((s, r) => s + r.totalUsd, 0) * 100) / 100;
    return { totalUsd, rows, dealsWithOlx: links.length };
  }
}
