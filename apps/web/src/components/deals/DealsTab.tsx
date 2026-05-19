"use client";

import { useRef } from "react";
import {
  DEAL_FILTER_TABS,
  DEAL_STATUS_LABELS,
  formatDealWorkerParts,
  getDealListOutput,
  type Deal,
  type DealStatus,
} from "@/lib/deals";

export type DealsTabProps = {
  isAdmin: boolean;
  isManager: boolean;
  deals: Deal[];
  loading: boolean;
  filter: "ALL" | DealStatus;
  onFilterChange: (f: "ALL" | DealStatus) => void;
  legacyImportYear: string;
  onLegacyImportYearChange: (y: string) => void;
  legacyImporting: boolean;
  onLegacyImport: (file: File) => void | Promise<void>;
  onOpenNew: () => void;
  onOpenEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  modal?: React.ReactNode;
};

export function DealsTab({
  isAdmin,
  isManager,
  deals,
  loading,
  filter: dealFilter,
  onFilterChange: setDealFilter,
  legacyImportYear,
  onLegacyImportYearChange: setLegacyImportYear,
  legacyImporting,
  onLegacyImport,
  onOpenNew: openDealModal,
  onOpenEdit: openDealEditModal,
  onDelete: deleteDeal,
  modal,
}: DealsTabProps) {
  const legacyImportInputRef = useRef<HTMLInputElement>(null);
  const filtered = deals.filter((d) => dealFilter === "ALL" || d.status === dealFilter);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-title">Сделки</div>
          <div className="page-header-sub">Управляйте сделками, участниками и выплатами</div>
        </div>
        <div className="page-header-actions">
          <div className="filter-tabs">
            {DEAL_FILTER_TABS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-tab ${dealFilter === f.id ? "active" : ""}`}
                onClick={() => setDealFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={openDealModal}>
            + Новая сделка
          </button>
          {isManager && (
            <>
              <input
                className="form-input"
                style={{ width: 72 }}
                title="Год для дат «23.04» (без года в ячейке)"
                value={legacyImportYear}
                onChange={(e) => setLegacyImportYear(e.target.value)}
              />
              <input
                ref={legacyImportInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onLegacyImport(f);
                  if (legacyImportInputRef.current) legacyImportInputRef.current.value = "";
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={legacyImporting}
                onClick={() => legacyImportInputRef.current?.click()}
              >
                {legacyImporting ? "Импорт…" : "Импорт Excel"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body table-scroll" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Клиент</th>
                <th>Воркеры</th>
                <th>Статус</th>
                <th style={{ textAlign: "right" }}>Выход</th>
                {isAdmin && <th style={{ width: 40 }} />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, color: "var(--text-secondary)" }}>
                    Загрузка...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <svg width="22" height="22" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 3" />
                        </svg>
                      </div>
                      <div className="empty-state-title">Нет сделок</div>
                      <div className="empty-state-desc">Создайте первую сделку чтобы начать вести учёт</div>
                      <button type="button" className="btn btn-primary" onClick={openDealModal}>
                        + Новая сделка
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const { totalOut, currencyLabel } = getDealListOutput(d);
                  const workerParts = formatDealWorkerParts(d);
                  return (
                    <tr key={d.id} style={{ cursor: "pointer" }}>
                      <td
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                        onClick={() => openDealEditModal(d)}
                      >
                        {d.dealDate ? new Date(d.dealDate).toLocaleDateString("ru-RU") : "—"}
                      </td>
                      <td onClick={() => openDealEditModal(d)}>
                        {d.client ? (
                          d.client.name
                        ) : (
                          <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Без клиента</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }} onClick={() => openDealEditModal(d)}>
                        {workerParts || "—"}
                      </td>
                      <td onClick={() => openDealEditModal(d)}>
                        <span
                          className={`badge ${
                            d.status === "CLOSED"
                              ? "badge-green"
                              : d.status === "IN_PROGRESS"
                                ? "badge-amber"
                                : "badge-blue"
                          }`}
                        >
                          {DEAL_STATUS_LABELS[d.status]}
                        </span>
                      </td>
                      <td
                        style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
                        onClick={() => openDealEditModal(d)}
                      >
                        {totalOut > 0
                          ? `${totalOut.toLocaleString("ru-RU")}${currencyLabel ? ` ${currencyLabel}` : ""}`
                          : "—"}
                      </td>
                      {isAdmin && (
                        <td style={{ width: 40, padding: "0 8px 0 0" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDeal(d.id);
                            }}
                            className="btn btn-ghost"
                            style={{ width: 28, height: 28, padding: 0, color: "var(--text-tertiary)" }}
                            title="Удалить сделку"
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                              <polyline points="3,6 5,6 21,6" />
                              <path d="M19,6l-1,14H6L5,6" />
                              <path d="M10,11v6M14,11v6" />
                              <path d="M9,6V4h6v2" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal}
    </div>
  );
}
