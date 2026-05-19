"use client";

import { useEffect, useMemo, useState } from "react";
import { ClientCreateModal } from "@/components/clients/ClientCreateModal";
import { ClientEditModal } from "@/components/clients/ClientEditModal";
import { ClientViewModal } from "@/components/clients/ClientViewModal";
import { ClientsKanbanBoard } from "@/components/clients/ClientsKanbanBoard";
import {
  buildClientKanbanColumns,
  type ClientFieldDef,
  type ClientListItem,
  type ClientPipelineStatus,
} from "@/lib/clients";

export type ClientsTabProps = {
  clients: ClientListItem[];
  loading: boolean;
  statuses: ClientPipelineStatus[];
  fieldDefs: ClientFieldDef[];
  searchQ: string;
  statusFilter: string;
  onSearchQChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onRefresh: () => void | Promise<void>;
  pendingCreateOpen?: boolean;
  onPendingCreateHandled?: () => void;
};

export function ClientsTab({
  clients,
  loading,
  statuses,
  fieldDefs,
  searchQ,
  statusFilter,
  onSearchQChange,
  onStatusFilterChange,
  onRefresh,
  pendingCreateOpen,
  onPendingCreateHandled,
}: ClientsTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [viewClient, setViewClient] = useState<ClientListItem | null>(null);
  const [editClient, setEditClient] = useState<ClientListItem | null>(null);

  const clientsFiltered = useMemo(() => {
    if (statusFilter === "all") return clients;
    return clients.filter((c) => (c.status?.id ?? c.statusId) === statusFilter);
  }, [clients, statusFilter]);

  const kanbanColumns = useMemo(
    () => buildClientKanbanColumns(clientsFiltered, statuses, statusFilter),
    [clientsFiltered, statuses, statusFilter],
  );

  useEffect(() => {
    if (pendingCreateOpen) {
      setCreateOpen(true);
      onPendingCreateHandled?.();
    }
  }, [pendingCreateOpen, onPendingCreateHandled]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="page-header" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div className="page-header-left" style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div className="page-header-title">Клиенты</div>
          <div className="page-header-sub">
            Колонки по статусам воронки (прокрутка вниз и вбок). Клик по карточке — детали и комментарии. Добавление — кнопкой или AI ассистент. Воронку — в «Настройки».
          </div>
        </div>
        <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setCreateOpen(true)}>
          + Добавить клиента
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span className="card-title">Список клиентов</span>
            <button type="button" className="btn btn-secondary" onClick={() => void onRefresh()}>
              Обновить список
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "12px 14px", background: "var(--bg-metric)", borderRadius: 10, border: "1px solid var(--border-light)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginRight: 4 }}>Фильтры</span>
            <input
              className="form-input"
              style={{ minWidth: 180, flex: "1 1 160px", maxWidth: 280 }}
              placeholder="Поиск по имени, телефону, банку…"
              value={searchQ}
              onChange={(e) => onSearchQChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onRefresh();
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => void onRefresh()}>
              Найти
            </button>
            <select
              className="form-input"
              style={{ minWidth: 200, maxWidth: 260 }}
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            >
              <option value="all">Все статусы</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="card-body" style={{ padding: "18px 16px 20px" }}>
          {loading ? (
            <div style={{ padding: 24, color: "var(--text-secondary)" }}>Загрузка...</div>
          ) : clientsFiltered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="22" height="22" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="empty-state-title">Нет клиентов</div>
              <div className="empty-state-desc">Измените фильтр или нажмите «Добавить клиента» / создайте карточку через AI ассистента</div>
            </div>
          ) : (
            <ClientsKanbanBoard columns={kanbanColumns} onSelectClient={setViewClient} />
          )}
        </div>
      </div>

      <ClientViewModal
        client={viewClient}
        fieldDefs={fieldDefs}
        onClose={() => setViewClient(null)}
        onEdit={(c) => setEditClient(c)}
        onDeleted={onRefresh}
      />
      <ClientCreateModal open={createOpen} fieldDefs={fieldDefs} statuses={statuses} onClose={() => setCreateOpen(false)} onCreated={onRefresh} />
      <ClientEditModal
        client={editClient}
        fieldDefs={fieldDefs}
        statuses={statuses}
        onClose={() => setEditClient(null)}
        onSaved={onRefresh}
      />
    </div>
  );
}
