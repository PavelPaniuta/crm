"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createExpenseCategoryApi,
  fetchExpenseCategories,
  updateExpenseCategoryApi,
  type ExpenseCategoryRow,
} from "@/lib/expense-settings";

export function ExpenseCategoriesSettingsCard() {
  const [rows, setRows] = useState<ExpenseCategoryRow[]>([]);
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { name: string; color: string }>>({});

  const load = useCallback(async () => {
    const list = await fetchExpenseCategories(false);
    setRows(list);
    setDrafts(
      Object.fromEntries(list.map((r) => [r.id, { name: r.name, color: r.color ?? "" }])),
    );
  }, []);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createExpenseCategoryApi(name);
      setNewName("");
      await load();
    } catch {
      alert("Не удалось добавить категорию");
    }
  }

  async function save(id: string) {
    const d = drafts[id];
    if (!d) return;
    try {
      await updateExpenseCategoryApi(id, { name: d.name, color: d.color.trim() || null });
      await load();
    } catch {
      alert("Не удалось сохранить");
    }
  }

  async function toggleActive(row: ExpenseCategoryRow) {
    try {
      await updateExpenseCategoryApi(row.id, { isActive: !row.isActive });
      await load();
    } catch {
      alert("Не удалось изменить статус");
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Категории расходов</span>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Обновить
        </button>
      </div>
      <div className="card-body" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="form-label">Новая категория</div>
            <input
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Например: Маркетинг"
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void add()} disabled={!newName.trim()}>
            Добавить
          </button>
        </div>
        <div className="table-scroll" style={{ border: "1px solid var(--border-light)", borderRadius: 12 }}>
          <table className="data-table">
            <thead style={{ background: "var(--bg-metric)" }}>
              <tr>
                <th>Название</th>
                <th style={{ width: 120 }}>Цвет (HEX)</th>
                <th style={{ width: 100 }}>Статус</th>
                <th style={{ width: 180 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = drafts[r.id];
                return (
                  <tr key={r.id} style={!r.isActive ? { opacity: 0.55 } : undefined}>
                    <td>
                      <input
                        className="form-input"
                        style={{ height: 32 }}
                        value={d?.name ?? r.name}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...(prev[r.id] ?? { name: r.name, color: r.color ?? "" }), name: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        style={{ height: 32, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                        value={d?.color ?? r.color ?? ""}
                        placeholder="#6366F1"
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...(prev[r.id] ?? { name: r.name, color: "" }), color: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      {r.isActive ? (
                        <span className="badge badge-green">Активна</span>
                      ) : (
                        <span className="badge badge-amber">Выкл</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => void save(r.id)}
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => void toggleActive(r)}
                        >
                          {r.isActive ? "Деактивировать" : "Активировать"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
