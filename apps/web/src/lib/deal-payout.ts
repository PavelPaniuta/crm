/**
 * Расчёты по сделкам (зеркало backend deal-payout.util.ts для UI).
 * При изменении формул — синхронизировать с apps/backend/src/deals/deal-payout.util.ts
 */

export const MEDIATOR_AI_PAYROLL = 'MEDIATOR_AI_PAYROLL' as const;

export type CalcStep = {
  id: string;
  label: string;
  sourceType: 'field' | 'step';
  sourceId: string;
  deductType: 'percent' | 'fixed';
  deductFieldKey: string;
  resultLabel: string;
  isPayrollPool?: boolean;
  isMediatorShare?: boolean;
  isAiShare?: boolean;
};

export type CalcStepResult = {
  step: CalcStep;
  source: number;
  deductAmt: number;
  result: number;
};

export function computeChain(
  data: Record<string, string>,
  steps: CalcStep[],
): CalcStepResult[] {
  const results: Record<string, number> = {};
  return steps.map((step) => {
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

export type MediatorAiTemplateKeys = {
  calcPreset?: string | null;
  payrollPoolPct?: string | number | null;
  calcGrossFieldKey?: string | null;
  calcMediatorPctKey?: string | null;
  calcAiPctKey?: string | null;
};

export function parsePayrollPoolPct(tpl: { payrollPoolPct?: string | number | null }): number {
  if (tpl.payrollPoolPct == null) return 20;
  const n = Number(tpl.payrollPoolPct);
  return Number.isFinite(n) ? n : 20;
}

/** % ИИ от остатка после посредника (R1). Фонд: % от R2. */
export function computeMediatorAiPayroll(
  data: Record<string, string>,
  t: MediatorAiTemplateKeys,
): { G: number; M: number; R1: number; A: number; R2: number; F: number; P: number } | null {
  if (t.calcPreset !== MEDIATOR_AI_PAYROLL) return null;
  const gk = t.calcGrossFieldKey;
  const mk = t.calcMediatorPctKey;
  const ak = t.calcAiPctKey;
  if (!gk || !mk || !ak) return null;
  const G = Number(data[gk]) || 0;
  const pM = Number(data[mk]) || 0;
  const pAi = Number(data[ak]) || 0;
  const poolPct = parsePayrollPoolPct(t);
  const M = G * (pM / 100);
  const R1 = G - M;
  const A = R1 * (pAi / 100);
  const R2 = R1 - A;
  const F = R2 * (poolPct / 100);
  const P = R2 - F;
  return { G, M, R1, A, R2, F, P };
}

/** @deprecated alias for templates in UI */
export const computeMediatorAiPayrollForTemplate = computeMediatorAiPayroll;
