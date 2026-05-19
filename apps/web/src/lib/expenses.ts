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
  categoryId: string;
  supplierId?: string | null;
  comment?: string | null;
}): Promise<ExpenseRow> {
  const res = await fetch("/api/expenses", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("create_failed");
  return res.json();
}

export async function deleteExpenseApi(id: string): Promise<void> {
  const res = await fetch(`/api/expenses/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("delete_failed");
}

export async function uploadExpenseFileApi(expenseId: string, file: File): Promise<void> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/expenses/${expenseId}/files`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  if (!res.ok) throw new Error("upload_failed");
}

export async function deleteExpenseFileApi(expenseId: string, fileId: string): Promise<void> {
  const res = await fetch(`/api/expenses/${expenseId}/files/${fileId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("delete_file_failed");
}

export function expenseFileDownloadUrl(expenseId: string, fileId: string): string {
  return `/api/expenses/${expenseId}/files/${fileId}`;
}

export function amountToUsd(amount: number, currency: string, exchangeRates: Record<string, number>): number {
  const rate = exchangeRates[currency] ?? 1;
  return rate > 0 ? amount / rate : amount;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
