import type { CSSProperties } from "react";

export type ClientFormState = {
  name: string;
  phone: string;
  note: string;
  statusId: string;
  bank: string;
  assistantName: string;
  callSummary: string;
  callStartedAt: string;
};

export function emptyClientForm(): ClientFormState {
  return {
    name: "",
    phone: "",
    note: "",
    statusId: "",
    bank: "",
    assistantName: "",
    callSummary: "",
    callStartedAt: "",
  };
}

/** Разбор текста из бота / мессенджера (строки «Клиент:», «Телефон:», …). */
export function parseClientLeadPaste(text: string): Partial<ClientFormState> {
  const norm = text.replace(/\r\n/g, "\n");
  const pickLine = (re: RegExp) => {
    const m = norm.match(re);
    return m ? m[1].replace(/\s+$/u, "").trim() : "";
  };
  const out: Partial<ClientFormState> = {};
  const assistant = pickLine(/[Аа]ссистент\s*[:：]\s*(.+)/im);
  if (assistant) out.assistantName = assistant;
  const bank = pickLine(/Банк\s*[:：]\s*(.+)/im);
  if (bank) out.bank = bank;
  const name = pickLine(/Клиент\s*[:：]\s*(.+)/im);
  if (name) out.name = name;
  const phone = pickLine(/Телефон\s*[:：]\s*(.+)/im);
  if (phone) out.phone = phone;
  const sumM = norm.match(/Summary\s*[:：]\s*([\s\S]+?)(?=\n\s*[⏰]|\n\s*Время\s+начала|$)/im);
  if (sumM) out.callSummary = sumM[1].trim();
  else {
    const one = pickLine(/Summary\s*[:：]\s*(.+)/im);
    if (one) out.callSummary = one;
  }
  const timeM = norm.match(/Время\s+начала\s+звонка\s*[:：]\s*(.+)/im);
  if (timeM) {
    const p = timeM[1].trim().match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*,\s*(\d{1,2}):(\d{2})/);
    if (p) {
      const [, d, mo, y, h, mi] = p;
      out.callStartedAt = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}`;
    }
  }
  return out;
}

export type ClientPipelineStatus = {
  id: string;
  slug: string;
  label: string;
  color?: string | null;
  sortOrder: number;
  isTerminal: boolean;
};

export type ClientListItem = {
  id: string;
  name: string;
  phone: string;
  note?: string | null;
  statusId?: string | null;
  status?: ClientPipelineStatus | null;
  bank?: string | null;
  assistantName?: string | null;
  callSummary?: string | null;
  callStartedAt?: string | null;
  customData?: Record<string, unknown>;
};

export type ClientKanbanColumn = {
  key: string;
  label: string;
  color: string | null | undefined;
  clients: ClientListItem[];
};

/** Колонки канбана: порядок статусов из настроек; «Без статуса» — в конце. */
export function buildClientKanbanColumns(
  clientsFiltered: ClientListItem[],
  clientStatuses: ClientPipelineStatus[],
  clientStatusFilter: string,
): ClientKanbanColumn[] {
  const sorted = [...clientStatuses].sort((a, b) => a.sortOrder - b.sortOrder);
  const statusIds = new Set(sorted.map((s) => s.id));
  const byKey = new Map<string, ClientListItem[]>();
  for (const c of clientsFiltered) {
    const raw = (c.status?.id ?? c.statusId) || "__none__";
    const key = raw === "__none__" || !statusIds.has(raw) ? "__none__" : raw;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(c);
  }
  if (clientStatusFilter !== "all") {
    const s = sorted.find((x) => x.id === clientStatusFilter);
    if (s) return [{ key: s.id, label: s.label, color: s.color, clients: byKey.get(s.id) ?? [] }];
    return [{ key: clientStatusFilter, label: "Клиенты", color: null, clients: clientsFiltered }];
  }
  const cols: ClientKanbanColumn[] = sorted.map((s) => ({
    key: s.id,
    label: s.label,
    color: s.color,
    clients: byKey.get(s.id) ?? [],
  }));
  const none = byKey.get("__none__") ?? [];
  if (none.length) cols.push({ key: "__none__", label: "Без статуса", color: null, clients: none });
  return cols;
}

export function clientFormSectionStyle(muted?: boolean): CSSProperties {
  return {
    border: "1px solid var(--border-light)",
    borderRadius: 12,
    padding: "16px 18px",
    background: muted ? "var(--bg-metric)" : "var(--bg-card)",
    display: "grid",
    gap: 14,
  };
}
