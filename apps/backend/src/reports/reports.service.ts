import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPayrollBaseForTemplateDeal } from '../deals/deal-payout.util';

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
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

    const deals = await this.prisma.deal.findMany({
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
          },
        },
        participants: { include: { user: true } },
      },
    });

    const map = new Map<
      string,
      { userId: string; email: string; role: string; dealsCount: number; payoutUsdt: number }
    >();

    deals.forEach((d) => {
      const { base: dealBase } = getPayrollBaseForTemplateDeal(d as any);
      d.participants.forEach((p) => {
        const key = p.userId;
        const prev = map.get(key) ?? {
          userId: p.userId,
          email: p.user.email,
          role: p.user.role,
          dealsCount: 0,
          payoutUsdt: 0,
        };
        map.set(key, {
          ...prev,
          dealsCount: prev.dealsCount + 1,
          payoutUsdt: prev.payoutUsdt + (dealBase * p.pct) / 100,
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
