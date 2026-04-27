import { Injectable } from '@nestjs/common';
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

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  private async getStatsForOrg(organizationId: string) {
    const [users, ratesArr] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId },
        select: {
          id: true, email: true, name: true, role: true, position: true,
          phone: true, telegram: true, contacts: true,
          createdAt: true, organizationId: true,
          dealParticipants: {
            select: {
              pct: true,
              deal: {
                select: {
                  id: true, status: true, dealDate: true, rateSnapshot: true,
                  amounts: { select: { amountOut: true, currencyOut: true } },
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
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.exchangeRate.findMany(),
    ]);

    const rates: Record<string, number> = {};
    for (const r of ratesArr) rates[r.code] = Number(r.rateToUsd);

    return users.map((u) => {
      let totalPayout = 0;
      let dealsCount = 0;

      for (const dp of u.dealParticipants) {
        dealsCount++;
        const deal = dp.deal;
        const tpl = deal.template as any;
        const first = deal.dataRows[0]?.data as Record<string, unknown> | undefined;
        const currency = getDealCurrency(tpl, first);

        const { base } = getPayrollBaseForTemplateDeal(deal as Parameters<typeof getPayrollBaseForTemplateDeal>[0]);
        if (base > 0) {
          const effectiveRates = getEffectiveRates(deal, rates);
          totalPayout += toUsd((base * dp.pct) / 100, currency, effectiveRates);
        }
      }

      const { dealParticipants, ...rest } = u;
      return { ...rest, dealsCount, totalPayout: Math.round(totalPayout * 100) / 100 };
    });
  }

  async listForAdmin(organizationId: string) {
    // Include users who have extra membership in this org
    const extraMemberships = await this.prisma.userMembership.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const extraUserIds = extraMemberships.map(m => m.userId);
    const base = await this.getStatsForOrg(organizationId);
    const baseIds = new Set(base.map(u => u.id));

    // Add extra members who aren't primary members
    const extraUsers = extraUserIds.filter(id => !baseIds.has(id));
    if (extraUsers.length === 0) return base;

    // Get stats for extra members but mark their org
    const extraStats = await Promise.all(extraUsers.map(async (uid) => {
      const tmpOrg = await this.prisma.user.findUnique({ where: { id: uid }, select: { organizationId: true } });
      return this.getStatsForOrg(tmpOrg?.organizationId ?? organizationId).then(r => r.find(u => u.id === uid));
    }));
    return [...base, ...extraStats.filter(Boolean)] as typeof base;
  }

  async listAllGrouped() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const result: { org: { id: string; name: string }; members: Awaited<ReturnType<typeof this.getStatsForOrg>> }[] = [];
    for (const org of orgs) {
      const members = await this.getStatsForOrg(org.id);
      result.push({ org, members });
    }
    return result;
  }

  async getMember(userId: string) {
    const [user, ratesArr] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, name: true, role: true, position: true,
          phone: true, telegram: true, contacts: true, createdAt: true,
          organizationId: true,
          organization: { select: { name: true } },
          dealParticipants: {
            select: {
              pct: true,
              deal: {
                select: {
                  id: true, status: true, dealDate: true, title: true, rateSnapshot: true,
                  amounts: { select: { amountOut: true, currencyOut: true } },
                  dataRows: { select: { data: true } },
                  template: {
                    select: {
                      name: true,
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
                },
              },
            },
            orderBy: { deal: { dealDate: 'desc' } },
            take: 20,
          },
        },
      }),
      this.prisma.exchangeRate.findMany(),
    ]);
    if (!user) return null;

    const rates: Record<string, number> = {};
    for (const r of ratesArr) rates[r.code] = Number(r.rateToUsd);

    const deals = user.dealParticipants.map((dp) => {
      const deal = dp.deal;
      const tpl = deal.template as any;
      const first = deal.dataRows[0]?.data as Record<string, unknown> | undefined;
      const currency = getDealCurrency(tpl, first);

      const { base } = getPayrollBaseForTemplateDeal(deal as Parameters<typeof getPayrollBaseForTemplateDeal>[0]);
      const rawPayout = base > 0 ? (base * dp.pct) / 100 : 0;
      const effectiveRates = getEffectiveRates(deal, rates);
      const payout = toUsd(rawPayout, currency, effectiveRates);
      return {
        id: deal.id, title: deal.title, status: deal.status,
        dealDate: deal.dealDate, pct: dp.pct,
        payout: Math.round(payout * 100) / 100,
        templateName: deal.template?.name ?? null,
      };
    });

    const { dealParticipants, ...rest } = user;
    return {
      ...rest,
      dealsCount: deals.length,
      totalPayout: Math.round(deals.reduce((s, d) => s + d.payout, 0) * 100) / 100,
      recentDeals: deals,
    };
  }
}
