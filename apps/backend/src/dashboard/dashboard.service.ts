import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(organizationId: string, from?: string, to?: string) {
    const now = new Date();
    const fromDate = from
      ? new Date(from)
      : startOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const toDate = to ? new Date(to) : endOfDay(now);

    const deals = await this.prisma.deal.findMany({
      where: { organizationId, dealDate: { gte: fromDate, lte: toDate } },
      include: { amounts: true, participants: true },
    });

    const dealsCount = deals.length;
    const dealsByStatus = deals.reduce(
      (acc, d) => {
        acc[d.status] = (acc[d.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // totalAmountOut = sum of all amountOut across all deal rows
    let totalAmountOut = 0;
    deals.forEach((d) => {
      d.amounts.forEach((a) => {
        totalAmountOut += Number(a.amountOut);
      });
    });

    // workerPayout = amountOut × workerPct / 100
    let totalWorkersPayoutUsdt = 0;
    deals.forEach((d) => {
      const dealAmountOut = d.amounts.reduce((s, a) => s + Number(a.amountOut), 0);
      d.participants.forEach((p) => {
        totalWorkersPayoutUsdt += (dealAmountOut * p.pct) / 100;
      });
    });

    const expenses = await this.prisma.expense.findMany({
      where: { organizationId, createdAt: { gte: fromDate, lte: toDate } },
    });

    const expensesCount = expenses.length;
    const expensesByStatus = expenses.reduce(
      (acc, e) => {
        acc[e.status] = (acc[e.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

    return {
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      deals: {
        count: dealsCount,
        byStatus: dealsByStatus,
        totalAmountOut: Math.round(totalAmountOut * 100) / 100,
        totalWorkersPayoutUsdt: Math.round(totalWorkersPayoutUsdt * 100) / 100,
      },
      expenses: {
        count: expensesCount,
        byStatus: expensesByStatus,
        totalAmount: Math.round(totalExpenses * 100) / 100,
      },
    };
  }
}
