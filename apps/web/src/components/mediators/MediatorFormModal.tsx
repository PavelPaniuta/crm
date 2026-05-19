"use client";

export type MediatorFormState = {
  name: string;
  phone: string;
  note: string;
  defaultPct: string;
};

type Props = {
  open: boolean;
  editingId: string | null;
  form: MediatorFormState;
  setForm: React.Dispatch<React.SetStateAction<MediatorFormState>>;
  onClose: () => void;
  onSave: () => void | Promise<void>;
};

export function MediatorFormModal({ open, editingId, form, setForm, onClose, onSave }: Props) {
  if (!open) return null;
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card" style={{ width: 440, maxWidth: "100%" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">{editingId ? "Редактировать посредника" : "Новый посредник"}</span>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          <div>
            <div className="form-label">Имя *</div>
            <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <div className="form-label">Телефон</div>
            <input className="form-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <div className="form-label">% по умолчанию</div>
            <input
              className="form-input"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.defaultPct}
              onChange={(e) => setForm((f) => ({ ...f, defaultPct: e.target.value }))}
              placeholder="для подстановки в сделку"
            />
          </div>
          <div>
            <div className="form-label">Заметка</div>
            <textarea className="form-input" rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void onSave()}>
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
