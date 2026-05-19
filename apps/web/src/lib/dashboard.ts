import { computeChain, type CalcStep } from "@/lib/deal-payout";

export type DashboardSnapshot = {
  deals?: {
    count?: number;
    totalAmountOut?: number;
    totalWorkersPayoutUsdt?: number;
    totalOfficeIncome?: number;
    byStatus?: { NEW?: number; IN_PROGRESS?: number; CLOSED?: number };
  };
  expenses?: { count?: number; totalAmount?: number };
  partners?: {
    totalMediatorUsd?: number;
    dealsWithMediator?: number;
    totalAiUsd?: number;
    totalOlxUsd?: number;
    dealsWithOlx?: number;
    totalInfoUsd?: number;
    mediators?: Array<{ mediatorId: string; name: string; dealsCount: number; totalUsd: number }>;
  };
};

export type GlobalDashboardSnapshot = {
  totals?: {
    dealsCount?: number;
    totalAmountOut?: number;
    totalWorkersPayoutUsdt?: number;
    totalExpenses?: number;
  };
  byOrg?: Array<{
    orgId: string;
    orgName: string;
    dealsCount: number;
    totalAmountOut?: number;
    totalWorkersPayoutUsdt?: number;
    totalExpenses?: number;
  }>;
};

export type DashboardDealRow = {
  id: string;
  status: string;
  dealDate?: string;
  client?: { id: string; name: string } | null;
  amounts: Array<{ amountOut?: string | number }>;
  template?: {
    incomeFieldKey?: string | null;
    calcGrossFieldKey?: string | null;
    calcSteps?: CalcStep[] | null;
  } | null;
  dataRows?: Array<{ data: Record<string, unknown> }>;
};

export async function fetchDashboard(from: string, to: string): Promise<DashboardSnapshot> {
  const res = await fetch(`/api/dashboard?from=${from}&to=${to}`, { credentials: "include" });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message ?? "load_failed");
  }
  return res.json();
}

export async function fetchGlobalDashboard(from: string, to: string): Promise<GlobalDashboardSnapshot> {
  const res = await fetch(`/api/dashboard/global?from=${from}&to=${to}`, { credentials: "include" });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("load_failed");
  return res.json();
}

export function filterDealsByPeriod<T extends { dealDate?: string }>(deals: T[], from: string, to: string): T[] {
  const fromTs = from ? new Date(from).getTime() : 0;
  const toTs = to ? new Date(to + "T23:59:59").getTime() : Infinity;
  return deals.filter((d) => {
    if (!d.dealDate) return false;
    const ts = new Date(d.dealDate).getTime();
    return ts >= fromTs && ts <= toTs;
  });
}

export function dealChartGrossValue(deal: DashboardDealRow): number {
  let value = deal.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
  if (value === 0 && deal.template && deal.dataRows && deal.dataRows.length > 0) {
    const rowData = deal.dataRows[0].data as Record<string, string>;
    const tpl = deal.template;
    if (Array.isArray(tpl.calcSteps) && tpl.calcSteps.length > 0) {
      const chain = computeChain(rowData, tpl.calcSteps);
      if (chain.length > 0) value = chain[0].source;
    } else if (tpl.incomeFieldKey) {
      value = Number(rowData[tpl.incomeFieldKey]) || 0;
    } else if (tpl.calcGrossFieldKey) {
      value = Number(rowData[tpl.calcGrossFieldKey]) || 0;
    }
  }
  return value;
}

export function buildDealsAreaChartData(
  deals: DashboardDealRow[],
  from: string,
  to: string,
): Array<{ label: string; value: number }> {
  const filtered = filterDealsByPeriod(deals, from, to);
  const byDay: Record<string, number> = {};
  for (const d of filtered) {
    const dt = d.dealDate ? new Date(d.dealDate) : null;
    if (!dt) continue;
    const key = dt.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] ?? 0) + dealChartGrossValue(d);
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, value]) => ({
      label: new Date(dateStr).toLocaleDateString("ru", { day: "numeric", month: "short" }),
      value: Math.round(value * 100) / 100,
    }));
}

export const DASH_PERIOD_SHORTCUTS = [
  {
    label: "Месяц",
    getRange: () => {
      const n = new Date();
      return {
        f: new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10),
        t: n.toISOString().slice(0, 10),
      };
    },
  },
  {
    label: "3 мес",
    getRange: () => {
      const n = new Date();
      return {
        f: new Date(n.getFullYear(), n.getMonth() - 2, 1).toISOString().slice(0, 10),
        t: n.toISOString().slice(0, 10),
      };
    },
  },
  {
    label: "Год",
    getRange: () => {
      const n = new Date();
      return {
        f: new Date(n.getFullYear(), 0, 1).toISOString().slice(0, 10),
        t: n.toISOString().slice(0, 10),
      };
    },
  },
  {
    label: "Всё",
    getRange: () => ({ f: "2020-01-01", t: new Date().toISOString().slice(0, 10) }),
  },
] as const;
