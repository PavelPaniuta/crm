import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  private async getStatsForOrg(organizationId: string) {
    const users = await this.prisma.user.findMany({
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
                id: true, status: true, dealDate: true,
                amounts: { select: { amountOut: true } },
                dataRows: { select: { data: true } },
                template: { select: { incomeFieldKey: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => {
      let totalPayout = 0;
      let dealsCount = 0;

      for (const dp of u.dealParticipants) {
        dealsCount++;
        const deal = dp.deal;

        // Classic deal: sum amountOut from DealAmount
        if (deal.amounts.length > 0) {
          const totalOut = deal.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
          totalPayout += (totalOut * dp.pct) / 100;
        }

        // Template deal: use incomeFieldKey
        if (deal.dataRows.length > 0 && deal.template?.incomeFieldKey) {
          const key = deal.template.incomeFieldKey;
          const rowSum = deal.dataRows.reduce((s, r) => {
            const val = (r.data as Record<string, unknown>)[key];
            return s + (Number(val) || 0);
          }, 0);
          totalPayout += (rowSum * dp.pct) / 100;
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
    const user = await this.prisma.user.findUnique({
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
                id: true, status: true, dealDate: true, title: true,
                amounts: { select: { amountOut: true } },
                dataRows: { select: { data: true } },
                template: { select: { incomeFieldKey: true, name: true } },
              },
            },
          },
          orderBy: { deal: { dealDate: 'desc' } },
          take: 20,
        },
      },
    });
    if (!user) return null;

    const deals = user.dealParticipants.map((dp) => {
      const deal = dp.deal;
      let payout = 0;
      if (deal.amounts.length > 0) {
        const totalOut = deal.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
        payout = (totalOut * dp.pct) / 100;
      }
      if (deal.dataRows.length > 0 && deal.template?.incomeFieldKey) {
        const key = deal.template.incomeFieldKey;
        const rowSum = deal.dataRows.reduce((s, r) => {
          const val = (r.data as Record<string, unknown>)[key];
          return s + (Number(val) || 0);
        }, 0);
        payout = (rowSum * dp.pct) / 100;
      }
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
