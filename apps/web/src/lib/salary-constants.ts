export const SALARY_PAYMENT_TYPES: Record<string, string> = {
  BASE: "Ставка",
  DEAL_BONUS: "Бонус по сделкам",
  AI_DEAL_SHARE: "Доля ИИ по сделкам",
  ADVANCE: "Аванс",
  MANUAL: "Ручная",
};

export const SALARY_PAY_DAY_PRESETS = [1, 5, 10, 15, 25, 31] as const;

export type SalaryConfigInput = {
  baseAmount: string;
  currency: string;
  payDay: string;
  note: string;
};

export type SalaryPaymentInput = {
  amount: string;
  currency: string;
  type: string;
  note: string;
  isPaid: boolean;
};
