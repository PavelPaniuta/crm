"use client";

import type { WorkersReport } from "@/lib/reports";

type Props = {
  repFrom: string;
  repTo: string;
  onRepFromChange: (v: string) => void;
  onRepToChange: (v: string) => void;
  repLoading: boolean;
  repWorkers: WorkersReport | null;
  accountingExporting: boolean;
  showAccountingExport: boolean;
  onRefresh: () => void;
  onExportAccounting: () => void;
};

export function ReportsTab({
  repFrom,
  repTo,
  onRepFromChange,
  onRepToChange,
  repLoading,
  repWorkers,
  accountingExporting,
  showAccountingExport,
  onRefresh,
  onExportAccounting,
}: Props) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-title">Отчёты</div>
          <div className="page-header-sub">Аналитика выплат, Excel «Учет сделок» и статистика по воркерам</div>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={onRefresh}>
            ↻ Обновить
          </button>
          {showAccountingExport ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={accountingExporting}
              onClick={onExportAccounting}
            >
              {accountingExporting ? "Формируем…" : "Скачать Excel (учёт сделок)"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Период</span>
        </div>
        <div className="card-body g2">
          <div>
            <div className="form-label">От</div>
            <input
              className="form-input"
              type="date"
              value={repFrom}
              onChange={(e) => onRepFromChange(e.target.value)}
            />
          </div>
          <div>
            <div className="form-label">До</div>
            <input
              className="form-input"
              type="date"
              value={repTo}
              onChange={(e) => onRepToChange(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Выплаты воркерам</span>
        </div>
        <div className="card-body">
          {repLoading || !repWorkers ? (
            <div style={{ color: "var(--text-secondary)" }}>Загрузка...</div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Воркер</th>
                    <th>Роль</th>
                    <th>Сделок</th>
                    <th style={{ textAlign: "right" }}>Заработок</th>
                  </tr>
                </thead>
                <tbody>
                  {(repWorkers.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ color: "var(--text-secondary)" }}>
                        Нет данных за период
                      </td>
                    </tr>
                  ) : (
                    repWorkers.rows.map((r) => (
                      <tr key={r.userId}>
                        <td>{r.email}</td>
                        <td>{r.role}</td>
                        <td>{r.dealsCount}</td>
                        <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                          {Number(r.payoutUsdt ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
