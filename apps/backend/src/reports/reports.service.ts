import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPayrollBaseForTemplateDeal, getEffectiveRates } from '../deals/deal-payout.util';

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function toUsd(amount: number, currency: string, rates: Record<string, number>): number {
  if (!amount) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = rates[currency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async workersPayouts(organizationId: string, from?: string, to?: string) {
    const now = new Date();
    const fromDate = from
      ? new Date(from)
      : startOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const toDate = to ? new Date(to) : endOfDay(now);

    const [deals, ratesArr] = await Promise.all([
      this.prisma.deal.findMany({
        where: { organizationId, dealDate: { gte: fromDate, lte: toDate } },
        include: {
          amounts: true,
          dataRows: { select: { data: true } },
          template: {
            select: {
              incomeFieldKey: true,
              calcPreset: true,
              payrollPoolPct: true,
              calcGrossFieldKey: true,
              calcMediatorPctKey: true,
              calcAiPctKey: true,
              calcSteps: true,
              fields: { select: { key: true, type: true } },
            },
          },
          participants: { include: { user: true } },
        },
      }),
      this.prisma.exchangeRate.findMany(),
    ]);

    const rates: Record<string, number> = {};
    for (const r of ratesArr) rates[r.code] = Number(r.rateToUsd);

    const map = new Map<
      string,
      { userId: string; email: string; role: string; dealsCount: number; payoutUsdt: number }
    >();

    deals.forEach((d) => {
      const { base: dealBase } = getPayrollBaseForTemplateDeal(d as any);

      // Determine deal currency from CURRENCY-type template field
      const tpl = d.template as any;
      const first = d.dataRows[0]?.data as Record<string, unknown> | undefined;
      let dealCurrency = 'USD';
      if (tpl?.fields && first) {
        const cf = tpl.fields.find((f: any) => f.type === 'CURRENCY');
        if (cf) dealCurrency = String(first[cf.key] ?? 'USD');
      }

      d.participants.forEach((p) => {
        const key = p.userId;
        const prev = map.get(key) ?? {
          userId: p.userId,
          email: p.user.email,
          role: p.user.role,
          dealsCount: 0,
          payoutUsdt: 0,
        };
        const effectiveRates = getEffectiveRates(d, rates);
        const rawPayout = dealBase > 0 ? (dealBase * p.pct) / 100 : 0;
        map.set(key, {
          ...prev,
          dealsCount: prev.dealsCount + 1,
          payoutUsdt: prev.payoutUsdt + toUsd(rawPayout, dealCurrency, effectiveRates),
        });
      });
    });

    const rows = Array.from(map.values())
      .map((r) => ({ ...r, payoutUsdt: Math.round(r.payoutUsdt * 100) / 100 }))
      .sort((a, b) => b.payoutUsdt - a.payoutUsdt);

    return {
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      rows,
    };
  }
}
