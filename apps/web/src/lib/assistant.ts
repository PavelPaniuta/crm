import type { ClientPipelineStatus } from "@/lib/clients";

export type AgentHistoryItem = {
  role: "user" | "assistant";
  content: string;
  pendingAction?: AgentPendingAction;
};

export type AgentPendingAction = {
  type: string;
  params: Record<string, unknown>;
  workersMap?: Record<string, string>;
};

export async function fetchAiConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/ai/status", { credentials: "include" });
    if (!res.ok) return false;
    const j = await res.json();
    return !!j.configured;
  } catch {
    return false;
  }
}

export async function sendAgentMessageApi(
  message: string,
  history: Array<{ role: string; content: string }>,
): Promise<
  | { ok: true; text: string; pendingAction?: AgentPendingAction }
  | { ok: false; status: number; errorText: string }
> {
  const res = await fetch("/api/ai/agent", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    return { ok: false, status: res.status, errorText: errText.slice(0, 200) };
  }
  const j = await res.json();
  const text = j.text || j.answer || j.message || j.error || "Нет ответа от AI";
  return { ok: true, text, pendingAction: j.pendingAction };
}

export async function executeAgentPendingAction(
  action: AgentPendingAction,
  clientStatuses: ClientPipelineStatus[],
): Promise<string> {
  if (action.type === "create_deal") {
    const p = action.params;
    const res = await fetch("/api/deals", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: p.title ?? "",
        dealDate: p.date,
        status: p.status ?? "NEW",
        comment: p.comment ?? "",
        templateId: p.templateId ?? null,
        dataRows: ((p.dataRows as unknown[]) ?? []).map((r, i) => ({ data: r, order: i })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return `❌ Ошибка создания сделки: ${(err as { message?: string }).message ?? res.status}`;
    }
    const deal = await res.json();
    const parts = ((p.participants as Array<{ userId: string; pct: number }>) ?? []).filter((x) => x.userId);
    if (parts.length > 0) {
      await fetch(`/api/deals/${deal.id}/participants`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: parts }),
      });
    }
    const amounts = ((p.amounts as Array<Record<string, unknown>>) ?? []).filter((a) => a.amountOut);
    if (amounts.length > 0) {
      await fetch(`/api/deals/${deal.id}/amounts`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amounts: amounts.map((a) => ({
            amountIn: a.amountIn ?? 0,
            currencyIn: a.currencyIn ?? "USD",
            amountOut: a.amountOut,
            currencyOut: a.currencyOut ?? "USD",
            bank: a.bank ?? "",
            operationType: a.operationType ?? "ATM",
          })),
        }),
      });
    }
    const wMap = action.workersMap ?? {};
    const partsText = parts.map((x) => `${wMap[x.userId] ?? x.userId} (${x.pct}%)`).join(" + ");
    return `✅ Сделка создана!\n${partsText ? `👥 ${partsText}` : ""}\nОткройте вкладку «Сделки» чтобы посмотреть.`;
  }

  if (action.type === "create_expense") {
    const p = action.params;
    const res = await fetch("/api/expenses", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: p.title || p.description || "Расход",
        amount: p.amount,
        currency: p.currency ?? "USD",
        payMethod: p.payMethod ?? "Наличные",
      }),
    });
    if (res.ok) return "✅ Расход записан!";
    const err = await res.json().catch(() => ({}));
    return `❌ Ошибка записи расхода: ${(err as { message?: string }).message ?? res.status}`;
  }

  if (action.type === "create_client") {
    const p = action.params;
    const slug = typeof p.statusSlug === "string" ? p.statusSlug.trim().toLowerCase() : "";
    const status = slug ? clientStatuses.find((x) => x.slug.toLowerCase() === slug) : undefined;
    const res = await fetch("/api/clients", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(p.name ?? "").trim(),
        phone: String(p.phone ?? "").trim(),
        bank: p.bank != null && String(p.bank).trim() ? String(p.bank).trim() : null,
        assistantName:
          p.assistantName != null && String(p.assistantName).trim() ? String(p.assistantName).trim() : null,
        callSummary:
          p.callSummary != null && String(p.callSummary).trim() ? String(p.callSummary).trim() : null,
        callStartedAt:
          p.callStartedAt != null && String(p.callStartedAt).trim() ? String(p.callStartedAt).trim() : null,
        note: p.note != null && String(p.note).trim() ? String(p.note).trim() : null,
        statusId: status?.id ?? undefined,
      }),
    });
    if (res.ok) {
      const name = String(p.name ?? "").trim();
      return `✅ Карточка клиента создана${name ? `: ${name}` : ""}.\nСписок во вкладке «Клиенты» обновлён; при необходимости откройте её или «Редактировать» в карточке.`;
    }
    const err = await res.json().catch(() => ({}));
    return `❌ Не удалось создать клиента: ${(err as { message?: string }).message ?? res.status}`;
  }

  return "❌ Неизвестное действие";
}
