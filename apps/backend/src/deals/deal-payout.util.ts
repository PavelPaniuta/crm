import { Prisma } from '@prisma/client';

export const MEDIATOR_AI_PAYROLL = 'MEDIATOR_AI_PAYROLL' as const;

// ─── Universal Calc Chain ────────────────────────────────────────────────────

export type CalcStep = {
  id: string;
  label: string;
  sourceType: 'field' | 'step';
  sourceId: string;         // field key OR previous step id
  deductType: 'percent' | 'fixed';
  deductFieldKey: string;   // field that holds the % or fixed amount
  resultLabel: string;
  isPayrollPool?: boolean;  // deductAmt of this step = payroll fund
  isMediatorShare?: boolean; // deductAmt of this step = mediator share
  isAiShare?: boolean;      // deductAmt of this step = office AI share
};

function stepTextHints(step: CalcStep): { mediator: boolean; ai: boolean } {
  const label = step.label.toLowerCase();
  const key = step.deductFieldKey.toLowerCase();
  return {
    mediator: label.includes('посредник') || key.includes('посредник'),
    ai:
      label.includes('ai') ||
      label.includes('аи') ||
      label.includes('ии') ||
      key.includes('аи') ||
      key.includes('_ai') ||
      key.endsWith('_ai'),
  };
}

function isCalcStep(v: unknown): v is CalcStep {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    s.id.length > 0 &&
    (s.sourceType === 'field' || s.sourceType === 'step') &&
    typeof s.sourceId === 'string' &&
    (s.deductType === 'percent' || s.deductType === 'fixed') &&
    typeof s.deductFieldKey === 'string'
  );
}

/** Нормализует calcSteps из Prisma Json — отбрасывает битые элементы. */
export function parseCalcSteps(raw: unknown): CalcStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCalcStep);
}

export type CalcStepResult = {
  step: CalcStep;
  source: number;
  deductAmt: number;
  result: number;
};

export function computeChain(
  data: Record<string, unknown>,
  steps: CalcStep[] | unknown,
): CalcStepResult[] {
  const safeSteps = Array.isArray(steps) ? parseCalcSteps(steps) : [];
  const results: Record<string, number> = {};
  return safeSteps.map((step) => {
    const source =
      step.sourceType === 'field'
        ? Number(data[step.sourceId]) || 0
        : (results[step.sourceId] ?? 0);
    const deductVal = Number(data[step.deductFieldKey]) || 0;
    const deductAmt =
      step.deductType === 'percent' ? source * (deductVal / 100) : deductVal;
    results[step.id] = source - deductAmt;
    return { step, source, deductAmt, result: results[step.id] };
  });
}

export function getPayrollBaseFromChain(chain: CalcStepResult[]): number {
  const payrollStep = chain.find((c) => c.step.isPayrollPool);
  if (payrollStep) return Math.max(0, payrollStep.deductAmt);
  const last = chain[chain.length - 1];
  return last ? Math.max(0, last.result) : 0;
}

export function getMediatorShareFromChain(chain: CalcStepResult[]): number {
  const marked = chain.find((c) => c.step.isMediatorShare);
  if (marked) return Math.max(0, marked.deductAmt);
  const byHint = chain.find((c) => stepTextHints(c.step).mediator);
  if (byHint) return Math.max(0, byHint.deductAmt);
  const first = chain[0];
  if (first?.step.sourceType === 'field') return Math.max(0, first.deductAmt);
  return 0;
}

export function getAiShareFromChain(chain: CalcStepResult[]): number {
  const aiStep = chain.find((c) => c.step.isAiShare);
  if (aiStep) return Math.max(0, aiStep.deductAmt);
  const byHint = chain.find((c) => stepTextHints(c.step).ai);
  if (byHint) return Math.max(0, byHint.deductAmt);
  return 0;
}

function withMediatorLink(
  deal: DealForPayout,
  breakdown: DealPayoutBreakdown,
): DealPayoutBreakdown {
  if (breakdown.mediator > 0 || breakdown.gross <= 0 || !deal.mediatorLink) return breakdown;
  const pct = Number(deal.mediatorLink.pct);
  if (!Number.isFinite(pct) || pct <= 0) return breakdown;
  return { ...breakdown, mediator: (breakdown.gross * pct) / 100 };
}

export type DealPayoutBreakdown = {
  gross: number;
  mediator: number;
  ai: number;
  payrollPool: number;
  office: number;
  mode: 'classic' | 'incomeField' | 'mediatorAiPayroll' | 'calcChain' | 'none';
};

function dealAmounts(deal: { amounts?: { amountOut: unknown }[] | null }) {
  return deal.amounts ?? [];
}

function dealDataRows(deal: { dataRows?: { data: unknown }[] | null }) {
  return deal.dataRows ?? [];
}

export type DealForPayout = {
  amounts?: { amountOut: unknown }[] | null;
  dataRows?: { data: unknown }[] | null;
  mediatorLink?: { pct: unknown } | null;
  template:
    | (MediatorAiPayrollKeys & {
        incomeFieldKey: string | null;
        calcSteps?: unknown;
        fields?: Array<{ key: string; type: string }>;
      })
    | null;
  rateSnapshot?: unknown;
};

/** Суммы в валюте сделки (до конвертации в USD). */
export function getDealPayoutBreakdown(deal: DealForPayout): DealPayoutBreakdown {
  const empty: DealPayoutBreakdown = {
    gross: 0,
    mediator: 0,
    ai: 0,
    payrollPool: 0,
    office: 0,
    mode: 'none',
  };
  const amounts = dealAmounts(deal);
  const dataRows = dealDataRows(deal);
  if (amounts.length > 0) {
    const gross = amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
    return withMediatorLink(deal, {
      gross,
      mediator: 0,
      ai: 0,
      payrollPool: gross,
      office: 0,
      mode: 'classic',
    });
  }
  const t = deal.template;
  if (!t || dataRows.length === 0) return withMediatorLink(deal, empty);
  const first = dataRows[0]?.data as Record<string, unknown> | undefined;
  if (!first) return withMediatorLink(deal, empty);

  const steps = parseCalcSteps(t.calcSteps);
  if (steps.length > 0) {
    const chain = computeChain(first, steps);
    const gross = chain[0]?.source ?? 0;
    const office = chain.length > 0 ? Math.max(0, chain[chain.length - 1].result) : 0;
    return withMediatorLink(deal, {
      gross,
      mediator: getMediatorShareFromChain(chain),
      ai: getAiShareFromChain(chain),
      payrollPool: getPayrollBaseFromChain(chain),
      office,
      mode: 'calcChain',
    });
  }

  const calc = computeMediatorAiPayroll(first, t);
  if (calc) {
    return withMediatorLink(deal, {
      gross: calc.G,
      mediator: calc.M,
      ai: calc.A,
      payrollPool: calc.F,
      office: calc.P,
      mode: 'mediatorAiPayroll',
    });
  }

  if (t.incomeFieldKey) {
    const gross = dataRows.reduce((s, r) => {
      const d = r.data as Record<string, unknown>;
      return s + (Number(d[t.incomeFieldKey!]) || 0);
    }, 0);
    return withMediatorLink(deal, {
      gross,
      mediator: 0,
      ai: 0,
      payrollPool: gross,
      office: 0,
      mode: 'incomeField',
    });
  }
  return withMediatorLink(deal, empty);
}

export function breakdownToUsd(
  breakdown: DealPayoutBreakdown,
  currency: string,
  rates: Record<string, number>,
): DealPayoutBreakdown {
  const f = (n: number) => toUsdAmount(n, currency, rates);
  return {
    gross: f(breakdown.gross),
    mediator: f(breakdown.mediator),
    ai: f(breakdown.ai),
    payrollPool: f(breakdown.payrollPool),
    office: f(breakdown.office),
    mode: breakdown.mode,
  };
}

function toUsdAmount(amount: number, currency: string, rates: Record<string, number>): number {
  if (!amount) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = rates[currency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

// ─── Legacy: MEDIATOR_AI_PAYROLL preset ─────────────────────────────────────

export type MediatorAiPayrollKeys = {
  calcPreset: string | null;
  payrollPoolPct: Prisma.Decimal | number | null;
  calcGrossFieldKey: string | null;
  calcMediatorPctKey: string | null;
  calcAiPctKey: string | null;
};

/** % ИИ берётся от остатка после посредника (R1). Фонд: % от R2. */
export function computeMediatorAiPayroll(
  data: Record<string, unknown>,
  t: MediatorAiPayrollKeys,
): { G: number; M: number; R1: number; A: number; R2: number; F: number; P: number } | null {
  if (t.calcPreset !== MEDIATOR_AI_PAYROLL) return null;
  const gk = t.calcGrossFieldKey;
  const mk = t.calcMediatorPctKey;
  const ak = t.calcAiPctKey;
  if (!gk || !mk || !ak) return null;
  const G = Number(data[gk]) || 0;
  const pM = Number(data[mk]) || 0;
  const pAi = Number(data[ak]) || 0;
  const rawPool = t.payrollPoolPct;
  const poolPct =
    rawPool == null ? 20 : typeof rawPool === 'number' ? rawPool : Number(rawPool);
  if (!Number.isFinite(poolPct) || poolPct < 0 || poolPct > 100) return null;
  const M = G * (pM / 100);
  const R1 = G - M;
  const A = R1 * (pAi / 100);
  const R2 = R1 - A;
  const F = R2 * (poolPct / 100);
  const P = R2 - F;
  return { G, M, R1, A, R2, F, P };
}

// ─── Historical rate helpers ─────────────────────────────────────────────────

/**
 * Returns the rates that should be used for a deal.
 * If the deal has a rateSnapshot (captured at creation time), use it.
 * Otherwise fall back to current rates.
 */
export function getEffectiveRates(
  deal: { rateSnapshot?: unknown },
  currentRates: Record<string, number>,
): Record<string, number> {
  const snap = deal.rateSnapshot;
  if (snap && typeof snap === 'object' && !Array.isArray(snap)) {
    const map = snap as Record<string, unknown>;
    if (Object.keys(map).length > 0) {
      const r: Record<string, number> = {};
      for (const [k, v] of Object.entries(map)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) r[k] = n;
      }
      if (Object.keys(r).length > 0) return r;
    }
  }
  return currentRates;
}

// ─── Unified payroll base resolver ──────────────────────────────────────────

export function getPayrollBaseForTemplateDeal(
  deal: {
    amounts?: { amountOut: Prisma.Decimal | unknown }[] | null;
    dataRows?: { data: unknown }[] | null;
    template:
      | (MediatorAiPayrollKeys & {
          incomeFieldKey: string | null;
          calcSteps?: unknown;
        })
      | null;
  },
): { base: number; mode: 'classic' | 'incomeField' | 'mediatorAiPayroll' | 'calcChain' } {
  const amounts = dealAmounts(deal);
  const dataRows = dealDataRows(deal);
  if (amounts.length > 0) {
    const totalOut = amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
    return { base: totalOut, mode: 'classic' };
  }
  const t = deal.template;
  if (!t || dataRows.length === 0) return { base: 0, mode: 'incomeField' };
  const first = dataRows[0]?.data as Record<string, unknown>;
  if (!first) return { base: 0, mode: 'incomeField' };

  // New: universal calcSteps chain takes priority
  const steps = parseCalcSteps(t.calcSteps);
  if (steps.length > 0) {
    const chain = computeChain(first, steps);
    return { base: getPayrollBaseFromChain(chain), mode: 'calcChain' };
  }

  // Legacy: MEDIATOR_AI_PAYROLL preset
  const calc = computeMediatorAiPayroll(first, t);
  if (calc) return { base: Math.max(0, calc.F), mode: 'mediatorAiPayroll' };

  if (t.incomeFieldKey) {
    const key = t.incomeFieldKey;
    const rowSum = dataRows.reduce((s, r) => {
      const d = r.data as Record<string, unknown>;
      return s + (Number(d[key]) || 0);
    }, 0);
    return { base: rowSum, mode: 'incomeField' };
  }
  return { base: 0, mode: 'incomeField' };
}
