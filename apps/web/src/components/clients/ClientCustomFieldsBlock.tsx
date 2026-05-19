"use client";

import {
  CLIENT_FIELD_TYPE_LABELS,
  clientFormSectionStyle,
  type ClientFieldDef,
} from "@/lib/clients";

type Props = {
  fieldDefs: ClientFieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  emptySelectLabel?: string;
};

export function ClientCustomFieldsBlock({
  fieldDefs,
  values,
  onChange,
  emptySelectLabel = "Выберите…",
}: Props) {
  if (fieldDefs.length === 0) return null;

  return (
    <div style={clientFormSectionStyle()}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        Дополнительные поля
      </div>
      <div
        style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
      >
        {fieldDefs.map((def) => (
          <div
            key={def.id}
            style={{ paddingBottom: 12, borderBottom: "1px dashed var(--border-light)" }}
          >
            <div className="form-label">
              {def.label}
              {def.required ? " *" : ""}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
              {CLIENT_FIELD_TYPE_LABELS[def.type]}
            </div>
            {def.type === "CHECKBOX" ? (
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={values[def.key] === "true"}
                  onChange={(e) => onChange(def.key, e.target.checked ? "true" : "")}
                />
                <span style={{ fontSize: 13 }}>Да</span>
              </label>
            ) : def.type === "SELECT" && def.options ? (
              <select
                className="form-input"
                value={values[def.key] ?? ""}
                onChange={(e) => onChange(def.key, e.target.value)}
              >
                <option value="">{emptySelectLabel}</option>
                {def.options
                  .split(/[\n,]/)
                  .map((o) => o.trim())
                  .filter(Boolean)
                  .map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                className="form-input"
                type={
                  def.type === "NUMBER" || def.type === "PERCENT" || def.type === "CURRENCY"
                    ? "text"
                    : def.type === "DATE"
                      ? "date"
                      : "text"
                }
                value={values[def.key] ?? ""}
                onChange={(e) => onChange(def.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
