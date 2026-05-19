/** Валюты CRM (база — USD). */
export const CURRENCIES = ["USD", "EUR", "UAH", "PLN", "CHF"] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: "$", name: "US Dollar" },
  EUR: { symbol: "€", name: "Euro" },
  UAH: { symbol: "₴", name: "Ukrainian Hryvnia" },
  PLN: { symbol: "zł", name: "Polish Zloty" },
  CHF: { symbol: "Fr", name: "Swiss Franc" },
};
