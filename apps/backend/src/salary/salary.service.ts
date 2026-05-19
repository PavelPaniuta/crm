import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getPayrollBaseForTemplateDeal,
  getEffectiveRates,
  getDealPayoutBreakdown,
  breakdownToUsd,
} from '../deals/deal-payout.util';
import { OfficeAiService } from '../office-ai/office-ai.service';
import { Role } from '@prisma/client';
import {
  comparePeriods,
  isBaseSalaryAccruedForPeriod,
  listPeriodsInclusive,
  periodBounds,
  periodLte,
  salaryPeriodFromDate,
  type SalaryPeriod,
} from './salary-accrual.util';

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
  constructor(
    private prisma: PrismaService,
    private officeAi: OfficeAiService,
  ) {}

  private async loadRates(): Promise<Record<string, number>> {
    const rows = await this.prisma.exchangeRate.findMany();
    const map: Record<string, number> = {};
    for (const r of rows) map[r.code] = Number(r.rateToUsd);
    return map;
  }

  /** Get salary overview for an org: all employees with accrued/paid/balance */
  async getOrgOverview(organizationId: string, period: string) {
    const throughPeriod = period as SalaryPeriod;
    const { to: periodTo } = periodBounds(throughPeriod);
    const now = new Date();

    const [users, rates, aiPartnerRecord, orgDeals] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId, role: { not: Role.AI_PARTNER } },
        select: {
          id: true, email: true, name: true, role: true, position: true,
          salaryConfig: true,
          dealParticipants: {
            where: { deal: { dealDate: { lte: periodTo } } },
            select: {
              pct: true,
              deal: {
                select: {
                  id: true, status: true, dealDate: true, rateSnapshot: true,
                  amounts: { select: { amountOut: true, currencyOut: true } },
                  dataRows: { select: { data: true } },
                  template: { select: DEAL_TEMPLATE_SELECT },
                },
              },
            },
          },
          salaryPayments: {
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.loadRates(),
      this.officeAi.getForOrganization(organizationId).catch(() => null),
      this.prisma.deal.findMany({
        where: { organizationId, dealDate: { lte: periodTo } },
        select: {
          dealDate: true,
          rateSnapshot: true,
          amounts: { select: { amountOut: true, currencyOut: true } },
          dataRows: { select: { data: true } },
          template: { select: DEAL_TEMPLATE_SELECT },
        },
      }),
    ]);

    const aiDealByPeriod = new Map<SalaryPeriod, number>();
    for (const deal of orgDeals) {
      if (!deal.dealDate) continue;
      const dealPeriod = salaryPeriodFromDate(new Date(deal.dealDate));
      if (!periodLte(dealPeriod, throughPeriod)) continue;
      const tpl = deal.template as any;
      const first = deal.dataRows[0]?.data as Record<string, unknown> | undefined;
      const currency = getDealCurrency(tpl, first);
      const effectiveRates = getEffectiveRates(deal, rates);
      const split = breakdownToUsd(getDealPayoutBreakdown(deal as any), currency, effectiveRates);
      aiDealByPeriod.set(dealPeriod, (aiDealByPeriod.get(dealPeriod) ?? 0) + split.ai);
    }

    const employees = users.map((u) => {
      const cfg = u.salaryConfig;
      const baseUsd = cfg ? toUsd(Number(cfg.baseAmount), cfg.currency, rates) : 0;
      const configStart: SalaryPeriod = cfg
        ? salaryPeriodFromDate(cfg.createdAt)
        : throughPeriod;

      const dealEarningsByPeriod = new Map<SalaryPeriod, number>();
      for (const dp of u.dealParticipants) {
        const deal = dp.deal;
        if (!deal.dealDate) continue;
        const dealPeriod = salaryPeriodFromDate(new Date(deal.dealDate));
        if (!periodLte(dealPeriod, throughPeriod)) continue;
        if (comparePeriods(dealPeriod, configStart) < 0) continue;

        const tpl = deal.template as any;
        const first = deal.dataRows[0]?.data as Record<string, unknown> | undefined;
        const currency = getDealCurrency(tpl, first);
        const { base } = getPayrollBaseForTemplateDeal(deal as any);
        if (base <= 0) continue;
        const effectiveRates = getEffectiveRates(deal, rates);
        const usd = toUsd((base * dp.pct) / 100, currency, effectiveRates);
        dealEarningsByPeriod.set(
          dealPeriod,
          (dealEarningsByPeriod.get(dealPeriod) ?? 0) + usd,
        );
      }

      let cumulativeAccrued = 0;
      for (const p of listPeriodsInclusive(configStart, throughPeriod)) {
        const dealPart = dealEarningsByPeriod.get(p) ?? 0;
        const basePart =
          cfg && isBaseSalaryAccruedForPeriod(p, cfg.payDay, now) ? baseUsd : 0;
        cumulativeAccrued += dealPart + basePart;
      }

      let cumulativePaid = 0;
      let periodPaidUsd = 0;
      for (const p of u.salaryPayments) {
        if (!periodLte(p.period, throughPeriod)) continue;
        if (!p.isPaid) continue;
        const usd = toUsd(Number(p.amount), p.currency, rates);
        cumulativePaid += usd;
        if (p.period === throughPeriod) periodPaidUsd += usd;
      }

      const dealEarningsUsd = dealEarningsByPeriod.get(throughPeriod) ?? 0;
      const baseAccruedUsd =
        cfg && isBaseSalaryAccruedForPeriod(throughPeriod, cfg.payDay, now) ? baseUsd : 0;
      const totalAccrued = Math.round((dealEarningsUsd + baseAccruedUsd) * 100) / 100;
      const balance = Math.round((cumulativeAccrued - cumulativePaid) * 100) / 100;
      const periodPayments = u.salaryPayments.filter((p) => p.period === throughPeriod);

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
        baseAccruedUsd: Math.round(baseAccruedUsd * 100) / 100,
        baseAccrued: baseAccruedUsd > 0,
        totalAccrued,
        paidUsd: Math.round(periodPaidUsd * 100) / 100,
        balance,
        payments: periodPayments.map((p) => ({
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

    let aiPartner: {
      userId: string;
      name: string;
      dealEarningsUsd: number;
      baseUsd: number;
      totalAccrued: number;
      paidUsd: number;
      balance: number;
      salaryConfig: null;
      payments: Array<{
        id: string;
        amount: number;
        currency: string;
        amountUsd: number;
        type: string;
        note: string | null;
        isPaid: boolean;
        paidAt: Date | null;
        createdAt: Date;
      }>;
      isAiPartner: true;
    } | null = null;

    if (aiPartnerRecord?.user) {
      const aiPayments = await this.prisma.salaryPayment.findMany({
        where: { organizationId, userId: aiPartnerRecord.userId },
        orderBy: { createdAt: 'desc' },
      });
      const cfg = await this.prisma.employeeSalaryConfig.findUnique({
        where: { userId: aiPartnerRecord.userId },
      });
      const baseUsd = cfg ? toUsd(Number(cfg.baseAmount), cfg.currency, rates) : 0;
      const aiConfigStart = salaryPeriodFromDate(aiPartnerRecord.createdAt);

      let aiCumulativeAccrued = 0;
      for (const p of listPeriodsInclusive(aiConfigStart, throughPeriod)) {
        const dealPart = aiDealByPeriod.get(p) ?? 0;
        const basePart =
          cfg && isBaseSalaryAccruedForPeriod(p, cfg.payDay, now) ? baseUsd : 0;
        aiCumulativeAccrued += dealPart + basePart;
      }

      let aiCumulativePaid = 0;
      let aiPeriodPaidUsd = 0;
      for (const p of aiPayments) {
        if (!periodLte(p.period, throughPeriod)) continue;
        if (!p.isPaid) continue;
        const usd = toUsd(Number(p.amount), p.currency, rates);
        aiCumulativePaid += usd;
        if (p.period === throughPeriod) aiPeriodPaidUsd += usd;
      }

      const aiDealEarningsUsd = aiDealByPeriod.get(throughPeriod) ?? 0;
      const aiBaseAccruedUsd =
        cfg && isBaseSalaryAccruedForPeriod(throughPeriod, cfg.payDay, now) ? baseUsd : 0;
      const totalAccrued = Math.round((aiDealEarningsUsd + aiBaseAccruedUsd) * 100) / 100;
      const periodAiPayments = aiPayments.filter((p) => p.period === throughPeriod);

      aiPartner = {
        userId: aiPartnerRecord.userId,
        name: aiPartnerRecord.name,
        dealEarningsUsd: Math.round(aiDealEarningsUsd * 100) / 100,
        baseUsd: Math.round(baseUsd * 100) / 100,
        totalAccrued,
        paidUsd: Math.round(aiPeriodPaidUsd * 100) / 100,
        balance: Math.round((aiCumulativeAccrued - aiCumulativePaid) * 100) / 100,
        salaryConfig: null,
        payments: periodAiPayments.map((p) => ({
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
        isAiPartner: true,
      };
    }

    return { employees, aiPartner };
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
