import {
  isBaseSalaryAccruedForPeriod,
  listPeriodsInclusive,
  payDayDate,
  periodLte,
  salaryPeriodFromDate,
} from './salary-accrual.util';

describe('salary-accrual.util', () => {
  it('payDayDate caps at month end', () => {
    expect(payDayDate('2026-02', 31).getUTCDate()).toBe(28);
  });

  it('does not accrue base before pay day in current month', () => {
    const ref = new Date(Date.UTC(2026, 4, 14, 12, 0, 0)); // 2026-05-14
    expect(isBaseSalaryAccruedForPeriod('2026-05', 15, ref)).toBe(false);
  });

  it('accrues base on and after pay day in current month', () => {
    const onDay = new Date(Date.UTC(2026, 4, 15, 12, 0, 0));
    const after = new Date(Date.UTC(2026, 4, 19, 12, 0, 0));
    expect(isBaseSalaryAccruedForPeriod('2026-05', 15, onDay)).toBe(true);
    expect(isBaseSalaryAccruedForPeriod('2026-05', 15, after)).toBe(true);
  });

  it('always accrues base for completed past months', () => {
    const ref = new Date(Date.UTC(2026, 4, 1));
    expect(isBaseSalaryAccruedForPeriod('2026-04', 15, ref)).toBe(true);
  });

  it('does not accrue base for future months', () => {
    const ref = new Date(Date.UTC(2026, 4, 20));
    expect(isBaseSalaryAccruedForPeriod('2026-06', 15, ref)).toBe(false);
  });

  it('lists periods inclusively', () => {
    expect(listPeriodsInclusive('2026-03', '2026-05')).toEqual(['2026-03', '2026-04', '2026-05']);
  });

  it('compares YYYY-MM periods correctly', () => {
    expect(periodLte('2026-09', '2026-10')).toBe(true);
    expect(periodLte('2026-10', '2026-09')).toBe(false);
  });

  it('salaryPeriodFromDate uses UTC', () => {
    expect(salaryPeriodFromDate(new Date(Date.UTC(2026, 3, 15)))).toBe('2026-04');
  });
});
