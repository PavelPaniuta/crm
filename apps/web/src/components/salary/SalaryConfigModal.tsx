"use client";

import { useEffect, useState } from "react";
import { CURRENCIES, CURRENCY_META } from "@/lib/currencies";
import { SALARY_PAY_DAY_PRESETS } from "@/lib/salary-constants";

type InitialConfig = {
  baseAmount?: unknown;
  currency?: string;
  payDay?: number;
  note?: string | null;
} | null;

type Props = {
  open: boolean;
  userId: string | null;
  employeeName: string;
  initialConfig?: InitialConfig;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function SalaryConfigModal({ open, userId, employeeName, initialConfig, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ baseAmount: "", currency: "USD", payDay: "1", note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cfg = initialConfig;
    setForm({
      baseAmount: cfg?.baseAmount != null && cfg.baseAmount !== "" ? String(cfg.baseAmount) : "",
      currency: cfg?.currency ?? "USD",
      payDay: cfg?.payDay != null ? String(cfg.payDay) : "1",
      note: cfg?.note ?? "",
    });
  }, [open, initialConfig, userId]);

  if (!open || !userId) return null;

  async function handleSave() {
    const baseAmount = Number(form.baseAmount);
    const payDay = Number(form.payDay);
    if (!Number.isFinite(baseAmount) || baseAmount < 0) {
      alert("Укажите корректную базовую ставку");
      return;
    }
    if (!Number.isFinite(payDay) || payDay < 1 || payDay > 31) {
      alert("День выплаты должен быть от 1 до 31");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/salary/config/${userId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseAmount,
          currency: form.currency,
          payDay,
          note: form.note.trim() || undefined,
        }),
      });
      if (res.ok) {
        await onSaved();
        onClose();
      } else {
        const j = await res.json().catch(() => null);
        alert(j?.message || "Ошибка сохранения");
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
      <div
        className="card"
        style={{ width: 500, maxWidth: "100%", maxHeight: "min(92vh, 720px)", overflow: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="card-header" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="card-title">Настройка зарплаты</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4, fontWeight: 500 }}>{employeeName}</div>
          </div>
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 20 }}>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--bg-metric)",
              border: "1px solid var(--border-light)",
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Укажите фиксированную ставку в месяц и день выплаты. Бонусы по сделкам начисляются отдельно в разделе «Зарплата».
          </div>
          <div>
            <div className="form-label">Базовая ставка в месяц *</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
              <input
                className="form-input"
                type="number"
                min={0}
                step="any"
                placeholder="Например, 1500"
                value={form.baseAmount}
                onChange={(e) => setForm((f) => ({ ...f, baseAmount: e.target.value }))}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 600 }}
                autoFocus
              />
              <select className="form-input" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c} {CURRENCY_META[c]?.symbol ? `(${CURRENCY_META[c].symbol})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="form-label">День выплаты зарплаты *</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="form-input"
                type="number"
                min={1}
                max={31}
                value={form.payDay}
                onChange={(e) => setForm((f) => ({ ...f, payDay: e.target.value }))}
                style={{ width: 88, textAlign: "center", fontWeight: 700 }}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>число месяца (1–31)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {SALARY_PAY_DAY_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: "4px 12px",
                    fontSize: 12,
                    borderColor: String(form.payDay) === String(d) ? "var(--accent)" : undefined,
                    background: String(form.payDay) === String(d) ? "var(--accent-light)" : undefined,
                    color: String(form.payDay) === String(d) ? "var(--accent)" : undefined,
                  }}
                  onClick={() => setForm((f) => ({ ...f, payDay: String(d) }))}
                >
                  {d === 31 ? "31 (конец)" : `${d}-е`}
                </button>
              ))}
            </div>
            {Number(form.payDay) >= 1 && Number(form.payDay) <= 31 && (
              <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 8, fontWeight: 500 }}>
                Выплата каждый месяц {form.payDay}-го числа
              </div>
            )}
          </div>
          <div>
            <div className="form-label">Примечание</div>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Необязательно: условия, график, комментарий для бухгалтерии"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              style={{ resize: "vertical", minHeight: 64 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4, borderTop: "1px solid var(--border-light)" }}>
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Сохранение…" : "Сохранить ставку"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
