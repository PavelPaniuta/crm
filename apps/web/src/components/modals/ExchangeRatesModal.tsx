"use client";

import { useEffect, useState } from "react";
import { CURRENCIES, CURRENCY_META } from "@/lib/currencies";

type Props = {
  open: boolean;
  exchangeRates: Record<string, number>;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function ExchangeRatesModal({ open, exchangeRates, onClose, onSaved }: Props) {
  const [ratesEditing, setRatesEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    for (const c of CURRENCIES) init[c] = String(exchangeRates[c] ?? "");
    setRatesEditing(init);
  }, [open, exchangeRates]);

  if (!open) return null;

  async function handleSave() {
    for (const code of CURRENCIES) {
      const raw = ratesEditing[code];
      if (raw === undefined) continue;
      const val = Number(raw);
      if (!Number.isFinite(val) || val <= 0) {
        alert(`Некорректный курс для ${code}`);
        return;
      }
    }
    setSaving(true);
    try {
      for (const code of CURRENCIES) {
        const raw = ratesEditing[code];
        if (raw === undefined) continue;
        const val = Number(raw);
        await fetch(`/api/exchange-rates/${code}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rateToUsd: val,
            symbol: CURRENCY_META[code]?.symbol,
            name: CURRENCY_META[code]?.name,
          }),
        });
      }
      await onSaved();
      onClose();
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
        zIndex: 70,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="card" style={{ width: 420, maxWidth: "100%" }}>
        <div className="card-header">
          <span className="card-title">Курсы валют (к USD)</span>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            ✕
          </button>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
            Укажите сколько единиц каждой валюты равно 1 USD.
            <br />
            Пример: 1 USD = 41.5 UAH → значение для UAH = 41.5
          </div>
          {CURRENCIES.map((c) => (
            <div key={c} style={{ display: "grid", gridTemplateColumns: "60px 1fr", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>
                {CURRENCY_META[c]?.symbol} {c}
              </div>
              <input
                className="form-input"
                type="number"
                min={0}
                step="any"
                value={ratesEditing[c] ?? ""}
                onChange={(e) => setRatesEditing((p) => ({ ...p, [c]: e.target.value }))}
                placeholder={String(exchangeRates[c] ?? "")}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
                disabled={saving}
              />
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
