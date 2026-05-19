"use client";

import { DashboardCurrentView } from "@/components/dashboard/DashboardCurrentView";
import { DashboardGlobalView } from "@/components/dashboard/DashboardGlobalView";
import type { ExpenseRow } from "@/lib/expenses";
import { DASH_PERIOD_SHORTCUTS, type DashboardDealRow, type DashboardSnapshot, type GlobalDashboardSnapshot } from "@/lib/dashboard";

export type DashboardTabProps = {
  dashFrom: string;
  dashTo: string;
  onDashFromChange: (v: string) => void;
  onDashToChange: (v: string) => void;
  dashView: "current" | "global";
  onDashViewChange: (v: "current" | "global") => void;
  isSuperAdmin: boolean;
  dash: DashboardSnapshot | null;
  dashLoading: boolean;
  dashError: string | null;
  onRefreshDashboard: (from?: string, to?: string) => void;
  globalDash: GlobalDashboardSnapshot | null;
  globalDashLoading: boolean;
  onRefreshGlobalDash: (from?: string, to?: string) => void;
  deals: DashboardDealRow[];
  dealsInPeriod: DashboardDealRow[];
  expenses: ExpenseRow[];
  onNavigateToDeals: () => void;
  onNavigateToDealsNew: () => void;
  onNavigateToClientsNew: () => void;
  onNavigateToExpenses: () => void;
  onOpenDealEdit: (deal: DashboardDealRow) => void;
  onOpenMediator: (mediatorId: string) => void;
  onSwitchOrg: (orgId: string) => void;
};

export function DashboardTab({
  dashFrom,
  dashTo,
  onDashFromChange,
  onDashToChange,
  dashView,
  onDashViewChange,
  isSuperAdmin,
  dash,
  dashLoading,
  dashError,
  onRefreshDashboard,
  globalDash,
  globalDashLoading,
  onRefreshGlobalDash,
  deals,
  dealsInPeriod,
  expenses,
  onNavigateToDeals,
  onNavigateToDealsNew,
  onNavigateToClientsNew,
  onNavigateToExpenses,
  onOpenDealEdit,
  onOpenMediator,
  onSwitchOrg,
}: DashboardTabProps) {
  function refresh() {
    if (dashView === "global") onRefreshGlobalDash();
    else onRefreshDashboard();
  }

  function applyShortcut(getRange: () => { f: string; t: string }) {
    const { f, t } = getRange();
    onDashFromChange(f);
    onDashToChange(t);
    if (dashView === "global") onRefreshGlobalDash(f, t);
    else onRefreshDashboard(f, t);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="dash-period-bar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="dash-period-dates" style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, flexWrap: "wrap" }}>
          <input className="form-input" type="date" value={dashFrom} onChange={(e) => onDashFromChange(e.target.value)} style={{ maxWidth: 160 }} />
          <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>—</span>
          <input className="form-input" type="date" value={dashTo} onChange={(e) => onDashToChange(e.target.value)} style={{ maxWidth: 160 }} />
          <button type="button" className="btn btn-secondary" style={{ whiteSpace: "nowrap", flexShrink: 0 }} onClick={refresh}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Обновить
          </button>
          {DASH_PERIOD_SHORTCUTS.map((q) => (
            <button key={q.label} type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px", flexShrink: 0 }} onClick={() => applyShortcut(q.getRange)}>
              {q.label}
            </button>
          ))}
        </div>
        {isSuperAdmin ? (
          <div className="filter-tabs dash-view-tabs">
            {(
              [
                { id: "current" as const, label: "Текущий офис" },
                { id: "global" as const, label: "Все офисы" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                className={`filter-tab${dashView === v.id ? " active" : ""}`}
                onClick={() => {
                  onDashViewChange(v.id);
                  if (v.id === "global") onRefreshGlobalDash();
                  else onRefreshDashboard();
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {dashView === "current" ? (
        <DashboardCurrentView
          dash={dash}
          loading={dashLoading}
          error={dashError}
          dashFrom={dashFrom}
          dashTo={dashTo}
          deals={deals}
          dealsInPeriod={dealsInPeriod}
          expenses={expenses}
          onRetry={() => onRefreshDashboard()}
          onNavigateToDeals={onNavigateToDeals}
          onNavigateToDealsNew={onNavigateToDealsNew}
          onNavigateToClientsNew={onNavigateToClientsNew}
          onNavigateToExpenses={onNavigateToExpenses}
          onOpenDealEdit={onOpenDealEdit}
          onOpenMediator={onOpenMediator}
        />
      ) : (
        <DashboardGlobalView data={globalDash} loading={globalDashLoading} onSwitchOrg={onSwitchOrg} />
      )}
    </div>
  );
}
