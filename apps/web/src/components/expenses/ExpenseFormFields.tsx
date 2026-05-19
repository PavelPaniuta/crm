"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExpenseCategoryRow, ExpenseSupplierRow } from "@/lib/expense-settings";
import { createExpenseSupplierApi, fetchExpenseSuppliers } from "@/lib/expense-settings";
import { CURRENCIES } from "@/lib/currencies";
import {
  deleteExpenseFileApi,
  expenseFileDownloadUrl,
  formatFileSize,
  uploadExpenseFileApi,
} from "@/lib/expenses";
import type { ExpenseFileRow } from "@/components/expenses/ExpenseDetailModal";

export type ExpenseFormValues = {
  categoryId: string;
  supplierId: string;
  title: string;
  amount: string;
  currency: string;
  payMethod: string;
  comment: string;
};

type Props = {
  categories: ExpenseCategoryRow[];
  values: ExpenseFormValues;
  onChange: (patch: Partial<ExpenseFormValues>) => void;
  expenseId?: string | null;
  existingFiles?: ExpenseFileRow[];
  canEditFiles?: boolean;
  onFilesChange?: () => void;
  onPendingFilesChange?: (files: File[]) => void;
};

const ACCEPT = ".png,.jpg,.jpeg,.pdf,.heic,.heif";

export function ExpenseFormFields({
  categories,
  values,
  onChange,
  expenseId,
  existingFiles = [],
  canEditFiles = true,
  onFilesChange,
  onPendingFilesChange,
}: Props) {
  const [suppliers, setSuppliers] = useState<ExpenseSupplierRow[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [pendingFiles, setPendingFiles] = useState<{ id: string; file: File }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCategories = categories.filter((c) => c.isActive);

  useEffect(() => {
    onPendingFilesChange?.(pendingFiles.map((p) => p.file));
  }, [pendingFiles, onPendingFilesChange]);

  const loadSuppliers = useCallback(async (categoryId: string) => {
    if (!categoryId) {
      setSuppliers([]);
      return;
    }
    setSupplierLoading(true);
    try {
      const list = await fetchExpenseSuppliers({ categoryId, activeOnly: true });
      setSuppliers(list);
    } catch {
      setSuppliers([]);
    } finally {
      setSupplierLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers(values.categoryId);
  }, [values.categoryId, loadSuppliers]);

  function onCategoryChange(categoryId: string) {
    onChange({ categoryId, supplierId: "" });
  }

  async function addSupplierInline() {
    const name = newSupplierName.trim();
    if (!name || !values.categoryId) return;
    try {
      const created = await createExpenseSupplierApi(values.categoryId, name);
      setNewSupplierName("");
      setNewSupplierOpen(false);
      await loadSuppliers(values.categoryId);
      onChange({ supplierId: created.id });
    } catch {
      alert("Не удалось добавить поставщика");
    }
  }

  function addPendingFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList);
    setPendingFiles((prev) => [
      ...prev,
      ...arr.map((file) => ({ id: `${Date.now()}_${Math.random()}`, file })),
    ]);
  }

  async function removeExisting(fileId: string) {
    if (!expenseId) return;
    try {
      await deleteExpenseFileApi(expenseId, fileId);
      onFilesChange?.();
    } catch {
      alert("Не удалось удалить файл");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div className="form-label">
          Категория <span style={{ color: "var(--red)" }}>*</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {activeCategories.map((c) => {
            const selected = values.categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategoryChange(c.id)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: selected ? `2px solid ${c.color || "var(--accent)"}` : "1px solid var(--border-light)",
                  background: selected ? (c.color ? `${c.color}18` : "var(--accent-light)") : "var(--bg-metric)",
                  color: selected ? (c.color || "var(--accent)") : "var(--text-secondary)",
                  fontWeight: selected ? 600 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {values.categoryId ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div className="form-label">Поставщик</div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, padding: "2px 8px" }}
              onClick={() => setNewSupplierOpen((v) => !v)}
            >
              + Новый
            </button>
          </div>
          {newSupplierOpen ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                className="form-input"
                placeholder="Название поставщика"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
              />
              <button type="button" className="btn btn-primary" onClick={() => void addSupplierInline()}>
                Добавить
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setNewSupplierOpen(false)}>
                Отмена
              </button>
            </div>
          ) : null}
          {supplierLoading ? (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Загрузка…</div>
          ) : suppliers.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Нет поставщиков — можно добавить</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={() => onChange({ supplierId: "" })}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: !values.supplierId ? "2px solid var(--accent)" : "1px solid var(--border-light)",
                  background: !values.supplierId ? "var(--accent-light)" : "transparent",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                —
              </button>
              {suppliers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ supplierId: s.id })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: values.supplierId === s.id ? "2px solid var(--accent)" : "1px solid var(--border-light)",
                    background: values.supplierId === s.id ? "var(--accent-light)" : "var(--bg-metric)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div>
        <div className="form-label">Название</div>
        <input className="form-input" value={values.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 120px 140px" }}>
        <div>
          <div className="form-label">Сумма</div>
          <input className="form-input" value={values.amount} onChange={(e) => onChange({ amount: e.target.value })} />
        </div>
        <div>
          <div className="form-label">Валюта</div>
          <select className="form-input" value={values.currency} onChange={(e) => onChange({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="form-label">Оплата</div>
          <select className="form-input" value={values.payMethod} onChange={(e) => onChange({ payMethod: e.target.value })}>
            <option value="bank">Банк</option>
            <option value="usdt">USDT</option>
            <option value="cash">Кэш</option>
          </select>
        </div>
      </div>

      <div>
        <div className="form-label">Комментарий</div>
        <textarea
          className="form-input"
          value={values.comment}
          onChange={(e) => onChange({ comment: e.target.value })}
          rows={3}
          style={{ minHeight: 70, resize: "vertical" }}
        />
      </div>

      {canEditFiles ? (
        <div>
          <div className="form-label">Чеки / документы</div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addPendingFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-light)"}`,
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "var(--accent-light)" : "var(--bg-metric)",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Перетащите файлы сюда или нажмите для выбора
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              PNG, JPG, PDF, HEIC — до 10 МБ каждый
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.length) addPendingFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {(existingFiles.length > 0 || pendingFiles.length > 0) && (
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {existingFiles.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 10px",
                    background: "var(--bg-metric)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    {expenseId ? (
                      <a
                        href={expenseFileDownloadUrl(expenseId, f.id)}
                        style={{ fontSize: 13, fontWeight: 500, color: "var(--accent)" }}
                      >
                        {f.fileName}
                      </a>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{f.fileName}</span>
                    )}
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatFileSize(f.fileSize)}</div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeExisting(f.id)}>
                    Удалить
                  </button>
                </div>
              ))}
              {pendingFiles.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 10px",
                    background: "var(--bg-metric)",
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{p.file.name}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatFileSize(p.file.size)}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPendingFiles((list) => list.filter((x) => x.id !== p.id))}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export async function flushPendingExpenseFiles(expenseId: string, files: File[]) {
  for (const file of files) {
    await uploadExpenseFileApi(expenseId, file);
  }
}

