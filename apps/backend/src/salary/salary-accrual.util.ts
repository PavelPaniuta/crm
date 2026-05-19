/** YYYY-MM */
export type SalaryPeriod = string;

export function parseSalaryPeriod(period: SalaryPeriod): { year: number; month: number } {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid salary period: ${period}`);
  }
  return { year, month };
}

export function salaryPeriodFromDate(d: Date): SalaryPeriod {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function periodBounds(period: SalaryPeriod): { from: Date; to: Date } {
  const { year, month } = parseSalaryPeriod(period);
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { from, to };
}

/** Last day of month caps pay day (e.g. 31 → 28 in February). */
export function payDayDate(period: SalaryPeriod, payDay: number): Date {
  const { year, month } = parseSalaryPeriod(period);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(1, payDay), lastDay);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

export function comparePeriods(a: SalaryPeriod, b: SalaryPeriod): number {
  const pa = parseSalaryPeriod(a);
  const pb = parseSalaryPeriod(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.month - pb.month;
}

export function periodLte(a: SalaryPeriod, b: SalaryPeriod): boolean {
  return comparePeriods(a, b) <= 0;
}

/** Inclusive list of YYYY-MM from start through end. */
export function listPeriodsInclusive(start: SalaryPeriod, end: SalaryPeriod): SalaryPeriod[] {
  if (comparePeriods(start, end) > 0) return [];
  const out: SalaryPeriod[] = [];
  let { year, month } = parseSalaryPeriod(start);
  const endParsed = parseSalaryPeriod(end);
  while (year < endParsed.year || (year === endParsed.year && month <= endParsed.month)) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

/**
 * Базовая ставка за месяц входит в начисление, когда наступил день выплаты (payDay).
 * — прошлые месяцы (месяц уже закончился): всегда;
 * — будущие: нет;
 * — текущий: после payDay включительно (по UTC).
 */
function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isBaseSalaryAccruedForPeriod(
  period: SalaryPeriod,
  payDay: number,
  referenceDate: Date = new Date(),
): boolean {
  const { from, to } = periodBounds(period);
  const ref = referenceDate.getTime();
  if (ref < from.getTime()) return false;
  if (ref > to.getTime()) return true;

  const { year, month } = parseSalaryPeriod(period);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(1, payDay), lastDay);
  const dueKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return utcDateKey(referenceDate) >= dueKey;
}
