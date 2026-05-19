"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createExpenseSupplierApi,
  fetchExpenseCategories,
  fetchExpenseSuppliers,
  updateExpenseSupplierApi,
  type ExpenseCategoryRow,
  type ExpenseSupplierRow,
} from "@/lib/expense-settings";

export function ExpenseSuppliersSettingsCard() {
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [rows, setRows] = useState<ExpenseSupplierRow[]>([]);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newName, setNewName] = useState("");
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  const loadCategories = useCallback(async () => {
    const list = await fetchExpenseCategories(false);
    setCategories(list);
    if (!newCategoryId && list[0]) setNewCategoryId(list[0].id);
  }, [newCategoryId]);

  const loadSuppliers = useCallback(async () => {
    const list = await fetchExpenseSuppliers({
      categoryId: filterCategoryId === "all" ? undefined : filterCategoryId,
      activeOnly: false,
    });
    setRows(list);
    setNameDrafts(Object.fromEntries(list.map((r) => [r.id, r.name])));
  }, [filterCategoryId]);

  useEffect(() => {
    void loadCategories().catch(() => {});
  }, [loadCategories]);

  useEffect(() => {
    void loadSuppliers().catch(() => {});
  }, [loadSuppliers]);

  async function add() {
    const name = newName.trim();
    if (!name || !newCategoryId) return;
    try {
      await createExpenseSupplierApi(newCategoryId, name);
      setNewName("");
      await loadSuppliers();
    } catch {
      alert("Не удалось добавить поставщика");
    }
  }

  async function save(id: string) {
    const name = nameDrafts[id]?.trim();
    if (!name) return;
    try {
      await updateExpenseSupplierApi(id, { name });
      await loadSuppliers();
    } catch {
      alert("Не удалось сохранить");
    }
  }

  async function toggleActive(row: ExpenseSupplierRow) {
    try {
      await updateExpenseSupplierApi(row.id, { isActive: !row.isActive });
      await loadSuppliers();
    } catch {
      alert("Не удалось изменить статус");
    }
  }

  const activeCategories = categories.filter((c) => c.isActive);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Поставщики</span>
        <button type="button" className="btn btn-secondary" onClick={() => void loadSuppliers()}>
          Обновить
        </button>
      </div>
      <div className="card-body" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div className="form-label">Фильтр по категории</div>
            <select
              className="form-input"
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              style={{ minWidth: 180 }}
            >
              <option value="all">Все категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.isActive ? " (выкл)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 160 }}>
            <div className="form-label">Категория</div>
            <select
              className="form-input"
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
            >
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="form-label">Новый поставщик</div>
            <input
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Например: AWS"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void add()}
            disabled={!newName.trim() || !newCategoryId}
          >
            Добавить
          </button>
        </div>

        <div className="table-scroll" style={{ border: "1px solid var(--border-light)", borderRadius: 12 }}>
          <table className="data-table">
            <thead style={{ background: "var(--bg-metric)" }}>
              <tr>
                <th>Категория</th>
                <th>Название</th>
                <th style={{ width: 100 }}>Статус</th>
                <th style={{ width: 180 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 16, color: "var(--text-secondary)" }}>
                    Нет поставщиков
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={!r.isActive ? { opacity: 0.55 } : undefined}>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{r.category?.name ?? "—"}</td>
                    <td>
                      <input
                        className="form-input"
                        style={{ height: 32 }}
                        value={nameDrafts[r.id] ?? r.name}
                        onChange={(e) => setNameDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      {r.isActive && r.category?.isActive !== false ? (
                        <span className="badge badge-green">Активен</span>
                      ) : (
                        <span className="badge badge-amber">Скрыт</span>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
