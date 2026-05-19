import { MEDIATOR_AI_PAYROLL, type CalcStep } from "@/lib/deal-payout";

export type { CalcStep };
import type { FieldType } from "@/lib/field-types";
import type { DealTemplate } from "@/lib/deals";

export { MEDIATOR_AI_PAYROLL };

export type TemplateFieldDraft = {
  _id: string;
  key?: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string;
};

export type TemplateWizardStep = "type" | "fields";

export type TemplateWizardFormState = {
  name: string;
  hasWorkers: boolean;
  incomeFieldKey: string;
  fields: TemplateFieldDraft[];
  calcPreset: "" | typeof MEDIATOR_AI_PAYROLL;
  payrollPoolPct: string;
  calcGrossKey: string;
  calcMediatorKey: string;
  calcAiKey: string;
  wizardStep: TemplateWizardStep;
  calcSteps: CalcStep[];
};

const FIXED_PRESET_IDS = ["fixed_gross", "fixed_mediator", "fixed_ai", "fixed_payroll"] as const;

export function slugifyFieldKey(label: string, i: number): string {
  return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_а-яё]/gi, "") || `field_${i}`;
}

export function getMediatorAiPresetFields(): TemplateFieldDraft[] {
  return [
    { _id: "fixed_gross", key: "сумма_завода", label: "Сумма завода", type: "NUMBER", required: true, options: "" },
    { _id: "fixed_mediator", key: "процент_посредника", label: "% посредника", type: "PERCENT", required: true, options: "" },
    { _id: "fixed_ai", key: "процент_аи", label: "% AI", type: "PERCENT", required: true, options: "" },
    { _id: "fixed_payroll", key: "процент_зп_фонда", label: "% зарплатного фонда", type: "PERCENT", required: true, options: "" },
  ];
}

export function getMediatorAiPresetSteps(): CalcStep[] {
  return [
    {
      id: "step_mediator",
      label: "Выплата посредника",
      sourceType: "field",
      sourceId: "сумма_завода",
      deductType: "percent",
      deductFieldKey: "процент_посредника",
      resultLabel: "После посредника (R1)",
      isMediatorShare: true,
      isPayrollPool: false,
    },
    {
      id: "step_ai",
      label: "Доля AI",
      sourceType: "step",
      sourceId: "step_mediator",
      deductType: "percent",
      deductFieldKey: "процент_аи",
      resultLabel: "После AI (R2)",
      isAiShare: true,
      isPayrollPool: false,
    },
    {
      id: "step_payroll",
      label: "Зарплатный фонд",
      sourceType: "step",
      sourceId: "step_ai",
      deductType: "percent",
      deductFieldKey: "процент_зп_фонда",
      resultLabel: "Прибыль офиса",
      isPayrollPool: true,
    },
  ];
}

export function mergeMediatorAiPresetFields(prev: TemplateFieldDraft[]): TemplateFieldDraft[] {
  const fixed = getMediatorAiPresetFields();
  const existing = prev.filter((f) => !FIXED_PRESET_IDS.includes(f._id as (typeof FIXED_PRESET_IDS)[number]));
  return [...fixed, ...existing];
}

export function buildTemplateWizardState(editing: DealTemplate | null): TemplateWizardFormState {
  const preset = editing?.calcPreset === MEDIATOR_AI_PAYROLL ? MEDIATOR_AI_PAYROLL : ("" as const);
  return {
    name: editing?.name ?? "",
    hasWorkers: editing?.hasWorkers ?? true,
    incomeFieldKey: editing?.incomeFieldKey ?? "",
    calcPreset: preset,
    payrollPoolPct:
      editing?.calcPreset === MEDIATOR_AI_PAYROLL && editing.payrollPoolPct != null
        ? String(Number(editing.payrollPoolPct as number))
        : "20",
    calcGrossKey: editing?.calcGrossFieldKey ?? "",
    calcMediatorKey: editing?.calcMediatorPctKey ?? "",
    calcAiKey: editing?.calcAiPctKey ?? "",
    fields:
      editing?.fields.map((f) => ({
        _id: f.id,
        key: f.key,
        label: f.label,
        type: f.type as FieldType,
        required: f.required,
        options: f.options ?? "",
      })) ?? [],
    calcSteps: Array.isArray(editing?.calcSteps) ? (editing.calcSteps as CalcStep[]) : [],
    wizardStep: editing ? "fields" : "type",
  };
}

export function validateTemplateForm(form: TemplateWizardFormState): string | null {
  if (!form.name.trim()) return "Введите название шаблона";
  if (form.fields.length === 0) return "Добавьте хотя бы одно поле";
  for (const f of form.fields) {
    if (!f.label.trim()) return "У всех полей должно быть название";
  }

  if (form.calcSteps.length > 0) {
    const fields2 = form.fields.map((f, i) => ({
      key: f.key || slugifyFieldKey(f.label, i),
      label: f.label,
    }));
    const fieldKeys = new Set(fields2.map((x) => x.key));
    for (const step of form.calcSteps) {
      if (!step.label.trim()) return "У каждого шага цепочки должно быть название";
      if (!step.deductFieldKey) return `Шаг «${step.label}»: укажите поле для вычитания`;
      if (!fieldKeys.has(step.deductFieldKey)) {
        return `Шаг «${step.label}»: поле «${step.deductFieldKey}» не найдено в полях шаблона`;
      }
      if (step.sourceType === "field" && step.sourceId && !fieldKeys.has(step.sourceId)) {
        return `Шаг «${step.label}»: поле-источник «${step.sourceId}» не найдено`;
      }
    }
  }

  if (form.calcPreset === MEDIATOR_AI_PAYROLL && form.calcSteps.length === 0) {
    if (!form.calcGrossKey || !form.calcMediatorKey || !form.calcAiKey) {
      return "Для цепочки «Посредник → ИИ → фонд» укажите поля: сумма завода, % посредника, % ИИ";
    }
  }

  return null;
}

export function buildTemplateSavePayload(form: TemplateWizardFormState): Record<string, unknown> {
  const fields = form.fields.map((f, i) => ({
    key: f.key || slugifyFieldKey(f.label, i),
    label: f.label,
    type: f.type,
    required: f.required,
    order: i,
    options: f.options.trim() || null,
  }));

  const hasChain = form.calcSteps.length > 0;
  const payload: Record<string, unknown> = {
    name: form.name,
    hasWorkers: hasChain || form.calcPreset === MEDIATOR_AI_PAYROLL ? true : form.hasWorkers,
    incomeFieldKey: form.incomeFieldKey || null,
    fields,
    calcSteps: hasChain ? form.calcSteps : null,
  };

  if (!hasChain && form.calcPreset === MEDIATOR_AI_PAYROLL) {
    payload.calcPreset = MEDIATOR_AI_PAYROLL;
    payload.calcGrossFieldKey = form.calcGrossKey;
    payload.calcMediatorPctKey = form.calcMediatorKey;
    payload.calcAiPctKey = form.calcAiKey;
  } else {
    payload.calcPreset = hasChain ? null : null;
  }

  return payload;
}

export async function fetchDealTemplates(): Promise<DealTemplate[]> {
  const res = await fetch("/api/deal-templates", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export async function saveDealTemplate(
  editingId: string | null,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = editingId ? `/api/deal-templates/${editingId}` : "/api/deal-templates";
  const method = editingId ? "PATCH" : "POST";
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) return { ok: true };
  const j = await res.json().catch(() => null);
  const detail = j?.message ?? j?.error ?? `HTTP ${res.status}`;
  const text = Array.isArray(detail) ? detail.join("\n") : String(detail);
  const prefix = editingId ? "Ошибка сохранения шаблона" : "Ошибка создания шаблона";
  return { ok: false, message: `${prefix}:\n${text}` };
}

export async function deleteDealTemplate(id: string): Promise<boolean> {
  const res = await fetch(`/api/deal-templates/${id}`, { method: "DELETE", credentials: "include" });
  return res.ok;
}

export type AiParsedTemplate = {
  name?: string;
  hasWorkers?: boolean;
  incomeFieldKey?: string;
  fields?: Array<{
    label?: string;
    type?: string;
    required?: boolean;
    options?: string;
  }>;
};

export async function parseTemplateWithAi(
  sampleRows: string,
): Promise<{ ok: true; data: AiParsedTemplate } | { ok: false; error: string }> {
  const res = await fetch("/api/ai/parse-template", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sampleRows }),
  });
  const j = await res.json();
  if (j.error) return { ok: false, error: j.error };
  return { ok: true, data: j };
}

export function applyAiParseToForm(
  data: AiParsedTemplate,
  prev: TemplateWizardFormState,
): TemplateWizardFormState {
  return {
    ...prev,
    name: data.name ?? prev.name,
    hasWorkers: data.hasWorkers ?? false,
    incomeFieldKey: data.incomeFieldKey ?? "",
    fields: (data.fields ?? []).map((f, i) => ({
      _id: crypto.randomUUID(),
      label: f.label ?? `Поле ${i + 1}`,
      type: (f.type as FieldType) ?? "TEXT",
      required: f.required ?? false,
      options: f.options ?? "",
    })),
    wizardStep: "fields",
  };
}
