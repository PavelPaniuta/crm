"use client";

import dynamic from "next/dynamic";
import type { ExpenseRow } from "@/lib/expenses";
import {
  buildDealsAreaChartData,
  type DashboardDealRow,
  type DashboardSnapshot,
} from "@/lib/dashboard";

const AreaChart = dynamic(() => import("@/components/charts/AreaChart"), { ssr: false });
const DonutChart = dynamic(() => import("@/components/charts/DonutChart"), { ssr: false });

type Props = {
  dash: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  dashFrom: string;
  dashTo: string;
  deals: DashboardDealRow[];
  dealsInPeriod: DashboardDealRow[];
  expenses: ExpenseRow[];
  onRetry: () => void;
  onNavigateToDeals: () => void;
  onNavigateToDealsNew: () => void;
  onNavigateToClientsNew: () => void;
  onNavigateToExpenses: () => void;
  onOpenDealEdit: (deal: DashboardDealRow) => void;
  onOpenMediator: (mediatorId: string) => void;
};

export function DashboardCurrentView({
  dash,
  loading,
  error,
  dashFrom,
  dashTo,
  deals,
  dealsInPeriod,
  expenses,
  onRetry,
  onNavigateToDeals,
  onNavigateToDealsNew,
  onNavigateToClientsNew,
  onNavigateToExpenses,
  onOpenDealEdit,
  onOpenMediator,
}: Props) {
  if (error) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Не удалось показать дашборд</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>{error}</div>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Повторить
        </button>
      </div>
    );
  }

  if (loading || !dash) {
    return (
      <div className="metric-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="metric-card" style={{ minHeight: 110, animation: "pulse 1.5s ease infinite" }}>
            <div style={{ height: 44, width: 44, borderRadius: 10, background: "var(--bg-metric)" }} />
            <div style={{ height: 20, borderRadius: 6, background: "var(--bg-metric)", marginTop: 8 }} />
          </div>
        ))}
      </div>
    );
  }

  const amountOut = dash.deals?.totalAmountOut ?? 0;
  const workersTotal = dash.deals?.totalWorkersPayoutUsdt ?? 0;
  const officeIncomeRaw = dash.deals?.totalOfficeIncome ?? 0;
  const officeIncome = officeIncomeRaw > 0 ? officeIncomeRaw : Math.max(0, amountOut - workersTotal);
  const expTotal = dash.expenses?.totalAmount ?? 0;
  const profit = officeIncome - expTotal;

  const metrics = [
    {
      label: "Сделки за период",
      value: String(dash.deals?.count ?? 0),
      sub: `Новых: ${dash.deals?.byStatus?.NEW ?? 0} · В работе: ${dash.deals?.byStatus?.IN_PROGRESS ?? 0}`,
      iconColor: "#6366F1",
      iconBg: "rgba(99,102,241,0.1)",
      trend: null as string | null,
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      ),
    },
    {
      label: "Завод (брутто)",
      value: amountOut.toLocaleString(),
      sub: `Офису: ${officeIncome.toLocaleString()} · Воркерам: ${workersTotal.toLocaleString()}`,
      iconColor: "#059669",
      iconBg: "rgba(5,150,105,0.1)",
      trend: amountOut > 0 ? "up" : "neutral",
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
          <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
          <polyline points="17,6 23,6 23,12" />
        </svg>
      ),
    },
    {
      label: "Расходы",
      value: expTotal.toLocaleString(),
      sub: `Записей: ${dash.expenses?.count ?? 0}`,
      iconColor: "#D97706",
      iconBg: "rgba(217,119,6,0.1)",
      trend: expTotal > 0 ? "down" : "neutral",
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      ),
    },
    {
      label: "Прибыль офиса",
      value: profit.toLocaleString(),
      sub: "Заработок офиса минус расходы",
      iconColor: profit >= 0 ? "#059669" : "#DC2626",
      iconBg: profit >= 0 ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
      trend: profit >= 0 ? "up" : "down",
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      label: "Посредники",
      value: `$${(dash.partners?.totalMediatorUsd ?? 0).toLocaleString()}`,
      sub: `Сделок с посредником: ${dash.partners?.dealsWithMediator ?? 0}`,
      iconColor: "#D97706",
      iconBg: "rgba(217,119,6,0.1)",
      trend: null,
      icon: <span style={{ fontSize: 18 }}>🤝</span>,
    },
    {
      label: "Доля ИИ (офис)",
      value: `$${(dash.partners?.totalAiUsd ?? 0).toLocaleString()}`,
      sub: "Начисляется на счёт ИИ в разделе «Зарплата»",
      iconColor: "#8B5CF6",
      iconBg: "rgba(139,92,246,0.12)",
      trend: null,
      icon: <span style={{ fontSize: 18 }}>🤖</span>,
    },
    {
      label: "ОЛХ",
      value: `$${(dash.partners?.totalOlxUsd ?? 0).toLocaleString()}`,
      sub: `Сделок с ОЛХ: ${dash.partners?.dealsWithOlx ?? 0}`,
      iconColor: "#0EA5E9",
      iconBg: "rgba(14,165,233,0.12)",
      trend: null,
      icon: <span style={{ fontSize: 18 }}>📋</span>,
    },
    {
      label: "Инфо",
      value: `$${(dash.partners?.totalInfoUsd ?? 0).toLocaleString()}`,
      sub: "% от зарплатного фонда",
      iconColor: "#64748B",
      iconBg: "rgba(100,116,139,0.12)",
      trend: null,
      icon: <span style={{ fontSize: 18 }}>ℹ️</span>,
    },
  ];

  const chartData = buildDealsAreaChartData(deals, dashFrom, dashTo);

  return (
    <>
      <div className="metric-grid">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card">
            <div className="metric-card-top">
              <div className="metric-icon" style={{ background: m.iconBg, color: m.iconColor }}>
                {m.icon}
              </div>
              {m.trend ? (
                <div className={`metric-trend ${m.trend}`}>
                  {m.trend === "up" ? (
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </div>
              ) : null}
            </div>
            <div className="metric-body">
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
              <div className="metric-sub">{m.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {(dash.partners?.mediators?.length ?? 0) > 0 ? (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", fontWeight: 600 }}>Посредники за период</div>
          {dash.partners!.mediators!.map((row) => (
            <div
              key={row.mediatorId}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 100px",
                padding: "10px 20px",
                gap: 8,
                borderTop: "1px solid var(--border-light)",
                fontSize: 13,
                cursor: "pointer",
              }}
              onClick={() => onOpenMediator(row.mediatorId)}
            >
              <span style={{ fontWeight: 500 }}>{row.name}</span>
              <span style={{ textAlign: "right", color: "var(--text-tertiary)" }}>{row.dealsCount}</span>
              <span style={{ textAlign: "right", fontWeight: 600, color: "#D97706" }}>${row.totalUsd.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Динамика сделок</div>
              <div className="chart-sub">по статусам за период</div>
            </div>
          </div>
          <div className="chart-body">
            <AreaChart data={chartData} title="Выход" height={230} color="#6366F1" />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Статусы сделок</div>
              <div className="chart-sub">распределение</div>
            </div>
          </div>
          <div className="chart-body">
            <DonutChart
              data={[
                { label: "Новые", value: dash.deals?.byStatus?.NEW ?? 0, color: "#6366F1" },
                { label: "В работе", value: dash.deals?.byStatus?.IN_PROGRESS ?? 0, color: "#D97706" },
                { label: "Закрыты", value: dash.deals?.byStatus?.CLOSED ?? 0, color: "#059669" },
              ].filter((d) => d.value > 0)}
              height={265}
              totalLabel="Сделок"
            />
          </div>
        </div>
      </div>

      <div className="dash-quick-actions g3" style={{ gap: 12 }}>
        {[
          {
            title: "Новая сделка",
            desc: "Создать сделку с клиентом",
            action: onNavigateToDealsNew,
            color: "#6366F1",
            bg: "rgba(99,102,241,0.1)",
            icon: (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            ),
          },
          {
            title: "Новый клиент",
            desc: "Добавить по номеру телефона",
            action: onNavigateToClientsNew,
            color: "#059669",
            bg: "rgba(5,150,105,0.1)",
            icon: (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            ),
          },
          {
            title: "Новый расход",
            desc: "Крипта, офис, материалы",
            action: onNavigateToExpenses,
            color: "#D97706",
            bg: "rgba(217,119,6,0.1)",
            icon: (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
            ),
          },
        ].map((a) => (
          <button
            key={a.title}
            type="button"
            onClick={a.action}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
              transition: "var(--transition)",
              textAlign: "left",
              fontFamily: "inherit",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 11, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", color: a.color, flexShrink: 0 }}>
              {a.icon}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>{a.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="dash-recent-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Последние сделки</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onNavigateToDeals} style={{ color: "var(--accent)" }}>
              Все →
            </button>
          </div>
          <div className="table-scroll" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Статус</th>
                  <th style={{ textAlign: "right" }}>Выход</th>
                </tr>
              </thead>
              <tbody>
                {dealsInPeriod.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "20px 18px", color: "var(--text-secondary)" }}>
                      Нет сделок за период
                    </td>
                  </tr>
                ) : (
                  dealsInPeriod.slice(0, 5).map((d) => {
                    const out = d.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
                    const statusLabel =
                      d.status === "NEW" ? "Новая" : d.status === "IN_PROGRESS" ? "В работе" : "Закрыта";
                    const badge =
                      d.status === "CLOSED" ? "badge-green" : d.status === "IN_PROGRESS" ? "badge-amber" : "badge-blue";
                    return (
                      <tr key={d.id} style={{ cursor: "pointer" }} onClick={() => onOpenDealEdit(d)}>
                        <td style={{ fontWeight: 500 }}>
                          {d.client ? d.client.name : <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Без клиента</span>}
                        </td>
                        <td>
                          <span className={`badge ${badge}`}>{statusLabel}</span>
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          {out > 0 ? out.toLocaleString() : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Последние расходы</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onNavigateToExpenses} style={{ color: "var(--accent)" }}>
              Все →
            </button>
          </div>
          <div className="table-scroll" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Статус</th>
                  <th style={{ textAlign: "right" }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "20px 18px", color: "var(--text-secondary)" }}>
                      Нет расходов
                    </td>
                  </tr>
                ) : (
                  expenses.slice(0, 5).map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 500 }}>{e.title}</td>
                      <td>
                        <span
                          className={`badge ${
                            e.status === "APPROVED"
                              ? "badge-green"
                              : e.status === "SUBMITTED"
                                ? "badge-blue"
                                : e.status === "REJECTED"
                                  ? "badge-red"
                                  : "badge-amber"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                        {Number(e.amount).toLocaleString()} {e.currency}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
