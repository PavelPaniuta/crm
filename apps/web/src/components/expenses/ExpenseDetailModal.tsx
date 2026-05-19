"use client";

import { useEffect, useState } from "react";
import { CURRENCIES } from "@/lib/currencies";

export type ExpenseRow = {
  id: string;
  title: string;
  amount: string | number;
  currency: string;
  payMethod: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
};

type Props = {
  open: boolean;
  expense: ExpenseRow | null;
  isAdmin: boolean;
  onClose: () => void;
  onDelete: (id: string) => void | Promise<void>;
  onExpenseUpdated: (expense: ExpenseRow) => void;
  onExpensesRefresh: (expenses: ExpenseRow[]) => void;
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

export function ExpenseDetailModal({
  open,
  expense,
  isAdmin,
  onClose,
  onDelete,
  onExpenseUpdated,
  onExpensesRefresh,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PLN");
  const [payMethod, setPayMethod] = useState("bank");

  useEffect(() => {
    if (!open || !expense) {
      setEditMode(false);
      return;
    }
    setEditMode(false);
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setCurrency(expense.currency);
    setPayMethod(expense.payMethod);
  }, [open, expense?.id]);

  if (!open || !expense) return null;
  const current = expense;

  async function runAction(action: "submit" | "approve" | "reject") {
    const res = await fetch(`/api/expenses/${current.id}/${action}`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      alert("Не удалось изменить статус");
      return;
    }
    const list: ExpenseRow[] = await fetch("/api/expenses", { credentials: "include" }).then((r) => r.json());
    onExpensesRefresh(list);
    const updated = list.find((e) => e.id === current.id) ?? null;
    if (updated) onExpenseUpdated(updated);
  }

  async function handleSave() {
    const num = Number(amount);
    if (!Number.isFinite(num) || !title.trim()) {
      alert("Проверьте поля");
      return;
    }
    const res = await fetch(`/api/expenses/${current.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, amount: num, currency, payMethod }),
    });
    if (!res.ok) {
      alert("Не удалось сохранить расход");
      return;
    }
    const updated: ExpenseRow = await res.json();
    onExpenseUpdated(updated);
    setEditMode(false);
  }

  function startEdit() {
    setTitle(current.title);
    setAmount(String(current.amount));
    setCurrency(current.currency);
    setPayMethod(current.payMethod);
    setEditMode(true);
  }

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
      <div className="card" style={{ width: 520, maxWidth: "100%" }}>
        <div className="card-header">
          <span className="card-title">{editMode ? "Редактировать расход" : "Расход"}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {!editMode && isAdmin && (
              <button className="btn btn-secondary" style={{ color: "var(--red)" }} onClick={() => void onDelete(expense.id)}>
                Удалить
              </button>
            )}
            {!editMode && expense.status === "DRAFT" && (
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
              <div>
                <div className="form-label">Название</div>
                <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px", gap: 12 }}>
                <div>
                  <div className="form-label">Сумма</div>
                  <input
                    className="form-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
                <div>
                  <div className="form-label">Валюта</div>
                  <select className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="form-label">Оплата</div>
                  <select className="form-input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option value="bank">Банк</option>
                    <option value="usdt">USDT</option>
                    <option value="cash">Кэш</option>
                  </select>
                </div>
              </div>
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
                  <div style={{ color: "var(--text-secondary)" }}>{expense.payMethod}</div>
                </div>
                <div>
                  <div className="form-label">Статус</div>
                  {statusBadge(expense.status)}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                {expense.status === "DRAFT" ? (
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
