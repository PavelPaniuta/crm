import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      include: { amounts: true, participants: { include: { user: true } } },
    });

    const map = new Map<
      string,
      { userId: string; email: string; role: string; dealsCount: number; payoutUsdt: number }
    >();

    deals.forEach((d) => {
      // workerPayout = amountOut × workerPct / 100
      const dealAmountOut = d.amounts.reduce((s, a) => s + Number(a.amountOut), 0);
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
          payoutUsdt: prev.payoutUsdt + (dealAmountOut * p.pct) / 100,
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
