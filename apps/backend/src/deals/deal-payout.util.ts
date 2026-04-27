import { Prisma } from '@prisma/client';

export const MEDIATOR_AI_PAYROLL = 'MEDIATOR_AI_PAYROLL' as const;

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
    rawPool == null
      ? 20
      : typeof rawPool === 'number'
        ? rawPool
        : Number(rawPool);
  if (!Number.isFinite(poolPct) || poolPct < 0 || poolPct > 100) return null;
  const M = G * (pM / 100);
  const R1 = G - M;
  const A = R1 * (pAi / 100);
  const R2 = R1 - A;
  const F = R2 * (poolPct / 100);
  const P = R2 - F;
  return { G, M, R1, A, R2, F, P };
}

export function getPayrollBaseForTemplateDeal(
  deal: {
    amounts: { amountOut: Prisma.Decimal | unknown }[];
    dataRows: { data: unknown }[];
    template: (MediatorAiPayrollKeys & { incomeFieldKey: string | null }) | null;
  },
): { base: number; mode: 'classic' | 'incomeField' | 'mediatorAiPayroll' } {
  if (deal.amounts.length > 0) {
    const totalOut = deal.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
    return { base: totalOut, mode: 'classic' };
  }
  const t = deal.template;
  if (!t || deal.dataRows.length === 0) return { base: 0, mode: 'incomeField' };
  const first = deal.dataRows[0]?.data as Record<string, unknown>;
  if (!first) return { base: 0, mode: 'incomeField' };
  const calc = computeMediatorAiPayroll(first, t);
  if (calc) return { base: Math.max(0, calc.F), mode: 'mediatorAiPayroll' };
  if (t.incomeFieldKey) {
    const key = t.incomeFieldKey;
    const rowSum = deal.dataRows.reduce((s, r) => {
      const d = r.data as Record<string, unknown>;
      return s + (Number(d[key]) || 0);
    }, 0);
    return { base: rowSum, mode: 'incomeField' };
  }
  return { base: 0, mode: 'incomeField' };
}
