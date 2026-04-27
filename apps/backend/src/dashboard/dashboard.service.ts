import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPayrollBaseForTemplateDeal, getEffectiveRates, CalcStep, computeChain, computeMediatorAiPayroll, MEDIATOR_AI_PAYROLL } from '../deals/deal-payout.util';

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/** Convert amount to USD using rateToUsd (1 USD = rate CURRENCY). */
function toUsd(amount: number, currency: string, rates: Record<string, number>): number {
  if (!amount) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = rates[currency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

const TEMPLATE_SELECT = {
  incomeFieldKey: true,
  calcPreset: true,
  payrollPoolPct: true,
  calcGrossFieldKey: true,
  calcMediatorPctKey: true,
  calcAiPctKey: true,
  calcSteps: true,
  fields: { select: { key: true, type: true } },
} as const;

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private async loadRates(): Promise<Record<string, number>> {
    const rows = await this.prisma.exchangeRate.findMany();
    const map: Record<string, number> = {};
    for (const r of rows) map[r.code] = Number(r.rateToUsd);
    return map;
  }

  private getDealCurrency(
    tpl: { fields?: Array<{ key: string; type: string }> } | null,
    data: Record<string, unknown> | undefined,
  ): string {
    if (!tpl?.fields || !data) return 'USD';
    const currencyField = tpl.fields.find((f) => f.type === 'CURRENCY');
    if (!currencyField) return 'USD';
    return String(data[currencyField.key] ?? 'USD');
  }

  private calcDealAmounts(
    d: {
      amounts: Array<{ amountOut: unknown; currencyOut: string }>;
      template: { fields?: Array<{ key: string; type: string }> } | null;
      dataRows: Array<{ data: unknown }>;
      participants: Array<{ pct: number }>;
      rateSnapshot?: unknown;
    },
    currentRates: Record<string, number>,
  ): { gross: number; officeIncome: number; payrollBase: number } {
    // Use historical rates from deal snapshot if available
    const rates = getEffectiveRates(d, currentRates);
    const tpl = d.template as any;
    const first = d.dataRows[0]?.data as Record<string, unknown> | undefined;

    if (d.amounts.length > 0) {
      // Classic deal: each DealAmount has its own currencyOut
      let gross = 0;
      for (const a of d.amounts) {
        gross += toUsd(Number(a.amountOut), a.currencyOut, rates);
      }
      const workerCut = d.participants.reduce((s, p) => s + (gross * p.pct) / 100, 0);
      return { gross, officeIncome: gross - workerCut, payrollBase: gross };
    }

    if (tpl && first) {
      const currency = this.getDealCurrency(tpl, first);

      if (Array.isArray(tpl.calcSteps) && tpl.calcSteps.length > 0) {
        const chain = computeChain(first, tpl.calcSteps as CalcStep[]);
        if (chain.length > 0) {
          const grossRaw = chain[0].source;
          const officeRaw = Math.max(0, chain[chain.length - 1].result);
          return {
            gross: toUsd(grossRaw, currency, rates),
            officeIncome: toUsd(officeRaw, currency, rates),
            payrollBase: 0, // handled separately via getPayrollBaseForTemplateDeal
          };
        }
      } else if (tpl.calcPreset === MEDIATOR_AI_PAYROLL) {
        const c = computeMediatorAiPayroll(first, tpl);
        if (c) {
          return {
            gross: toUsd(c.G, currency, rates),
            officeIncome: toUsd(Math.max(0, c.P), currency, rates),
            payrollBase: 0,
          };
        }
      } else if (tpl.incomeFieldKey) {
        const grossRaw = Number(first[tpl.incomeFieldKey]) || 0;
        const workerCut = d.participants.reduce((s, p) => s + (grossRaw * p.pct) / 100, 0);
        return {
          gross: toUsd(grossRaw, currency, rates),
          officeIncome: toUsd(grossRaw - workerCut, currency, rates),
          payrollBase: 0,
        };
      }
    }

    return { gross: 0, officeIncome: 0, payrollBase: 0 };
  }

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

    const [deals, rates] = await Promise.all([
      this.prisma.deal.findMany({
        where: { organizationId, dealDate: { gte: fromDate, lte: toDate } },
        include: {
          amounts: true,
          dataRows: { select: { data: true } },
          template: { select: TEMPLATE_SELECT },
          participants: true,
          // rateSnapshot is a scalar Json field — included automatically
        },
      }),
      this.loadRates(),
    ]);

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

    for (const d of deals) {
      const tpl = d.template as any;
      const first = d.dataRows[0]?.data as Record<string, unknown> | undefined;
      const currency = this.getDealCurrency(tpl, first);
      // Use deal's historical rate snapshot when available
      const effectiveRates = getEffectiveRates(d, rates);

      const { gross, officeIncome } = this.calcDealAmounts(d as any, rates);
      totalAmountOut += gross;
      totalOfficeIncome += officeIncome;

      // Worker payroll base in deal currency → USD (using historical rates)
      const { base: payrollBase } = getPayrollBaseForTemplateDeal(d as any);
      for (const p of d.participants) {
        if (payrollBase > 0) {
          totalWorkersPayoutUsdt += toUsd((payrollBase * p.pct) / 100, currency, effectiveRates);
        }
      }
    }

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
    const totalExpenses = expenses.reduce(
      (s, e) => s + toUsd(Number(e.amount), e.currency, rates),
      0,
    );

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

    const [orgs, rates] = await Promise.all([
      this.prisma.organization.findMany({ orderBy: { name: 'asc' } }),
      this.loadRates(),
    ]);

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

        for (const d of deals) {
          const tpl = d.template as any;
          const first = d.dataRows[0]?.data as Record<string, unknown> | undefined;
          const currency = this.getDealCurrency(tpl, first);
          const effectiveRates = getEffectiveRates(d, rates);

          const { gross, officeIncome } = this.calcDealAmounts(d as any, rates);
          totalAmountOut += gross;
          totalOfficeIncome += officeIncome;

          const { base: payrollBase } = getPayrollBaseForTemplateDeal(d as any);
          for (const p of d.participants) {
            if (payrollBase > 0) {
              totalWorkersPayoutUsdt += toUsd((payrollBase * p.pct) / 100, currency, effectiveRates);
            }
          }
        }

        const expenses = await this.prisma.expense.findMany({
          where: { organizationId: org.id, createdAt: { gte: fromDate, lte: toDate } },
        });
        const totalExpenses = expenses.reduce(
          (s, e) => s + toUsd(Number(e.amount), e.currency, rates),
          0,
        );

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
