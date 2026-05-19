"use client";

import { useEffect, useState } from "react";
import { ExpenseCategoryBadge } from "@/components/expenses/ExpenseCategoryBadge";
import {
  ExpenseFormFields,
  flushPendingExpenseFiles,
  type ExpenseFormValues,
} from "@/components/expenses/ExpenseFormFields";
import type { ExpenseCategoryRow } from "@/lib/expense-settings";
import { fetchExpenses } from "@/lib/expenses";

export type ExpenseFileRow = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt?: string;
};

export type ExpenseRow = {
  id: string;
  title: string;
  amount: string | number;
  currency: string;
  payMethod: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  comment?: string | null;
  category?: { id: string; name: string; color?: string | null; isActive?: boolean };
  supplier?: { id: string; name: string } | null;
  files?: ExpenseFileRow[];
};

type Props = {
  open: boolean;
  expense: ExpenseRow | null;
  categories: ExpenseCategoryRow[];
  isAdmin: boolean;
  onClose: () => void;
  onDelete: (id: string) => void | Promise<void>;
  onExpenseUpdated: (expense: ExpenseRow) => void;
  onExpensesRefresh: (expenses: ExpenseRow[]) => void;
  onCategoriesRefresh?: () => void | Promise<void>;
};

function statusBadge(status: ExpenseRow["status"]) {
  const label =
    status === "APPROVED"
      ? "Одобрен"
      : status === "SUBMITTED"
        ? "На проверке"
        : status === "REJECTED"
          ? "Отклонён"
          : "Черновик";
  const cls =
    status === "APPROVED"
      ? "badge-green"
      : status === "SUBMITTED"
        ? "badge-blue"
        : status === "REJECTED"
          ? "badge-red"
          : "badge-amber";
  return <span className={`badge ${cls}`}>{label}</span>;
}

function rowToForm(e: ExpenseRow): ExpenseFormValues {
  return {
    categoryId: e.category?.id ?? "",
    supplierId: e.supplier?.id ?? "",
    title: e.title,
    amount: String(e.amount),
    currency: e.currency,
    payMethod: e.payMethod,
    comment: e.comment ?? "",
  };
}

export function ExpenseDetailModal({
  open,
  expense,
  categories,
  isAdmin,
  onClose,
  onDelete,
  onExpenseUpdated,
  onExpensesRefresh,
  onCategoriesRefresh,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<ExpenseFormValues>(rowToForm(expense ?? ({} as ExpenseRow)));
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open || !expense) {
      setEditMode(false);
      return;
    }
    setEditMode(false);
    setForm(rowToForm(expense));
    setPendingFiles([]);
  }, [open, expense?.id]);

  if (!open || !expense) return null;
  const current = expense;
  const isDraft = expense.status === "DRAFT";

  async function refreshList() {
    const list = await fetchExpenses();
    onExpensesRefresh(list);
    const updated = list.find((e) => e.id === current.id) ?? null;
    if (updated) onExpenseUpdated(updated);
  }

  async function runAction(action: "submit" | "approve" | "reject") {
    const res = await fetch(`/api/expenses/${current.id}/${action}`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      alert("Не удалось изменить статус");
      return;
    }
    await refreshList();
  }

  async function handleSave() {
    const num = Number(form.amount);
    if (!form.categoryId || !form.title.trim() || !Number.isFinite(num)) {
      alert("Проверьте поля");
      return;
    }
    const res = await fetch(`/api/expenses/${current.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        amount: num,
        currency: form.currency,
        payMethod: form.payMethod,
        categoryId: form.categoryId,
        supplierId: form.supplierId || null,
        comment: form.comment.trim() || null,
      }),
    });
    if (!res.ok) {
      alert("Не удалось сохранить расход");
      return;
    }
    if (pendingFiles.length > 0) {
      await flushPendingExpenseFiles(current.id, pendingFiles);
      setPendingFiles([]);
    }
    const updated: ExpenseRow = await res.json();
    onExpenseUpdated(updated);
    setEditMode(false);
    await refreshList();
    await onCategoriesRefresh?.();
  }

  function startEdit() {
    setForm(rowToForm(current));
    setEditMode(true);
  }

  const payLabels: Record<string, string> = { bank: "Банк", usdt: "USDT", cash: "Кэш" };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setEditMode(false);
          onClose();
        }
      }}
    >
      <div className="card" style={{ width: 560, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div className="card-header">
          <span className="card-title">{editMode ? "Редактировать расход" : "Расход"}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {!editMode && isAdmin && (
              <button className="btn btn-secondary" style={{ color: "var(--red)" }} onClick={() => void onDelete(expense.id)}>
                Удалить
              </button>
            )}
            {!editMode && isDraft && (
              <button className="btn btn-secondary" onClick={startEdit}>
                Редактировать
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => {
                setEditMode(false);
                onClose();
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 14 }}>
          {editMode ? (
            <>
              <ExpenseFormFields
                categories={categories}
                values={form}
                onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                expenseId={current.id}
                existingFiles={current.files ?? []}
                canEditFiles={isDraft}
                onFilesChange={() => void refreshList()}
                onPendingFilesChange={setPendingFiles}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setEditMode(false)}>
                  Отмена
                </button>
                <button className="btn btn-primary" onClick={() => void handleSave()}>
                  Сохранить
                </button>
              </div>
            </>
          ) : (
            <>
              {expense.category ? (
                <div>
                  <div className="form-label">Категория</div>
                  <ExpenseCategoryBadge name={expense.category.name} color={expense.category.color} />
                </div>
              ) : null}
              {expense.supplier ? (
                <div>
                  <div className="form-label">Поставщик</div>
                  <div style={{ fontWeight: 500 }}>{expense.supplier.name}</div>
                </div>
              ) : null}
              <div>
                <div className="form-label">Название</div>
                <div style={{ fontWeight: 600 }}>{expense.title}</div>
              </div>
              <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div>
                  <div className="form-label">Сумма</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    {Number(expense.amount).toLocaleString()} {expense.currency}
                  </div>
                </div>
                <div>
                  <div className="form-label">Оплата</div>
                  <div style={{ color: "var(--text-secondary)" }}>{payLabels[expense.payMethod] ?? expense.payMethod}</div>
                </div>
                <div>
                  <div className="form-label">Статус</div>
                  {statusBadge(expense.status)}
                </div>
              </div>
              {expense.comment ? (
                <div>
                  <div className="form-label">Комментарий</div>
                  <div style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontSize: 14 }}>{expense.comment}</div>
                </div>
              ) : null}
              {(expense.files?.length ?? 0) > 0 ? (
                <div>
                  <div className="form-label">Файлы</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {expense.files!.map((f) => (
                      <a
                        key={f.id}
                        href={`/api/expenses/${expense.id}/files/${f.id}`}
                        style={{ fontSize: 13, color: "var(--accent)" }}
                      >
                        {f.fileName}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                {isDraft ? (
                  <button className="btn btn-primary" onClick={() => void runAction("submit")}>
                    Отправить на одобрение
                  </button>
                ) : null}
                {isAdmin && expense.status === "SUBMITTED" ? (
                  <>
                    <button className="btn btn-secondary" onClick={() => void runAction("reject")}>
                      Отклонить
                    </button>
                    <button className="btn btn-primary" onClick={() => void runAction("approve")}>
                      Одобрить
                    </button>
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
