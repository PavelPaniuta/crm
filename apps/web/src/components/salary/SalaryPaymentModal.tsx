"use client";

import { useEffect, useState } from "react";
import { CURRENCIES } from "@/lib/currencies";
import { SALARY_PAYMENT_TYPES } from "@/lib/salary-constants";

type Props = {
  open: boolean;
  userId: string | null;
  employeeName: string;
  orgId: string;
  period: string;
  defaultCurrency?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function SalaryPaymentModal({
  open,
  userId,
  employeeName,
  orgId,
  period,
  defaultCurrency = "USD",
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState({ amount: "", currency: defaultCurrency, type: "BASE", note: "", isPaid: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ amount: "", currency: defaultCurrency, type: "BASE", note: "", isPaid: false });
  }, [open, userId, defaultCurrency]);

  if (!open || !userId || !orgId) return null;

  async function handleSave() {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Укажите сумму выплаты");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/salary/payments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          organizationId: orgId,
          amount,
          currency: form.currency,
          period,
          type: form.type,
          note: form.note.trim() || undefined,
          isPaid: form.isPaid,
        }),
      });
      if (res.ok) {
        await onSaved();
        onClose();
      } else {
        const j = await res.json().catch(() => null);
        alert(j?.message || "Ошибка");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 75,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="card" style={{ width: 460, maxWidth: "100%" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="card-header" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="card-title">Добавить выплату</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
              {employeeName} · {period}
            </div>
          </div>
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10 }}>
            <div>
              <div className="form-label">Сумма *</div>
              <input
                className="form-input"
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
                autoFocus
              />
            </div>
            <div>
              <div className="form-label">Валюта</div>
              <select className="form-input" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="form-label">Тип выплаты</div>
            <select className="form-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {Object.entries(SALARY_PAYMENT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="form-label">Примечание</div>
            <input
              className="form-input"
              type="text"
              placeholder="Необязательно"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              padding: "12px 14px",
              borderRadius: 10,
              background: form.isPaid ? "rgba(5,150,105,0.08)" : "var(--bg-metric)",
              border: `1px solid ${form.isPaid ? "rgba(5,150,105,0.25)" : "var(--border-light)"}`,
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: 3 }}
              checked={form.isPaid}
              onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Уже выплачено</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>Отметьте, если деньги уже переданы сотруднику</div>
            </div>
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Добавление…" : "Добавить выплату"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
