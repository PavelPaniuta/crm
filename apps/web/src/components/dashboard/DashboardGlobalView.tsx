"use client";

import dynamic from "next/dynamic";
import type { GlobalDashboardSnapshot } from "@/lib/dashboard";

const BarChart = dynamic(() => import("@/components/charts/BarChart"), { ssr: false });

type Props = {
  data: GlobalDashboardSnapshot | null;
  loading: boolean;
  onSwitchOrg: (orgId: string) => void;
};

export function DashboardGlobalView({ data, loading, onSwitchOrg }: Props) {
  if (loading || !data) {
    return <div className="card" style={{ padding: 24, color: "var(--text-secondary)" }}>Загрузка...</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="metric-grid">
        {[
          {
            label: "Сделок всего",
            value: String(data.totals?.dealsCount ?? 0),
            iconBg: "rgba(99,102,241,0.1)",
            iconColor: "#6366F1",
            icon: (
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            ),
          },
          {
            label: "Доход",
            value: (data.totals?.totalAmountOut ?? 0).toLocaleString(),
            iconBg: "rgba(5,150,105,0.1)",
            iconColor: "#059669",
            icon: (
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
                <polyline points="17,6 23,6 23,12" />
              </svg>
            ),
          },
          {
            label: "Воркерам",
            value: (data.totals?.totalWorkersPayoutUsdt ?? 0).toLocaleString(),
            iconBg: "rgba(99,102,241,0.1)",
            iconColor: "#6366F1",
            icon: (
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            ),
          },
          {
            label: "Расходы",
            value: (data.totals?.totalExpenses ?? 0).toLocaleString(),
            iconBg: "rgba(217,119,6,0.1)",
            iconColor: "#D97706",
            icon: (
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
            ),
          },
        ].map((c) => (
          <div key={c.label} className="metric-card">
            <div className="metric-card-top">
              <div className="metric-icon" style={{ background: c.iconBg, color: c.iconColor }}>
                {c.icon}
              </div>
            </div>
            <div className="metric-body">
              <div className="metric-value">{c.value}</div>
              <div className="metric-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Офис</th>
              <th style={{ textAlign: "right" }}>Сделок</th>
              <th style={{ textAlign: "right" }}>Доход</th>
              <th style={{ textAlign: "right" }}>Воркерам</th>
              <th style={{ textAlign: "right" }}>Расходы</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {(data.byOrg ?? []).map((r) => (
              <tr key={r.orgId}>
                <td style={{ fontWeight: 600 }}>{r.orgName}</td>
                <td style={{ textAlign: "right" }}>{r.dealsCount}</td>
                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--green)" }}>
                  {(r.totalAmountOut ?? 0).toLocaleString()}
                </td>
                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--accent)" }}>
                  {(r.totalWorkersPayoutUsdt ?? 0).toLocaleString()}
                </td>
                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--amber)" }}>
                  {(r.totalExpenses ?? 0).toLocaleString()}
                </td>
                <td>
                  <button type="button" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => onSwitchOrg(r.orgId)}>
                    Перейти
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(data.byOrg ?? []).length > 0 ? (
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title">Доход по офисам</div>
          </div>
          <div className="chart-body">
            <BarChart
              data={(data.byOrg ?? []).map((r) => ({ label: r.orgName, value: r.totalAmountOut ?? 0 }))}
              color="#6366F1"
              title="Доход"
              height={220}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
