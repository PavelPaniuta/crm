"use client";

import { useEffect, useState } from "react";
import { ClientCustomFieldsBlock } from "@/components/clients/ClientCustomFieldsBlock";
import {
  clientFormFromEntity,
  clientFormSectionStyle,
  customFieldsFromEntity,
  emptyClientForm,
  updateClientApi,
  type ClientFieldDef,
  type ClientFormState,
  type ClientListItem,
  type ClientPipelineStatus,
} from "@/lib/clients";

type Props = {
  client: ClientListItem | null;
  fieldDefs: ClientFieldDef[];
  statuses: ClientPipelineStatus[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function ClientEditModal({ client, fieldDefs, statuses, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ClientFormState>(() => emptyClientForm());
  const [custom, setCustom] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!client) return;
    setForm(clientFormFromEntity(client));
    setCustom(customFieldsFromEntity(client, fieldDefs));
  }, [client, fieldDefs]);

  if (!client) return null;

  const setCustomField = (key: string, value: string) => setCustom((m) => ({ ...m, [key]: value }));

  async function submit() {
    if (!client) return;
    if (!form.name.trim() || !form.phone.trim()) return alert("Укажите имя и телефон");
    try {
      await updateClientApi(client.id, form, fieldDefs, custom);
      onClose();
      await onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось обновить клиента");
    }
  }

  return (
    <div
      className="modal-backdrop"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card" style={{ width: 580, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div className="card-header" style={{ alignItems: "flex-start" }}>
          <div>
            <span className="card-title">Редактирование клиента</span>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Блоки ниже совпадают с формой создания</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 16 }}>
          <div style={clientFormSectionStyle()}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Основное</div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <div className="form-label">Имя *</div>
                <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <div className="form-label">Телефон *</div>
                <input className="form-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={{ fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
            </div>
            <div>
              <div className="form-label">Статус воронки</div>
              <select className="form-input" value={form.statusId} onChange={(e) => setForm((f) => ({ ...f, statusId: e.target.value }))}>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={clientFormSectionStyle()}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Звонок / лид</div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <div className="form-label">Банк</div>
                <input className="form-input" value={form.bank} onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))} />
              </div>
              <div>
                <div className="form-label">Ассистент</div>
                <input className="form-input" value={form.assistantName} onChange={(e) => setForm((f) => ({ ...f, assistantName: e.target.value }))} />
              </div>
            </div>
            <div>
              <div className="form-label">Начало звонка</div>
              <input className="form-input" type="datetime-local" value={form.callStartedAt} onChange={(e) => setForm((f) => ({ ...f, callStartedAt: e.target.value }))} />
            </div>
            <div>
              <div className="form-label">Итог разговора</div>
              <textarea className="form-input" rows={4} value={form.callSummary} onChange={(e) => setForm((f) => ({ ...f, callSummary: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
          </div>
          <div style={clientFormSectionStyle(true)}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Только для офиса</div>
            <div>
              <div className="form-label">Внутренняя заметка</div>
              <input className="form-input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <ClientCustomFieldsBlock fieldDefs={fieldDefs} values={custom} onChange={setCustomField} emptySelectLabel="—" />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
            <button type="button" className="btn btn-primary" onClick={() => void submit()}>Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  );
}
