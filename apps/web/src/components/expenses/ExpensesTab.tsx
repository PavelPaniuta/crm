"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExpenseDetailModal, type ExpenseRow } from "@/components/expenses/ExpenseDetailModal";
import { ExpenseCategoryBadge } from "@/components/expenses/ExpenseCategoryBadge";
import {
  ExpenseFormFields,
  flushPendingExpenseFiles,
  type ExpenseFormValues,
} from "@/components/expenses/ExpenseFormFields";
import { fetchExpenseCategories, type ExpenseCategoryRow } from "@/lib/expense-settings";
import { amountToUsd, createExpenseApi, deleteExpenseApi } from "@/lib/expenses";

const emptyForm = (): ExpenseFormValues => ({
  categoryId: "",
  supplierId: "",
  title: "",
  amount: "",
  currency: "PLN",
  payMethod: "bank",
  comment: "",
});

type Props = {
  isAdmin: boolean;
  exchangeRates: Record<string, number>;
  expenses: ExpenseRow[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  onExpensesChange: (expenses: ExpenseRow[]) => void;
};

export function ExpensesTab({
  isAdmin,
  exchangeRates,
  expenses,
  loading,
  onRefresh,
  onExpensesChange,
}: Props) {
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [form, setForm] = useState<ExpenseFormValues>(emptyForm);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [creating, setCreating] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const list = await fetchExpenseCategories(true);
      setCategories(list);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const toUsd = (amount: number, currency: string) => amountToUsd(amount, currency, exchangeRates);

  const filteredExpenses = useMemo(() => {
    if (categoryFilter === "all") return expenses;
    return expenses.filter((e) => e.category?.id === categoryFilter);
  }, [expenses, categoryFilter]);

  const byCurrency: Record<string, number> = {};
  for (const e of expenses) {
    byCurrency[e.currency] = (byCurrency[e.currency] ?? 0) + Number(e.amount);
  }
  const totalUsd = Object.entries(byCurrency).reduce((s, [cur, amt]) => s + toUsd(amt, cur), 0);

  function patchForm(patch: Partial<ExpenseFormValues>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function createExpense() {
    const amount = Number(form.amount);
    if (!form.categoryId) return alert("Выберите категорию");
    if (!form.title.trim()) return alert("Укажите название");
    if (!Number.isFinite(amount)) return alert("Некорректная сумма");
    setCreating(true);
    try {
      const created = await createExpenseApi({
        title: form.title.trim(),
        amount,
        currency: form.currency,
        payMethod: form.payMethod,
        categoryId: form.categoryId,
        supplierId: form.supplierId || null,
        comment: form.comment.trim() || null,
      });
      if (pendingFiles.length > 0) {
        await flushPendingExpenseFiles(created.id, pendingFiles);
      }
      setForm(emptyForm());
      setPendingFiles([]);
      await onRefresh();
    } catch {
      alert("Не удалось создать расход");
    } finally {
      setCreating(false);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Удалить расход?")) return;
    try {
      await deleteExpenseApi(id);
      onExpensesChange(expenses.filter((e) => e.id !== id));
      setModalOpen(false);
      setEditing(null);
    } catch {
      alert("Не удалось удалить расход");
    }
  }

  const canCreate =
    !!form.categoryId && !!form.title.trim() && !!form.amount && Number.isFinite(Number(form.amount));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-title">Расходы</div>
          <div className="page-header-sub">Учёт расходов офиса: аренда, крипта, материалы</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Новый расход</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void createExpense()}
            disabled={!canCreate || creating}
          >
            {creating ? "Создание…" : "+ Создать"}
          </button>
        </div>
        <div className="card-body">
          <ExpenseFormFields
            categories={categories}
            values={form}
            onChange={patchForm}
            onPendingFilesChange={setPendingFiles}
          />
        </div>
      </div>

      {isAdmin && expenses.length > 0 ? (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Итого по валютам</span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              ≈ {totalUsd.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} USD
            </span>
          </div>
          <div className="card-body" style={{ padding: "10px 16px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {Object.entries(byCurrency).map(([cur, amt]) => (
                <div
                  key={cur}
                  style={{ background: "var(--bg-metric)", borderRadius: 10, padding: "8px 14px", minWidth: 110 }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>{cur}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16 }}>
                    {amt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} {cur}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
          <span className="card-title">Расходы</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="form-input"
              style={{ height: 34, minWidth: 160, fontSize: 13 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Все категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={() => void onRefresh()}>
              Обновить
            </button>
          </div>
        </div>
        <div className="card-body table-scroll" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Категория</th>
                <th>Название</th>
                <th>Поставщик</th>
                <th>Статус</th>
                <th style={{ textAlign: "right" }}>Сумма</th>
                {isAdmin ? <th style={{ width: 40 }}></th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ padding: 24, color: "var(--text-secondary)" }}>
                    Загрузка...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5}>
                    <div className="empty-state">
                      <div className="empty-state-title">Нет расходов</div>
                      <div className="empty-state-desc">Добавьте первый расход используя форму выше</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr
                    key={e.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setEditing(e);
                      setModalOpen(true);
                    }}
                  >
                    <td>
                      {e.category ? (
                        <ExpenseCategoryBadge name={e.category.name} color={e.category.color} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{e.title}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{e.supplier?.name ?? "—"}</td>
                    <td>
                      <span
                        className={`badge ${
                          e.status === "APPROVED"
                            ? "badge-green"
                            : e.status === "SUBMITTED"
                              ? "badge-blue"
                              : e.status === "REJECTED"
                                ? "badge-red"
                                : "badge-amber"
                        }`}
                      >
                        {e.status === "APPROVED"
                          ? "Одобрен"
                          : e.status === "SUBMITTED"
                            ? "На проверке"
                            : e.status === "REJECTED"
                              ? "Отклонён"
                              : "Черновик"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      {Number(e.amount).toLocaleString()} {e.currency}
                    </td>
                    {isAdmin ? (
                      <td style={{ width: 40, padding: "0 8px 0 0" }}>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            void deleteExpense(e.id);
                          }}
                          className="btn btn-ghost"
                          style={{ width: 28, height: 28, padding: 0, color: "var(--text-tertiary)" }}
                          title="Удалить"
                        >
                          ×
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpenseDetailModal
        open={modalOpen && !!editing}
        expense={editing}
        categories={categories}
        isAdmin={isAdmin}
        onClose={() => setModalOpen(false)}
        onDelete={deleteExpense}
        onExpenseUpdated={(e) => {
          onExpensesChange(expenses.map((x) => (x.id === e.id ? e : x)));
          setEditing(e);
        }}
        onExpensesRefresh={(list) => {
          onExpensesChange(list);
          setEditing((prev) => (prev ? (list.find((e) => e.id === prev.id) ?? prev) : null));
        }}
        onCategoriesRefresh={loadCategories}
      />
    </div>
  );
}
