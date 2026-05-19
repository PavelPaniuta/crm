"use client";

import { useEffect, useState } from "react";
import { ClientCustomFieldsBlock } from "@/components/clients/ClientCustomFieldsBlock";
import {
  clientFormSectionStyle,
  createClientApi,
  emptyClientForm,
  parseClientLeadPaste,
  type ClientFieldDef,
  type ClientFormState,
  type ClientPipelineStatus,
} from "@/lib/clients";

type Props = {
  open: boolean;
  fieldDefs: ClientFieldDef[];
  statuses: ClientPipelineStatus[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

export function ClientCreateModal({ open, fieldDefs, statuses, onClose, onCreated }: Props) {
  const [form, setForm] = useState<ClientFormState>(() => emptyClientForm());
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [paste, setPaste] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyClientForm());
      setCustom({});
      setPaste("");
    }
  }, [open]);

  if (!open) return null;

  function reset() {
    setForm(emptyClientForm());
    setCustom({});
    setPaste("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function applyPaste() {
    setForm((f) => ({ ...f, ...parseClientLeadPaste(paste) }));
  }

  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) return alert("Укажите имя и телефон");
    try {
      await createClientApi(form, fieldDefs, custom);
      reset();
      onClose();
      await onCreated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось создать клиента");
    }
  }

  const setCustomField = (key: string, value: string) => setCustom((m) => ({ ...m, [key]: value }));

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 55,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="card" style={{ width: 640, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", margin: 0 }}>
        <div className="card-header" style={{ alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="card-title">Новый клиент</span>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.45 }}>
              Вставьте текст из бота или заполните поля вручную
            </div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Закрыть
          </button>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 18 }}>
          <div style={clientFormSectionStyle(true)}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
              }}
            >
              Из Telegram / бота
            </div>
            <div className="form-label">Вставьте целиком сообщение</div>
            <textarea
              className="form-input"
              rows={4}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Строки «Клиент:», «Телефон:», «Банк:», «Ассистент:», Summary, время звонка…"
              style={{ resize: "vertical", minHeight: 80 }}
            />
            <button type="button" className="btn btn-secondary" style={{ justifySelf: "start" }} onClick={applyPaste}>
              Разобрать текст и подставить в форму
            </button>
          </div>

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
              Обязательно
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              <div>
                <div className="form-label">Имя клиента *</div>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Как в CRM"
                />
              </div>
              <div>
                <div className="form-label">Телефон *</div>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+48 …"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>
              <div>
                <div className="form-label">Статус воронки</div>
                <select
                  className="form-input"
                  value={form.statusId}
                  onChange={(e) => setForm((f) => ({ ...f, statusId: e.target.value }))}
                >
                  <option value="">Авто — первый статус в списке</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

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
              Данные звонка / лида
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              <div>
                <div className="form-label">Банк</div>
                <input
                  className="form-input"
                  value={form.bank}
                  onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))}
                  placeholder="PKO BP, …"
                />
              </div>
              <div>
                <div className="form-label">Ассистент</div>
                <input
                  className="form-input"
                  value={form.assistantName}
                  onChange={(e) => setForm((f) => ({ ...f, assistantName: e.target.value }))}
                  placeholder="Кто вёл линию"
                />
              </div>
              <div>
                <div className="form-label">Начало звонка</div>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={form.callStartedAt}
                  onChange={(e) => setForm((f) => ({ ...f, callStartedAt: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <div className="form-label">Итог разговора (summary)</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
                Текст из бота или кратко своими словами
              </div>
              <textarea
                className="form-input"
                rows={4}
                value={form.callSummary}
                onChange={(e) => setForm((f) => ({ ...f, callSummary: e.target.value }))}
                style={{ resize: "vertical", minHeight: 88 }}
              />
            </div>
          </div>

          <div style={clientFormSectionStyle(true)}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
              }}
            >
              Только для офиса
            </div>
            <div>
              <div className="form-label">Внутренняя заметка</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
                Не для карточки из бота; видят сотрудники CRM
              </div>
              <input
                className="form-input"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Напоминание менеджеру"
              />
            </div>
          </div>

          {fieldDefs.length > 0 ? (
            <ClientCustomFieldsBlock fieldDefs={fieldDefs} values={custom} onChange={setCustomField} />
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              paddingTop: 8,
              borderTop: "1px solid var(--border-light)",
              flexWrap: "wrap",
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void submit()}
              disabled={!form.name.trim() || !form.phone.trim()}
            >
              Создать клиента
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
