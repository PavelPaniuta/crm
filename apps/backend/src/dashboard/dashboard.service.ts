import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPayrollBaseForTemplateDeal, CalcStep, computeChain, computeMediatorAiPayroll, MEDIATOR_AI_PAYROLL } from '../deals/deal-payout.util';

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

const TEMPLATE_SELECT = {
  incomeFieldKey: true,
  calcPreset: true,
  payrollPoolPct: true,
  calcGrossFieldKey: true,
  calcMediatorPctKey: true,
  calcAiPctKey: true,
  calcSteps: true,
} as const;

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(organizationId: string, from?: string, to?: string) {
    const now = new Date();
    const parsedFrom = from ? new Date(from) : null;
    const parsedTo = to ? new Date(to) : null;
    const fromDate =
      parsedFrom && !isNaN(parsedFrom.getTime())
        ? startOfDay(parsedFrom)
        : startOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const toDate =
      parsedTo && !isNaN(parsedTo.getTime()) ? endOfDay(parsedTo) : endOfDay(now);

    const deals = await this.prisma.deal.findMany({
      where: { organizationId, dealDate: { gte: fromDate, lte: toDate } },
      include: {
        amounts: true,
        dataRows: { select: { data: true } },
        template: { select: TEMPLATE_SELECT },
        participants: true,
      },
    });

    const dealsCount = deals.length;
    const dealsByStatus = deals.reduce(
      (acc, d) => {
        acc[d.status] = (acc[d.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    let totalAmountOut = 0;
    let totalOfficeIncome = 0;
    let totalWorkersPayoutUsdt = 0;

    deals.forEach((d) => {
      const tpl = d.template as any;
      const first = d.dataRows[0]?.data as Record<string, unknown> | undefined;

      if (d.amounts.length > 0) {
        // Classic deal: income = amountOut
        const dealOut = d.amounts.reduce((s, a) => s + Number(a.amountOut), 0);
        totalAmountOut += dealOut;
        // Office income = amountOut minus worker payouts for this deal
        const workerCut = d.participants.reduce((s, p) => s + (dealOut * p.pct) / 100, 0);
        totalOfficeIncome += dealOut - workerCut;
      } else if (tpl && first) {
        // Template deal: gross from incomeFieldKey or first chain step
        if (tpl.incomeFieldKey) {
          totalAmountOut += Number(first[tpl.incomeFieldKey]) || 0;
        } else if (Array.isArray(tpl.calcSteps) && tpl.calcSteps.length > 0) {
          const step0 = (tpl.calcSteps as CalcStep[])[0];
          if (step0?.sourceType === 'field') totalAmountOut += Number(first[step0.sourceId]) || 0;
        }

        // Office income: last chain step result (P)
        if (Array.isArray(tpl.calcSteps) && tpl.calcSteps.length > 0) {
          const chain = computeChain(first, tpl.calcSteps as CalcStep[]);
          if (chain.length > 0) totalOfficeIncome += Math.max(0, chain[chain.length - 1].result);
        } else if (tpl.calcPreset === MEDIATOR_AI_PAYROLL) {
          const c = computeMediatorAiPayroll(first, tpl);
          if (c) totalOfficeIncome += Math.max(0, c.P);
        } else if (tpl.incomeFieldKey) {
          // Simple template: income field minus worker cuts
          const gross = Number(first[tpl.incomeFieldKey]) || 0;
          const workerCut = d.participants.reduce((s, p) => s + (gross * p.pct) / 100, 0);
          totalOfficeIncome += gross - workerCut;
        }
      }

      // Worker payroll base
      const { base: payrollBase } = getPayrollBaseForTemplateDeal(d as any);
      d.participants.forEach((p) => {
        if (payrollBase > 0) totalWorkersPayoutUsdt += (payrollBase * p.pct) / 100;
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
        totalOfficeIncome: Math.round(totalOfficeIncome * 100) / 100,
        totalWorkersPayoutUsdt: Math.round(totalWorkersPayoutUsdt * 100) / 100,
      },
      expenses: {
        count: expensesCount,
        byStatus: expensesByStatus,
        totalAmount: Math.round(totalExpenses * 100) / 100,
      },
    };
  }

  async getGlobalSummary(from?: string, to?: string) {
    const now = new Date();
    const parsedFrom = from ? new Date(from) : null;
    const parsedTo = to ? new Date(to) : null;
    const fromDate =
      parsedFrom && !isNaN(parsedFrom.getTime())
        ? startOfDay(parsedFrom)
        : startOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const toDate =
      parsedTo && !isNaN(parsedTo.getTime()) ? endOfDay(parsedTo) : endOfDay(now);

    const orgs = await this.prisma.organization.findMany({ orderBy: { name: 'asc' } });

    const rows = await Promise.all(
      orgs.map(async (org) => {
        const deals = await this.prisma.deal.findMany({
          where: { organizationId: org.id, dealDate: { gte: fromDate, lte: toDate } },
          include: {
            amounts: true,
            dataRows: { select: { data: true } },
            template: { select: TEMPLATE_SELECT },
            participants: true,
          },
        });

        let totalAmountOut = 0;
        let totalOfficeIncome = 0;
        let totalWorkersPayoutUsdt = 0;

        deals.forEach((d) => {
          const tpl = d.template as any;
          const first = d.dataRows[0]?.data as Record<string, unknown> | undefined;

          if (d.amounts.length > 0) {
            const dealOut = d.amounts.reduce((s, a) => s + Number(a.amountOut), 0);
            totalAmountOut += dealOut;
            const workerCut = d.participants.reduce((s, p) => s + (dealOut * p.pct) / 100, 0);
            totalOfficeIncome += dealOut - workerCut;
          } else if (tpl && first) {
            if (tpl.incomeFieldKey) totalAmountOut += Number(first[tpl.incomeFieldKey]) || 0;
            else if (Array.isArray(tpl.calcSteps) && tpl.calcSteps.length > 0) {
              const step0 = (tpl.calcSteps as CalcStep[])[0];
              if (step0?.sourceType === 'field') totalAmountOut += Number(first[step0.sourceId]) || 0;
            }

            if (Array.isArray(tpl.calcSteps) && tpl.calcSteps.length > 0) {
              const chain = computeChain(first, tpl.calcSteps as CalcStep[]);
              if (chain.length > 0) totalOfficeIncome += Math.max(0, chain[chain.length - 1].result);
            } else if (tpl.calcPreset === MEDIATOR_AI_PAYROLL) {
              const c = computeMediatorAiPayroll(first, tpl);
              if (c) totalOfficeIncome += Math.max(0, c.P);
            } else if (tpl.incomeFieldKey) {
              const gross = Number(first[tpl.incomeFieldKey]) || 0;
              const workerCut = d.participants.reduce((s, p) => s + (gross * p.pct) / 100, 0);
              totalOfficeIncome += gross - workerCut;
            }
          }

          const { base: payrollBase } = getPayrollBaseForTemplateDeal(d as any);
          d.participants.forEach((p) => {
            if (payrollBase > 0) totalWorkersPayoutUsdt += (payrollBase * p.pct) / 100;
          });
        });

        const expenses = await this.prisma.expense.findMany({
          where: { organizationId: org.id, createdAt: { gte: fromDate, lte: toDate } },
        });
        const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

        return {
          orgId: org.id,
          orgName: org.name,
          dealsCount: deals.length,
          totalAmountOut: Math.round(totalAmountOut * 100) / 100,
          totalOfficeIncome: Math.round(totalOfficeIncome * 100) / 100,
          totalWorkersPayoutUsdt: Math.round(totalWorkersPayoutUsdt * 100) / 100,
          expensesCount: expenses.length,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
        };
      }),
    );

    const totals = rows.reduce(
      (acc, r) => ({
        dealsCount: acc.dealsCount + r.dealsCount,
        totalAmountOut: acc.totalAmountOut + r.totalAmountOut,
        totalOfficeIncome: acc.totalOfficeIncome + r.totalOfficeIncome,
        totalWorkersPayoutUsdt: acc.totalWorkersPayoutUsdt + r.totalWorkersPayoutUsdt,
        expensesCount: acc.expensesCount + r.expensesCount,
        totalExpenses: acc.totalExpenses + r.totalExpenses,
      }),
      { dealsCount: 0, totalAmountOut: 0, totalOfficeIncome: 0, totalWorkersPayoutUsdt: 0, expensesCount: 0, totalExpenses: 0 },
    );

    return {
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      byOrg: rows,
      totals: {
        dealsCount: totals.dealsCount,
        totalAmountOut: Math.round(totals.totalAmountOut * 100) / 100,
        totalOfficeIncome: Math.round(totals.totalOfficeIncome * 100) / 100,
        totalWorkersPayoutUsdt: Math.round(totals.totalWorkersPayoutUsdt * 100) / 100,
        expensesCount: totals.expensesCount,
        totalExpenses: Math.round(totals.totalExpenses * 100) / 100,
      },
    };
  }
}
