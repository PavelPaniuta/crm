"use client";

type Props = {
  name: string;
  pct: string;
  onNameChange: (name: string) => void;
  onPctChange: (pct: string) => void;
  onSave: () => void | Promise<void>;
};

export function OfficeInfoSettingsCard({ name, pct, onNameChange, onPctChange, onSave }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Партнёр «Инфо»</span>
      </div>
      <div className="card-body" style={{ display: "grid", gap: 12 }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          Процент от <b>ЗП фонда</b> (после посредника, ОЛХ и ИИ). Доли менеджеров — после вычета Инфо.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, alignItems: "end" }}>
          <div>
            <div className="form-label">Название</div>
            <input className="form-input" value={name} onChange={(e) => onNameChange(e.target.value)} />
          </div>
          <div>
            <div className="form-label">% от фонда</div>
            <input className="form-input" type="number" min={0} max={100} step="0.01" value={pct} onChange={(e) => onPctChange(e.target.value)} placeholder="5" />
          </div>
        </div>
        <div>
          <button type="button" className="btn btn-primary" onClick={() => void onSave()}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

