"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { FieldType } from "@/lib/field-types";
import type { DealTemplate } from "@/lib/deals";
import {
  MEDIATOR_AI_PAYROLL,
  applyAiParseToForm,
  buildTemplateSavePayload,
  buildTemplateWizardState,
  mergeMediatorAiPresetFields,
  parseTemplateWithAi,
  saveDealTemplate,
  slugifyFieldKey,
  validateTemplateForm,
  type CalcStep,
  type TemplateFieldDraft,
  type TemplateWizardStep,
} from "@/lib/deal-templates";

type Props = {
  open: boolean;
  editing: DealTemplate | null;
  onClose: () => void;
  onSaved: () => void;
};

export function TemplateWizardModal({ open, editing, onClose, onSaved }: Props) {
  const [tplName, setTplName] = useState("");
  const [tplHasWorkers, setTplHasWorkers] = useState(true);
  const [tplIncomeFieldKey, setTplIncomeFieldKey] = useState("");
  const [tplFields, setTplFields] = useState<TemplateFieldDraft[]>([]);
  const [tplCalcPreset, setTplCalcPreset] = useState<"" | typeof MEDIATOR_AI_PAYROLL>("");
  const [tplPayrollPoolPct, setTplPayrollPoolPct] = useState("20");
  const [tplCalcGrossKey, setTplCalcGrossKey] = useState("");
  const [tplCalcMediatorKey, setTplCalcMediatorKey] = useState("");
  const [tplCalcAiKey, setTplCalcAiKey] = useState("");
  const [tplWizardStep, setTplWizardStep] = useState<TemplateWizardStep>("type");
  const [tplCalcSteps, setTplCalcSteps] = useState<CalcStep[]>([]);
  const [aiParseOpen, setAiParseOpen] = useState(false);
  const [aiParseSample, setAiParseSample] = useState("");
  const [aiParseError, setAiParseError] = useState<string | null>(null);
  const [aiParsing, setAiParsing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = buildTemplateWizardState(editing);
    setTplName(s.name);
    setTplHasWorkers(s.hasWorkers);
    setTplIncomeFieldKey(s.incomeFieldKey);
    setTplCalcPreset(s.calcPreset);
    setTplPayrollPoolPct(s.payrollPoolPct);
    setTplCalcGrossKey(s.calcGrossKey);
    setTplCalcMediatorKey(s.calcMediatorKey);
    setTplCalcAiKey(s.calcAiKey);
    setTplFields(s.fields);
    setTplCalcSteps(s.calcSteps);
    setTplWizardStep(s.wizardStep);
    setAiParseOpen(false);
    setAiParseSample("");
    setAiParseError(null);
  }, [open, editing]);

  const applyMediatorAiPreset = useCallback(() => {
    setTplCalcPreset(MEDIATOR_AI_PAYROLL);
    setTplCalcSteps([
      {
        id: "step_mediator",
        label: "Выплата посредника",
        sourceType: "field",
        sourceId: "сумма_завода",
        deductType: "percent",
        deductFieldKey: "процент_посредника",
        resultLabel: "После посредника (R1)",
        isMediatorShare: true,
        isPayrollPool: false,
      },
      {
        id: "step_ai",
        label: "Доля AI",
        sourceType: "step",
        sourceId: "step_mediator",
        deductType: "percent",
        deductFieldKey: "процент_аи",
        resultLabel: "После AI (R2)",
        isAiShare: true,
        isPayrollPool: false,
      },
      {
        id: "step_payroll",
        label: "Зарплатный фонд",
        sourceType: "step",
        sourceId: "step_ai",
        deductType: "percent",
        deductFieldKey: "процент_зп_фонда",
        resultLabel: "Прибыль офиса",
        isPayrollPool: true,
      },
    ]);
    setTplHasWorkers(true);
    setTplCalcGrossKey("сумма_завода");
    setTplCalcMediatorKey("процент_посредника");
    setTplCalcAiKey("процент_аи");
    setTplIncomeFieldKey("сумма_завода");
    setTplFields((prev) => mergeMediatorAiPresetFields(prev));
  }, []);

  const addTplField = useCallback(() => {
    setTplFields((prev) => [
      ...prev,
      { _id: crypto.randomUUID(), label: "", type: "TEXT", required: false, options: "" },
    ]);
  }, []);

  const handleAiParse = useCallback(async () => {
    if (!aiParseSample.trim()) return;
    setAiParsing(true);
    setAiParseError(null);
    try {
      const result = await parseTemplateWithAi(aiParseSample);
      if (!result.ok) {
        setAiParseError(result.error);
        return;
      }
      const parsed = applyAiParseToForm(result.data, {
        name: tplName,
        hasWorkers: tplHasWorkers,
        incomeFieldKey: tplIncomeFieldKey,
        fields: tplFields,
        calcPreset: tplCalcPreset,
        payrollPoolPct: tplPayrollPoolPct,
        calcGrossKey: tplCalcGrossKey,
        calcMediatorKey: tplCalcMediatorKey,
        calcAiKey: tplCalcAiKey,
        wizardStep: tplWizardStep,
        calcSteps: tplCalcSteps,
      });
      setTplName(parsed.name);
      setTplHasWorkers(parsed.hasWorkers);
      setTplIncomeFieldKey(parsed.incomeFieldKey);
      setTplFields(parsed.fields);
      setTplWizardStep(parsed.wizardStep);
      setAiParseOpen(false);
      setAiParseSample("");
    } finally {
      setAiParsing(false);
    }
  }, [
    aiParseSample,
    tplName,
    tplHasWorkers,
    tplIncomeFieldKey,
    tplFields,
    tplCalcPreset,
    tplPayrollPoolPct,
    tplCalcGrossKey,
    tplCalcMediatorKey,
    tplCalcAiKey,
    tplWizardStep,
    tplCalcSteps,
  ]);

  const handleSave = useCallback(async () => {
    const form = {
      name: tplName,
      hasWorkers: tplHasWorkers,
      incomeFieldKey: tplIncomeFieldKey,
      fields: tplFields,
      calcPreset: tplCalcPreset,
      payrollPoolPct: tplPayrollPoolPct,
      calcGrossKey: tplCalcGrossKey,
      calcMediatorKey: tplCalcMediatorKey,
      calcAiKey: tplCalcAiKey,
      wizardStep: tplWizardStep,
      calcSteps: tplCalcSteps,
    };
    const err = validateTemplateForm(form);
    if (err) {
      alert(err);
      return;
    }
    const payload = buildTemplateSavePayload(form);
    const result = await saveDealTemplate(editing?.id ?? null, payload);
    if (!result.ok) {
      alert(result.message);
      return;
    }
    onSaved();
  }, [
    tplName,
    tplHasWorkers,
    tplIncomeFieldKey,
    tplFields,
    tplCalcPreset,
    tplPayrollPoolPct,
    tplCalcGrossKey,
    tplCalcMediatorKey,
    tplCalcAiKey,
    tplWizardStep,
    tplCalcSteps,
    editing,
    onSaved,
  ]);

  if (!open) return null;

  return (
<div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="card" style={{ width: 700, maxWidth: "100%", maxHeight: "92vh", overflow: "auto" }}>
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="card-title">{editing ? "Редактировать шаблон" : "Новый шаблон сделки"}</span>
                {!editing && (
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
                    Шаг {tplWizardStep === "type" ? "1" : "2"} из 2
                  </span>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => onClose()}>Отмена</button>
            </div>

            {/* ── ШАГ 1: выбор типа схемы ── */}
            {tplWizardStep === "type" && !editing && (
              <div className="card-body" style={{ display: "grid", gap: 20 }}>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  Выберите, как будут считаться деньги в сделках по этому шаблону:
                </div>

                {/* Карточка 1: схема посредника */}
                <div
                  onClick={() => {
                    setTplCalcPreset(MEDIATOR_AI_PAYROLL);
                    applyMediatorAiPreset();
                    setTplWizardStep("fields");
                  }}
                  style={{
                    display: "grid", gridTemplateColumns: "56px 1fr", gap: 16,
                    padding: "18px 20px", borderRadius: 14, cursor: "pointer",
                    border: "2px solid var(--accent)", background: "var(--accent)08",
                    transition: "box-shadow 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent)33")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>💸</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Схема с посредником, AI и сотрудниками</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                      Подходит если деньги идут по цепочке:
                    </div>
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {["Сумма завода", "→ вычет посредника %", "→ вычет AI %", "→ зарплатный фонд %", "→ прибыль офиса"].map((s, i) => (
                        <span key={i} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 20, background: i === 0 ? "var(--accent)" : "var(--bg-metric)", color: i === 0 ? "#fff" : "var(--text-secondary)", fontWeight: i === 0 ? 700 : 400 }}>{s}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-tertiary)" }}>
                      Система сама считает сколько кому достаётся. Вам остаётся только вводить суммы и проценты.
                    </div>
                  </div>
                </div>

                {/* Карточка 2: простая схема */}
                <div
                  onClick={() => {
                    setTplCalcPreset("");
                    setTplCalcGrossKey(""); setTplCalcMediatorKey(""); setTplCalcAiKey("");
                    setTplCalcSteps([]);
                    setTplFields([]);
                    setTplWizardStep("fields");
                  }}
                  style={{
                    display: "grid", gridTemplateColumns: "56px 1fr", gap: 16,
                    padding: "18px 20px", borderRadius: 14, cursor: "pointer",
                    border: "2px solid var(--border)", background: "var(--bg-card)",
                    transition: "box-shadow 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent)22")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--bg-metric)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📋</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Произвольная форма</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                      Вы сами добавляете нужные поля — текст, числа, списки, флажки. Подходит для любой структуры данных.
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-tertiary)" }}>
                      Расчёт зарплаты сотрудников по одному выбранному числовому полю.
                    </div>
                  </div>
                </div>

                <div style={{ paddingTop: 4, textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>
                  Нажмите на карточку чтобы продолжить
                </div>
              </div>
            )}

            {/* ── ШАГ 2: настройка полей ── */}
            {(tplWizardStep === "fields" || editing) && (
              <div className="card-body" style={{ display: "grid", gap: 18 }}>

                {/* Название */}
                <div>
                  <div className="form-label">Название шаблона *</div>
                  <input className="form-input" value={tplName} onChange={(e) => setTplName(e.target.value)}
                    placeholder="Например: Обменник PLN, Крипто-схема…" autoFocus />
                </div>

                {/* Схема — краткий блок, только если MEDIATOR_AI */}
                {tplCalcPreset === MEDIATOR_AI_PAYROLL && (
                  <div style={{ display: "grid", gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid var(--accent)33" }}>
                    <div style={{ background: "var(--accent)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>💸</span>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>Схема: посредник → AI → зарплатный фонд → прибыль</span>
                    </div>
                    <div style={{ padding: "12px 16px", background: "var(--accent)06", display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        Три поля расчёта уже добавлены (выделены цветом и заблокированы). Вам нужно только задать <strong>% зарплатного фонда</strong> — сколько процентов от оставшейся суммы идёт на зарплаты сотрудников.
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>% зарплатного фонда</div>
                        <input
                          className="form-input"
                          value={tplPayrollPoolPct}
                          onChange={(e) => setTplPayrollPoolPct(e.target.value)}
                          type="number" min={0} max={100} step="1"
                          style={{ width: 90, fontFamily: "'JetBrains Mono', monospace" }}
                        />
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          Пример: при 20% — если осталось 70, то 14 идёт сотрудникам, 56 — прибыль офиса
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI-парсер */}
                <div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setAiParseOpen(p => !p)}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, width: "100%", justifyContent: "center" }}
                  >
                    <span>🤖</span> {aiParseOpen ? "Скрыть AI-помощника" : "Создать поля через AI (вставить строки из таблицы)"}
                  </button>
                  {aiParseOpen && (
                    <div style={{ marginTop: 10, border: "1px solid var(--accent)44", borderRadius: 12, padding: 16, background: "var(--accent)08" }}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                        Вставьте 2–5 строк из вашей таблицы. AI сам определит колонки и типы полей.
                      </div>
                      <textarea
                        className="form-input"
                        value={aiParseSample}
                        onChange={e => setAiParseSample(e.target.value)}
                        style={{ height: 90, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", paddingTop: 10 }}
                        placeholder={"21,04  Ди+олх(Н)  75/25  DP  eurocom  6838\n22.04  Ди+Вл+Бо  45/30/25  DP  eurocom  5809"}
                      />
                      {aiParseError && <div style={{ marginTop: 6, fontSize: 12, color: "var(--red)" }}>{aiParseError}</div>}
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => { setAiParseOpen(false); setAiParseSample(""); setAiParseError(null); }}>Отмена</button>
                        <button className="btn btn-primary" onClick={handleAiParse} disabled={aiParsing || !aiParseSample.trim()}>
                          {aiParsing ? "Анализирую..." : "Определить поля →"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Список полей */}
                <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "var(--bg-metric)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Поля сделки</span>
                      {tplCalcPreset === MEDIATOR_AI_PAYROLL && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>Первые 3 поля — расчётные (нельзя удалить)</span>
                      )}
                      {tplCalcPreset !== MEDIATOR_AI_PAYROLL && tplHasWorkers && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>Нажмите 💰 у числового поля — на его основе будет считаться зарплата</span>
                      )}
                    </div>
                    <button className="btn btn-secondary" onClick={addTplField}>+ Добавить поле</button>
                  </div>

                  {tplFields.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                      Нажмите «+ Добавить поле» — например: ФИО, Телефон, Банк, Валюта, Метод
                    </div>
                  ) : (
                    <div style={{ display: "grid" }}>
                      {tplFields.map((f, i) => {
                        const fieldKey = f.key || slugifyFieldKey(f.label, i);
                        const isIncomeField = tplIncomeFieldKey === fieldKey;
                        const canBeIncome = f.type === "NUMBER" || f.type === "PERCENT";
                        const isFixed = ["fixed_gross", "fixed_mediator", "fixed_ai"].includes(f._id);
                        const fixedLabel: Record<string, string> = {
                          fixed_gross: "Сумма завода — число, сколько денег зашло",
                          fixed_mediator: "% посредника — сколько % забирает посредник",
                          fixed_ai: "% AI — сколько % уходит на AI (от суммы после посредника)",
                        };
                        return (
                          <div key={f._id} style={{
                            padding: "12px 16px",
                            borderTop: i > 0 ? "1px solid var(--border-light)" : undefined,
                            background: isFixed ? "var(--accent)06" : isIncomeField ? "var(--accent)08" : undefined,
                          }}>
                            {isFixed ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 16 }}>{f._id === "fixed_gross" ? "💰" : f._id === "fixed_mediator" ? "🏦" : "🤖"}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{fixedLabel[f._id]}</div>
                                </div>
                                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--accent)22", color: "var(--accent)", fontWeight: 600 }}>зафиксировано</span>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px auto 32px", gap: 10, alignItems: "end" }}>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Название поля</div>
                                    <input className="form-input" value={f.label} placeholder="ФИО, Телефон, Банк, Метод…"
                                      onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))} />
                                  </div>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Тип ввода</div>
                                    <select className="form-input" value={f.type}
                                      onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, type: e.target.value as FieldType } : x))}>
                                      <option value="TEXT">Текст (любой)</option>
                                      <option value="NUMBER">Число / сумма</option>
                                      <option value="PERCENT">Процент (0–100)</option>
                                      <option value="CURRENCY">Валюта (USD/EUR/UAH…)</option>
                                      <option value="SELECT">Список вариантов</option>
                                      <option value="DATE">Дата</option>
                                      <option value="CHECKBOX">Да / Нет</option>
                                    </select>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 1 }}>
                                    {tplHasWorkers && canBeIncome && tplCalcPreset !== MEDIATOR_AI_PAYROLL && (
                                      <button
                                        title="Зарплата считается от этого поля"
                                        onClick={() => setTplIncomeFieldKey(isIncomeField ? "" : fieldKey)}
                                        style={{ height: 38, width: 38, borderRadius: 8, border: isIncomeField ? "2px solid var(--accent)" : "1px solid var(--border)", background: isIncomeField ? "var(--accent)" : "var(--bg-card)", cursor: "pointer", fontSize: 18, transition: "all 0.15s" }}
                                      >💰</button>
                                    )}
                                  </div>
                                  <div style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 20, borderRadius: 8 }}
                                    onClick={() => { setTplFields(p => p.filter((_, xi) => xi !== i)); if (isIncomeField) setTplIncomeFieldKey(""); }}>×</div>
                                </div>
                                {f.type === "SELECT" && (
                                  <div style={{ marginTop: 8 }}>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Варианты для выбора (через запятую)</div>
                                    <input className="form-input" value={f.options} placeholder="Нал, Безнал, Карта, USDT…"
                                      onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, options: e.target.value } : x))} />
                                  </div>
                                )}
                                {isIncomeField && (
                                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--accent)" }}>
                                    💰 Зарплата сотрудников считается как % от этого поля
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Расчётная цепочка ── */}
                {(() => {
                  const numericFields = tplFields.filter(f => f.type === "NUMBER" || f.type === "PERCENT");
                  const allFieldKeys = tplFields.map((f, i) => ({ key: f.key || slugifyFieldKey(f.label, i), label: f.label }));

                  return (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", background: "var(--bg-metric)", borderBottom: tplCalcSteps.length > 0 ? "1px solid var(--border)" : undefined, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>📊 Расчётная цепочка</span>
                          <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                            {tplCalcSteps.length > 0 ? `${tplCalcSteps.length} шаг(ов)` : "необязательно — для автоматического распределения денег"}
                          </span>
                        </div>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setTplCalcSteps(prev => [...prev, {
                            id: `step_${Date.now()}`,
                            label: "",
                            sourceType: "field" as const,
                            sourceId: numericFields[0] ? (numericFields[0].key || slugifyFieldKey(numericFields[0].label, 0)) : "",
                            deductType: "percent" as const,
                            deductFieldKey: "",
                            resultLabel: "",
                            isPayrollPool: false,
                          }])}
                        >+ Добавить шаг</button>
                      </div>

                      {tplCalcSteps.length === 0 ? (
                        <div style={{ padding: "16px", fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                          Цепочка позволяет описать как деньги делятся по шагам: каждый шаг берёт сумму из предыдущего остатка или из поля, и вычитает % или фиксированную сумму. Один шаг можно пометить как «зарплатный фонд» — он будет распределяться между сотрудниками.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 0 }}>
                          {tplCalcSteps.map((step, si) => {
                            const prevSteps = tplCalcSteps.slice(0, si);
                            return (
                              <div key={step.id} style={{ padding: "14px 16px", borderTop: si > 0 ? "1px solid var(--border-light)" : undefined, background: step.isPayrollPool ? "var(--amber)08" : undefined }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: step.isPayrollPool ? "var(--amber)" : "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{si + 1}</span>
                                  <input
                                    className="form-input"
                                    value={step.label}
                                    onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, label: e.target.value } : s))}
                                    placeholder="Название шага (кому идут деньги)"
                                    style={{ flex: 1, fontWeight: 600 }}
                                  />
                                  <button
                                    style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", fontSize: 16, color: "var(--text-tertiary)" }}
                                    onClick={() => setTplCalcSteps(p => p.filter(s => s.id !== step.id))}
                                  >×</button>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                  {/* Source */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Взять сумму из</div>
                                    <select
                                      className="form-input"
                                      value={`${step.sourceType}:${step.sourceId}`}
                                      onChange={e => {
                                        const [type, ...rest] = e.target.value.split(":");
                                        setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, sourceType: type as "field"|"step", sourceId: rest.join(":") } : s));
                                      }}
                                    >
                                      {allFieldKeys.filter(f => {
                                        const fDef = tplFields.find(tf => (tf.key || slugifyFieldKey(tf.label, 0)) === f.key);
                                        return fDef?.type === "NUMBER" || fDef?.type === "PERCENT";
                                      }).map(f => (
                                        <option key={`field:${f.key}`} value={`field:${f.key}`}>📋 {f.label}</option>
                                      ))}
                                      {prevSteps.map(ps => (
                                        <option key={`step:${ps.id}`} value={`step:${ps.id}`}>↩ Остаток: {ps.resultLabel || ps.label || `Шаг ${tplCalcSteps.indexOf(ps) + 1}`}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {/* Deduct field */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Вычесть поле</div>
                                    <select
                                      className="form-input"
                                      value={step.deductFieldKey}
                                      onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, deductFieldKey: e.target.value } : s))}
                                    >
                                      <option value="">— выберите поле —</option>
                                      {allFieldKeys.filter(f => {
                                        const fDef = tplFields.find(tf => (tf.key || slugifyFieldKey(tf.label, 0)) === f.key);
                                        return fDef?.type === "PERCENT" || fDef?.type === "NUMBER";
                                      }).map(f => (
                                        <option key={f.key} value={f.key}>{f.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {/* Deduct type */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Тип вычитания</div>
                                    <select
                                      className="form-input"
                                      value={step.deductType}
                                      onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, deductType: e.target.value as "percent"|"fixed" } : s))}
                                    >
                                      <option value="percent">% от источника</option>
                                      <option value="fixed">Фиксированная сумма</option>
                                    </select>
                                  </div>
                                  {/* Result label */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Название остатка</div>
                                    <input
                                      className="form-input"
                                      value={step.resultLabel}
                                      onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, resultLabel: e.target.value } : s))}
                                      placeholder="Например: После посредника (R1)"
                                    />
                                  </div>
                                </div>

                                {/* isPayrollPool */}
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 10 }}>
                                  <input
                                    type="checkbox"
                                    checked={step.isPayrollPool}
                                    onChange={e => setTplCalcSteps(p => p.map(s =>
                                      s.id === step.id ? { ...s, isPayrollPool: e.target.checked } :
                                      e.target.checked ? { ...s, isPayrollPool: false } : s
                                    ))}
                                    style={{ width: 15, height: 15, accentColor: "var(--amber)" }}
                                  />
                                  <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: step.isPayrollPool ? 700 : 400 }}>
                                    👥 Это зарплатный фонд — вычитаемая сумма распределяется между сотрудниками
                                  </span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Для простой схемы — есть ли воркеры */}
                {tplCalcPreset !== MEDIATOR_AI_PAYROLL && tplCalcSteps.length === 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={tplHasWorkers} onChange={(e) => setTplHasWorkers(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Распределять зарплату сотрудникам по этой сделке</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Если включено — при создании сделки нужно будет указать кому и сколько %</div>
                    </div>
                  </label>
                )}

                {/* Кнопки */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                  {!editing ? (
                    <button className="btn btn-secondary" onClick={() => setTplWizardStep("type")}>← Назад</button>
                  ) : <div />}
                  <button className="btn btn-primary" onClick={handleSave}>
                    {editing ? "Сохранить изменения" : "Создать шаблон →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
  );
}
