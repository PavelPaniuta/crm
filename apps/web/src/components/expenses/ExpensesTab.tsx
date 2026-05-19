"use client";

import { useState } from "react";
import { ExpenseDetailModal, type ExpenseRow } from "@/components/expenses/ExpenseDetailModal";
import { CURRENCIES, CURRENCY_META } from "@/lib/currencies";
import { amountToUsd, createExpenseApi, deleteExpenseApi } from "@/lib/expenses";

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
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState("PLN");
  const [newPayMethod, setNewPayMethod] = useState("bank");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const toUsd = (amount: number, currency: string) => amountToUsd(amount, currency, exchangeRates);

  async function createExpense() {
    const amount = Number(newAmount);
    if (!Number.isFinite(amount)) return alert("Некорректная сумма");
    try {
      await createExpenseApi({
        title: newTitle,
        amount,
        currency: newCurrency,
        payMethod: newPayMethod,
      });
      setNewTitle("");
      setNewAmount("");
      await onRefresh();
    } catch {
      alert("Не удалось создать расход");
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

  const byCurrency: Record<string, number> = {};
  for (const e of expenses) {
    byCurrency[e.currency] = (byCurrency[e.currency] ?? 0) + Number(e.amount);
  }
  const totalUsd = Object.entries(byCurrency).reduce((s, [cur, amt]) => s + toUsd(amt, cur), 0);

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
            disabled={!newTitle || !newAmount}
          >
            + Создать
          </button>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          <div>
            <div className="form-label">Название</div>
            <input className="form-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 120px 140px" }}>
            <div>
              <div className="form-label">Сумма</div>
              <input className="form-input" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
            </div>
            <div>
              <div className="form-label">Валюта</div>
              <select className="form-input" value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="form-label">Оплата</div>
              <select className="form-input" value={newPayMethod} onChange={(e) => setNewPayMethod(e.target.value)}>
                <option value="bank">Банк</option>
                <option value="usdt">USDT</option>
                <option value="cash">Кэш</option>
              </select>
            </div>
          </div>
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
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>
                    {CURRENCY_META[cur]?.name ?? cur}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16 }}>
                    {CURRENCY_META[cur]?.symbol ?? ""}
                    {amt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    ≈ {toUsd(amt, cur).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} USD
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Расходы</span>
          <button type="button" className="btn btn-secondary" onClick={() => void onRefresh()}>
            Обновить
          </button>
        </div>
        <div className="card-body table-scroll" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Статус</th>
                <th style={{ textAlign: "right" }}>Сумма</th>
                {isAdmin ? <th style={{ width: 40 }}></th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} style={{ padding: 24, color: "var(--text-secondary)" }}>
                    Загрузка...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <svg width="22" height="22" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <path d="M2 10h20" />
                        </svg>
                      </div>
                      <div className="empty-state-title">Нет расходов</div>
                      <div className="empty-state-desc">Добавьте первый расход используя форму выше</div>
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr
                    key={e.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setEditing(e);
                      setModalOpen(true);
                    }}
                  >
                    <td style={{ fontWeight: 500 }}>{e.title}</td>
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
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <polyline points="3,6 5,6 21,6" />
                            <path d="M19,6l-1,14H6L5,6" />
                            <path d="M10,11v6M14,11v6" />
                            <path d="M9,6V4h6v2" />
                          </svg>
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
      />
    </div>
  );
}
