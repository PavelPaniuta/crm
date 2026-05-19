import {
  MEDIATOR_AI_PAYROLL as CALC_MEDIATOR_AI_PAYROLL,
  computeChain,
  type CalcStep,
} from "@/lib/deal-payout";
import type { ClientPipelineStatus } from "@/lib/clients";

export type DealStatus = "NEW" | "IN_PROGRESS" | "CLOSED";
export type OperationType = "PURCHASE" | "ATM" | "TRANSFER";

export type DealTemplate = {
  id: string;
  name: string;
  hasWorkers: boolean;
  incomeFieldKey?: string | null;
  fields: Array<{
    id: string;
    key: string;
    label: string;
    type: string;
    required: boolean;
    order: number;
    options?: string | null;
  }>;
  calcPreset?: string | null;
  payrollPoolPct?: string | number | null;
  calcGrossFieldKey?: string | null;
  calcMediatorPctKey?: string | null;
  calcAiPctKey?: string | null;
  calcSteps?: CalcStep[] | null;
};

export type DealDataRow = {
  id: string;
  data: Record<string, unknown>;
  order: number;
};

export type Deal = {
  id: string;
  title: string;
  status: DealStatus;
  dealDate: string;
  comment?: string | null;
  clientId?: string | null;
  templateId?: string | null;
  template?: DealTemplate | null;
  client?: { id: string; name: string; phone: string; status?: ClientPipelineStatus | null } | null;
  amounts: Array<{
    id: string;
    amountIn: string;
    currencyIn: string;
    amountOut: string;
    currencyOut: string;
    bank: string;
    operationType: OperationType;
    shopName?: string | null;
  }>;
  dataRows?: DealDataRow[];
  mediatorLink?: { mediatorId: string; pct: string | number; mediator: { id: string; name: string } } | null;
  olxLink?: { olxId: string; pct: string | number; olx: { id: string; name: string } } | null;
  infoPct?: number | string | null;
  participants: Array<{
    id: string;
    pct: number;
    user: { id: string; email: string; name?: string | null; role: "ADMIN" | "MANAGER" };
  }>;
};

export type DealAmtRow = {
  id: string;
  bank: string;
  operationType: OperationType;
  amountIn: string;
  currencyIn: string;
  amountOut: string;
  currencyOut: string;
  shopName: string;
};

export type DealParticipantRow = { id: string; userId: string; pct: string };

export type DealWorker = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  position?: string | null;
  organizationId: string;
  organization?: { name: string };
};

export const DEAL_FILTER_TABS = [
  { id: "ALL" as const, label: "Все" },
  { id: "NEW" as const, label: "Новые" },
  { id: "IN_PROGRESS" as const, label: "В работе" },
  { id: "CLOSED" as const, label: "Закрытые" },
];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  CLOSED: "Закрыта",
};

/** Ключ поля «% посредника» в данных шаблона (для расчёта). */
export function mediatorPctFieldKey(tpl: DealTemplate | null | undefined): string | null {
  if (!tpl) return null;
  if (tpl.calcMediatorPctKey) return tpl.calcMediatorPctKey;
  if (tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL) {
    const f = tpl.fields.find(
      (field) =>
        field.type === "PERCENT" &&
        (field.key.includes("посредник") || field.label.toLowerCase().includes("посредник")),
    );
    return f?.key ?? null;
  }
  const steps = tpl.calcSteps;
  if (steps?.length) {
    const step = steps.find(
      (s) =>
        s.label.toLowerCase().includes("посредник") ||
        (s.deductFieldKey && s.deductFieldKey.includes("посредник")),
    );
    return step?.deductFieldKey ?? null;
  }
  return null;
}

export function formatDealWorkerParts(deal: Deal): string {
  return deal.participants
    .map((p) => {
      const label = p.user.name || p.user.email.split("@")[0];
      return `${label} ${p.pct}%`;
    })
    .join(" · ");
}

export function getDealListOutput(deal: Deal): { totalOut: number; currencyLabel: string } {
  let totalOut = deal.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
  let currencyLabel = deal.amounts[0]?.currencyOut ?? "";
  if (totalOut === 0 && deal.template && deal.dataRows && deal.dataRows.length > 0) {
    const rowData = (deal.dataRows[0] as DealDataRow).data as Record<string, string>;
    const tpl = deal.template;
    const currField = tpl.fields?.find((f) => f.type === "CURRENCY");
    if (currField) currencyLabel = String(rowData[currField.key] ?? "");
    if (Array.isArray(tpl.calcSteps) && tpl.calcSteps.length > 0) {
      const chain = computeChain(rowData, tpl.calcSteps);
      if (chain.length > 0) totalOut = chain[0].source;
    } else if (tpl.incomeFieldKey) {
      totalOut = Number(rowData[tpl.incomeFieldKey]) || 0;
    } else if (tpl.calcGrossFieldKey) {
      totalOut = Number(rowData[tpl.calcGrossFieldKey]) || 0;
    }
  }
  return { totalOut, currencyLabel };
}

export async function fetchDeals(): Promise<Deal[]> {
  const res = await fetch("/api/deals", { credentials: "include" });
  if (!res.ok) throw new Error("fetch deals failed");
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

export async function deleteDealApi(id: string): Promise<boolean> {
  const res = await fetch(`/api/deals/${id}`, { method: "DELETE", credentials: "include" });
  return res.ok || res.status === 204;
}

export async function importLegacyDealsApi(
  file: File,
  year: number,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, message: "Нужен файл .xlsx" };
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(
    `/api/deals/import-legacy?year=${encodeURIComponent(String(year))}&currency=PLN`,
    { method: "POST", body: fd, credentials: "include" },
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: j.message || "Ошибка импорта" };
  }
  const withParts = Array.isArray(j.deals)
    ? j.deals.filter((d: { participantsAssigned?: boolean }) => d.participantsAssigned).length
    : 0;
  const parts = [`Создано сделок: ${j.created ?? 0}`, withParts ? `С воркерами (%): ${withParts}` : ""].filter(Boolean);
  if (j.errors?.length) parts.push(`Строки с замечаниями:\n${j.errors.slice(0, 8).join("\n")}`);
  if (j.templateId) parts.push("Шаблон: «Легаси (импорт)»");
  return { ok: true, message: parts.join("\n\n") };
}
