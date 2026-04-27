import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getPayrollBaseForTemplateDeal, getEffectiveRates } from '../deals/deal-payout.util';

function toUsd(amount: number, currency: string, rates: Record<string, number>): number {
  if (!amount) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = rates[currency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

function getDealCurrency(
  tpl: { fields?: Array<{ key: string; type: string }> } | null | undefined,
  data: Record<string, unknown> | undefined,
): string {
  if (!tpl?.fields || !data) return 'USD';
  const cf = tpl.fields.find((f) => f.type === 'CURRENCY');
  if (!cf) return 'USD';
  return String(data[cf.key] ?? 'USD');
}

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

@Injectable()
export class SalaryService {
  constructor(private prisma: PrismaService) {}

  private async loadRates(): Promise<Record<string, number>> {
    const rows = await this.prisma.exchangeRate.findMany();
    const map: Record<string, number> = {};
    for (const r of rows) map[r.code] = Number(r.rateToUsd);
    return map;
  }

  /** Get salary overview for an org: all employees with accrued/paid/balance */
  async getOrgOverview(organizationId: string, period: string) {
    // period = "2026-04"
    const [year, month] = period.split('-').map(Number);
    const fromDate = new Date(Date.UTC(year, month - 1, 1));
    const toDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const [users, rates] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId },
        select: {
          id: true, email: true, name: true, role: true, position: true,
          salaryConfig: true,
          dealParticipants: {
            where: { deal: { dealDate: { gte: fromDate, lte: toDate } } },
            select: {
              pct: true,
              deal: {
                select: {
                  id: true, status: true, dealDate: true,
                  amounts: { select: { amountOut: true, currencyOut: true } },
                  dataRows: { select: { data: true } },
                  template: { select: DEAL_TEMPLATE_SELECT },
                },
              },
            },
          },
          salaryPayments: {
            where: { organizationId, period },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.loadRates(),
    ]);

    return users.map((u) => {
      // Deal earnings in USD
      let dealEarningsUsd = 0;
      for (const dp of u.dealParticipants) {
        const deal = dp.deal;
        const tpl = deal.template as any;
        const first = deal.dataRows[0]?.data as Record<string, unknown> | undefined;
        const currency = getDealCurrency(tpl, first);
        const { base } = getPayrollBaseForTemplateDeal(deal as any);
        if (base > 0) {
          const effectiveRates = getEffectiveRates(deal, rates);
          dealEarningsUsd += toUsd((base * dp.pct) / 100, currency, effectiveRates);
        }
      }

      // Base salary in USD
      const cfg = u.salaryConfig;
      const baseUsd = cfg ? toUsd(Number(cfg.baseAmount), cfg.currency, rates) : 0;

      // Total accrued = base + deal earnings
      const totalAccrued = Math.round((baseUsd + dealEarningsUsd) * 100) / 100;

      // Paid: sum of isPaid payments in USD
      const paidUsd = u.salaryPayments
        .filter((p) => p.isPaid)
        .reduce((s, p) => s + toUsd(Number(p.amount), p.currency, rates), 0);

      const balance = Math.round((totalAccrued - paidUsd) * 100) / 100;

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        position: u.position,
        salaryConfig: cfg ? {
          baseAmount: Number(cfg.baseAmount),
          currency: cfg.currency,
          payDay: cfg.payDay,
          note: cfg.note,
        } : null,
        dealEarningsUsd: Math.round(dealEarningsUsd * 100) / 100,
        baseUsd: Math.round(baseUsd * 100) / 100,
        totalAccrued,
        paidUsd: Math.round(paidUsd * 100) / 100,
        balance,
        payments: u.salaryPayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          currency: p.currency,
          amountUsd: Math.round(toUsd(Number(p.amount), p.currency, rates) * 100) / 100,
          type: p.type,
          note: p.note,
          isPaid: p.isPaid,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
        })),
      };
    });
  }

  /** Upsert salary config for a user */
  async upsertConfig(userId: string, dto: {
    baseAmount: number;
    currency: string;
    payDay: number;
    note?: string;
  }) {
    const data = {
      baseAmount: new Prisma.Decimal(String(dto.baseAmount)),
      currency: dto.currency,
      payDay: Math.min(31, Math.max(1, dto.payDay)),
      note: dto.note ?? null,
    };
    return this.prisma.employeeSalaryConfig.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  /** Create a payment record */
  async createPayment(dto: {
    userId: string;
    organizationId: string;
    amount: number;
    currency: string;
    period: string;
    type: string;
    note?: string;
    isPaid?: boolean;
  }) {
    return this.prisma.salaryPayment.create({
      data: {
        userId: dto.userId,
        organizationId: dto.organizationId,
        amount: new Prisma.Decimal(String(dto.amount)),
        currency: dto.currency,
        period: dto.period,
        type: (dto.type as any) ?? 'MANUAL',
        note: dto.note ?? null,
        isPaid: dto.isPaid ?? false,
        paidAt: dto.isPaid ? new Date() : null,
      },
    });
  }

  /** Mark payment as paid/unpaid */
  async setPaymentPaid(paymentId: string, isPaid: boolean) {
    const exists = await this.prisma.salaryPayment.findUnique({ where: { id: paymentId } });
    if (!exists) throw new NotFoundException('Payment not found');
    return this.prisma.salaryPayment.update({
      where: { id: paymentId },
      data: { isPaid, paidAt: isPaid ? new Date() : null },
    });
  }

  /** Update payment */
  async updatePayment(paymentId: string, dto: {
    amount?: number;
    currency?: string;
    note?: string;
    type?: string;
    isPaid?: boolean;
  }) {
    const exists = await this.prisma.salaryPayment.findUnique({ where: { id: paymentId } });
    if (!exists) throw new NotFoundException('Payment not found');
    return this.prisma.salaryPayment.update({
      where: { id: paymentId },
      data: {
        ...(dto.amount !== undefined && { amount: new Prisma.Decimal(String(dto.amount)) }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.type !== undefined && { type: dto.type as any }),
        ...(dto.isPaid !== undefined && {
          isPaid: dto.isPaid,
          paidAt: dto.isPaid ? new Date() : null,
        }),
      },
    });
  }

  /** Delete a payment record */
  async deletePayment(paymentId: string) {
    const exists = await this.prisma.salaryPayment.findUnique({ where: { id: paymentId } });
    if (!exists) throw new NotFoundException('Payment not found');
    return this.prisma.salaryPayment.delete({ where: { id: paymentId } });
  }
}
