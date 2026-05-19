export type ExpenseCategoryRow = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type ExpenseSupplierRow = {
  id: string;
  name: string;
  isActive: boolean;
  categoryId: string;
  category?: { id: string; name: string; isActive: boolean };
};

export async function fetchExpenseCategories(activeOnly?: boolean): Promise<ExpenseCategoryRow[]> {
  const q = activeOnly ? "?activeOnly=1" : "";
  const res = await fetch(`/api/expense-categories${q}`, { credentials: "include" });
  if (!res.ok) throw new Error("load_failed");
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

export async function fetchExpenseSuppliers(opts?: {
  categoryId?: string;
  activeOnly?: boolean;
}): Promise<ExpenseSupplierRow[]> {
  const params = new URLSearchParams();
  if (opts?.categoryId) params.set("categoryId", opts.categoryId);
  if (opts?.activeOnly === false) params.set("activeOnly", "false");
  else if (opts?.activeOnly) params.set("activeOnly", "true");
  const q = params.toString();
  const res = await fetch(`/api/expense-suppliers${q ? `?${q}` : ""}`, { credentials: "include" });
  if (!res.ok) throw new Error("load_failed");
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

export async function createExpenseCategoryApi(name: string, color?: string): Promise<ExpenseCategoryRow> {
  const res = await fetch("/api/expense-categories", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color: color || null }),
  });
  if (!res.ok) throw new Error("create_failed");
  return res.json();
}

export async function updateExpenseCategoryApi(
  id: string,
  body: Partial<{ name: string; color: string | null; isActive: boolean }>,
): Promise<void> {
  const res = await fetch(`/api/expense-categories/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("update_failed");
}

export async function createExpenseSupplierApi(categoryId: string, name: string): Promise<ExpenseSupplierRow> {
  const res = await fetch("/api/expense-suppliers", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId, name }),
  });
  if (!res.ok) throw new Error("create_failed");
  return res.json();
}

export async function updateExpenseSupplierApi(
  id: string,
  body: Partial<{ name: string; isActive: boolean }>,
): Promise<void> {
  const res = await fetch(`/api/expense-suppliers/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("update_failed");
}

export async function resolveDefaultCategoryId(): Promise<string> {
  const cats = await fetchExpenseCategories(true);
  const other = cats.find((c) => c.name === "Другое");
  if (other) return other.id;
  if (cats[0]) return cats[0].id;
  throw new Error("no_categories");
}
