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

export type ClientFieldType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "DATE"
  | "PERCENT"
  | "CHECKBOX"
  | "CURRENCY";

export const CLIENT_FIELD_TYPE_LABELS: Record<ClientFieldType, string> = {
  TEXT: "Текст",
  NUMBER: "Число",
  SELECT: "Список",
  DATE: "Дата",
  PERCENT: "Процент",
  CHECKBOX: "Да / нет",
  CURRENCY: "Сумма",
};

export type ClientFieldDef = {
  id: string;
  key: string;
  label: string;
  type: ClientFieldType;
  required: boolean;
  order: number;
  options?: string | null;
};

export type ClientCommentEntry = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};

export async function fetchClients(searchQ?: string): Promise<ClientListItem[]> {
  const q = searchQ?.trim() ?? "";
  const url = q ? `/api/clients?q=${encodeURIComponent(q)}` : "/api/clients";
  const res = await fetch(url, { credentials: "include" });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("load_failed");
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

export function clientFormFromEntity(c: ClientListItem): ClientFormState {
  return {
    name: c.name,
    phone: c.phone,
    note: c.note ?? "",
    statusId: c.status?.id ?? c.statusId ?? "",
    bank: c.bank ?? "",
    assistantName: c.assistantName ?? "",
    callSummary: c.callSummary ?? "",
    callStartedAt: c.callStartedAt ? new Date(c.callStartedAt).toISOString().slice(0, 16) : "",
  };
}

export function customFieldsFromEntity(
  c: ClientListItem,
  fieldDefs: ClientFieldDef[],
): Record<string, string> {
  const cd = c.customData && typeof c.customData === "object" ? (c.customData as Record<string, unknown>) : {};
  const next: Record<string, string> = {};
  for (const def of fieldDefs) {
    next[def.key] = cd[def.key] != null ? String(cd[def.key]) : "";
  }
  return next;
}

function buildCustomPayload(
  fieldDefs: ClientFieldDef[],
  custom: Record<string, string>,
  mode: "create" | "edit",
): Record<string, string> | undefined {
  const customData: Record<string, string> = {};
  for (const def of fieldDefs) {
    const v = custom[def.key]?.trim() ?? "";
    if (mode === "create") {
      if (v) customData[def.key] = v;
    } else {
      customData[def.key] = v;
    }
  }
  if (mode === "create" && Object.keys(customData).length === 0) return undefined;
  return customData;
}

export async function createClientApi(
  form: ClientFormState,
  fieldDefs: ClientFieldDef[],
  custom: Record<string, string>,
): Promise<void> {
  const { name, phone, note, statusId, bank, assistantName, callSummary, callStartedAt } = form;
  const customData = buildCustomPayload(fieldDefs, custom, "create");
  const res = await fetch("/api/clients", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim() || undefined,
      statusId: statusId || undefined,
      bank: bank.trim() || null,
      assistantName: assistantName.trim() || null,
      callSummary: callSummary.trim() || null,
      callStartedAt: callStartedAt || null,
      customData,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message ?? "create_failed");
  }
}

export async function updateClientApi(
  id: string,
  form: ClientFormState,
  fieldDefs: ClientFieldDef[],
  custom: Record<string, string>,
): Promise<void> {
  const { name, phone, note, statusId, bank, assistantName, callSummary, callStartedAt } = form;
  const customData = buildCustomPayload(fieldDefs, custom, "edit") ?? {};
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim() || null,
      statusId: statusId || null,
      bank: bank.trim() || null,
      assistantName: assistantName.trim() || null,
      callSummary: callSummary.trim() || null,
      callStartedAt: callStartedAt || null,
      customData,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message ?? "update_failed");
  }
}

export async function deleteClientApi(id: string): Promise<void> {
  const res = await fetch(`/api/clients/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("delete_failed");
}

export async function fetchClientComments(clientId: string): Promise<ClientCommentEntry[]> {
  const res = await fetch(`/api/clients/${clientId}/comments`, { credentials: "include" });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

export async function postClientCommentApi(clientId: string, body: string): Promise<ClientCommentEntry> {
  const res = await fetch(`/api/clients/${clientId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message ?? "comment_failed");
  }
  return res.json() as Promise<ClientCommentEntry>;
}
