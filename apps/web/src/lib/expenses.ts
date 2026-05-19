import type { ExpenseRow } from "@/components/expenses/ExpenseDetailModal";

export type { ExpenseRow };

export async function fetchExpenses(): Promise<ExpenseRow[]> {
  const res = await fetch("/api/expenses", { credentials: "include" });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("load_failed");
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

export async function createExpenseApi(payload: {
  title: string;
  amount: number;
  currency: string;
  payMethod: string;
}): Promise<void> {
  const res = await fetch("/api/expenses", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("create_failed");
}

export async function deleteExpenseApi(id: string): Promise<void> {
  const res = await fetch(`/api/expenses/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("delete_failed");
}

export function amountToUsd(amount: number, currency: string, exchangeRates: Record<string, number>): number {
  const rate = exchangeRates[currency] ?? 1;
  return rate > 0 ? amount / rate : amount;
}
