"use client";

import type { DealTemplate } from "@/lib/deals";

type Props = {
  templates: DealTemplate[];
  onCreate: () => void;
  onEdit: (tpl: DealTemplate) => void;
  onDelete: (id: string, name: string) => void;
};

export function DealTemplatesSettingsCard({ templates, onCreate, onEdit, onDelete }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Шаблоны сделок</span>
        <button type="button" className="btn btn-primary" onClick={onCreate}>+ Новый шаблон</button>
      </div>
      <div className="card-body" style={{ display: "grid", gap: 10 }}>
        {templates.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", fontSize: 13, padding: "8px 0" }}>
            Нет шаблонов. Создайте свой первый шаблон чтобы использовать кастомные поля в сделках.
          </div>
        ) : (
          <div className="card" style={{ border: "1px solid var(--border-light)" }}>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Полей</th>
                    <th>Воркеры</th>
                    <th style={{ width: 160 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{t.fields.length}</td>
                      <td>
                        {t.hasWorkers ? (
                          <span className="badge badge-green">Да</span>
                        ) : (
                          <span className="badge badge-amber">Нет</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            onClick={() => onEdit(t)}
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                            onClick={() => onDelete(t.id, t.name)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
