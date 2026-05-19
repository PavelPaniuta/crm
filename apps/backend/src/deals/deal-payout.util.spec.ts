import {
  MEDIATOR_AI_PAYROLL,
  breakdownToUsd,
  computeChain,
  computeMediatorAiPayroll,
  getAiShareFromChain,
  getMediatorShareFromChain,
  getDealPayoutBreakdown,
  getEffectiveRates,
  getPayrollBaseFromChain,
  parseCalcSteps,
  type CalcStep,
} from './deal-payout.util';

describe('computeMediatorAiPayroll', () => {
  const tpl = {
    calcPreset: MEDIATOR_AI_PAYROLL,
    payrollPoolPct: 20,
    calcGrossFieldKey: 'gross',
    calcMediatorPctKey: 'pctM',
    calcAiPctKey: 'pctAi',
  };

  it('computes G → M → A → F → P with default pool 20%', () => {
    const r = computeMediatorAiPayroll({ gross: 1000, pctM: 10, pctAi: 5 }, tpl);
    expect(r).not.toBeNull();
    expect(r!.G).toBe(1000);
    expect(r!.M).toBe(100);
    expect(r!.R1).toBe(900);
    expect(r!.A).toBe(45); // 5% of 900
    expect(r!.R2).toBe(855);
    expect(r!.F).toBe(171); // 20% of 855
    expect(r!.P).toBe(684);
  });

  it('returns null for wrong preset or missing keys', () => {
    expect(computeMediatorAiPayroll({ gross: 100 }, { ...tpl, calcPreset: null })).toBeNull();
    expect(computeMediatorAiPayroll({ gross: 100 }, { ...tpl, calcGrossFieldKey: null })).toBeNull();
  });
});

describe('parseCalcSteps', () => {
  it('filters invalid entries and non-arrays', () => {
    const valid: CalcStep = {
      id: 's1',
      label: 'x',
      sourceType: 'field',
      sourceId: 'gross',
      deductType: 'percent',
      deductFieldKey: 'pct',
      resultLabel: 'r',
    };
    expect(parseCalcSteps(null)).toEqual([]);
    expect(parseCalcSteps([null, 'bad', valid])).toEqual([valid]);
  });
});

describe('computeChain', () => {
  const steps: CalcStep[] = [
    {
      id: 's1',
      label: 'Mediator',
      sourceType: 'field',
      sourceId: 'gross',
      deductType: 'percent',
      deductFieldKey: 'pctM',
      resultLabel: 'R1',
    },
    {
      id: 's2',
      label: 'AI',
      sourceType: 'step',
      sourceId: 's1',
      deductType: 'percent',
      deductFieldKey: 'pctAi',
      resultLabel: 'R2',
      isAiShare: true,
    },
    {
      id: 's3',
      label: 'Fund',
      sourceType: 'step',
      sourceId: 's2',
      deductType: 'percent',
      deductFieldKey: 'poolPct',
      resultLabel: 'Office',
      isPayrollPool: true,
    },
  ];

  it('ignores malformed steps without throwing', () => {
    const chain = computeChain({ gross: 100 }, [null, { bad: true }, ...steps]);
    expect(chain).toHaveLength(3);
  });

  it('chains percent steps and marks AI / payroll pool', () => {
    const chain = computeChain({ gross: 1000, pctM: 10, pctAi: 5, poolPct: 20 }, steps);
    expect(chain).toHaveLength(3);
    expect(chain[0].deductAmt).toBe(100);
    expect(chain[1].deductAmt).toBe(45);
    expect(getAiShareFromChain(chain)).toBe(45);
    expect(getPayrollBaseFromChain(chain)).toBe(171);
    expect(chain[2].result).toBe(684);
  });
});

describe('getDealPayoutBreakdown', () => {
  it('uses classic amounts when present', () => {
    const b = getDealPayoutBreakdown({
      amounts: [{ amountOut: 500 }],
      dataRows: [],
      template: null,
    });
    expect(b.mode).toBe('classic');
    expect(b.gross).toBe(500);
    expect(b.payrollPool).toBe(500);
  });

  it('treats missing amounts/dataRows as empty (partial Prisma select)', () => {
    const b = getDealPayoutBreakdown({
      dataRows: [{ data: { gross: 1000, pctM: 10, pctAi: 5 } }],
      template: {
        calcPreset: MEDIATOR_AI_PAYROLL,
        payrollPoolPct: 20,
        calcGrossFieldKey: 'gross',
        calcMediatorPctKey: 'pctM',
        calcAiPctKey: 'pctAi',
        incomeFieldKey: null,
        calcSteps: null,
      },
    } as Parameters<typeof getDealPayoutBreakdown>[0]);
    expect(b.mode).toBe('mediatorAiPayroll');
    expect(b.gross).toBe(1000);
  });

  it('extracts mediator and AI from calcChain without explicit flags (RU preset)', () => {
    const presetSteps: CalcStep[] = [
      {
        id: 'step_mediator',
        label: 'Выплата посредника',
        sourceType: 'field',
        sourceId: 'сумма_завода',
        deductType: 'percent',
        deductFieldKey: 'процент_посредника',
        resultLabel: 'R1',
      },
      {
        id: 'step_ai',
        label: 'Доля AI',
        sourceType: 'step',
        sourceId: 'step_mediator',
        deductType: 'percent',
        deductFieldKey: 'процент_аи',
        resultLabel: 'R2',
      },
      {
        id: 'step_payroll',
        label: 'Зарплатный фонд',
        sourceType: 'step',
        sourceId: 'step_ai',
        deductType: 'percent',
        deductFieldKey: 'процент_зп_фонда',
        resultLabel: 'Office',
        isPayrollPool: true,
      },
    ];
    const b = getDealPayoutBreakdown({
      amounts: [],
      dataRows: [
        {
          data: {
            сумма_завода: 1000,
            процент_посредника: 10,
            процент_аи: 5,
            процент_зп_фонда: 20,
          },
        },
      ],
      template: {
        calcPreset: null,
        payrollPoolPct: null,
        calcGrossFieldKey: null,
        calcMediatorPctKey: null,
        calcAiPctKey: null,
        incomeFieldKey: 'сумма_завода',
        calcSteps: presetSteps,
      },
    });
    expect(b.mode).toBe('calcChain');
    expect(b.mediator).toBe(100);
    expect(b.ai).toBe(45);
    expect(b.payrollPool).toBe(171);
  });

  it('uses DealMediator pct when chain mediator is zero', () => {
    const b = getDealPayoutBreakdown({
      amounts: [],
      dataRows: [{ data: { сумма_завода: 2000 } }],
      mediatorLink: { pct: 15 },
      template: {
        calcPreset: null,
        payrollPoolPct: null,
        calcGrossFieldKey: null,
        calcMediatorPctKey: null,
        calcAiPctKey: null,
        incomeFieldKey: 'сумма_завода',
        calcSteps: null,
      },
    });
    expect(b.mediator).toBe(300);
  });

  it('uses mediatorAiPayroll preset', () => {
    const b = getDealPayoutBreakdown({
      amounts: [],
      dataRows: [{ data: { gross: 1000, pctM: 10, pctAi: 5 } }],
      template: {
        calcPreset: MEDIATOR_AI_PAYROLL,
        payrollPoolPct: 20,
        calcGrossFieldKey: 'gross',
        calcMediatorPctKey: 'pctM',
        calcAiPctKey: 'pctAi',
        incomeFieldKey: null,
        calcSteps: null,
      },
    });
    expect(b.mode).toBe('mediatorAiPayroll');
    expect(b.mediator).toBe(100);
    expect(b.ai).toBe(45);
    expect(b.office).toBe(684);
  });
});

describe('breakdownToUsd', () => {
  it('converts non-USD via rateToUsd', () => {
    const usd = breakdownToUsd(
      {
        gross: 100,
        mediator: 10,
        ai: 5,
        olx: 0,
        info: 0,
        receipt: 90,
        payrollPool: 20,
        workerPool: 20,
        office: 65,
        mode: 'mediatorAiPayroll',
      },
      'PLN',
      { PLN: 4 },
    );
    expect(usd.gross).toBe(25);
    expect(usd.mediator).toBe(2.5);
  });
});

describe('getEffectiveRates', () => {
  it('prefers deal rateSnapshot over current rates', () => {
    const r = getEffectiveRates({ rateSnapshot: { PLN: 3.5 } }, { PLN: 4 });
    expect(r.PLN).toBe(3.5);
  });

  it('falls back to current rates', () => {
    const r = getEffectiveRates({}, { USD: 1, PLN: 4 });
    expect(r.PLN).toBe(4);
  });
});
