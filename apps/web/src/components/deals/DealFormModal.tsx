"use client";

import React, { useMemo } from "react";
import {
  MEDIATOR_AI_PAYROLL as CALC_MEDIATOR_AI_PAYROLL,
  computeChain,
  computeMediatorAiPayroll,
  parsePayrollPoolPct,
  type CalcStep,
} from "@/lib/deal-payout";
import { CURRENCIES, CURRENCY_META } from "@/lib/currencies";
import {
  mediatorPctFieldKey,
  type DealAmtRow,
  type DealParticipantRow,
  type DealStatus,
  type DealTemplate,
  type DealWorker,
  type OperationType,
} from "@/lib/deals";
import type { ClientListItem } from "@/lib/clients";

export type DealFormModalProps = {
  open: boolean;
  editingId: string | null;
  templates: DealTemplate[];
  templateId: string | null;
  templateStep: "pick" | "form";
  onTemplateIdChange: (id: string) => void;
  onTemplateStepChange: (step: "pick" | "form") => void;
  dealDate: string;
  onDealDateChange: (v: string) => void;
  dealStatus: DealStatus;
  onDealStatusChange: (v: DealStatus) => void;
  dealClientSearch: string;
  onDealClientSearchChange: (v: string) => void;
  dealClientId: string | null;
  onDealClientIdChange: (id: string | null) => void;
  dealClientSkip: boolean;
  onDealClientSkipChange: (v: boolean) => void;
  dealClients: ClientListItem[];
  dealComment: string;
  onDealCommentChange: (v: string) => void;
  dealDataRows: Array<{ _id: string; data: Record<string, string> }>;
  onDealDataRowsChange: React.Dispatch<React.SetStateAction<Array<{ _id: string; data: Record<string, string> }>>>;
  dealAmounts: DealAmtRow[];
  onDealAmountsChange: React.Dispatch<React.SetStateAction<DealAmtRow[]>>;
  dealParticipants: DealParticipantRow[];
  onDealParticipantsChange: React.Dispatch<React.SetStateAction<DealParticipantRow[]>>;
  dealWorkers: DealWorker[];
  dealMediatorId: string;
  dealMediatorPct: string;
  dealOlxId: string;
  dealOlxPct: string;
  onDealOlxPctChange: (v: string) => void;
  dealInfoPct: string;
  onDealInfoPctChange: (v: string) => void;
  mediators: Array<{ id: string; name: string; defaultPct?: number | string | null; isActive?: boolean }>;
  olxList: Array<{ id: string; name: string; defaultPct?: number | string | null; isActive?: boolean }>;
  onClose: () => void;
  onSave: () => void;
  onMediatorSelect: (id: string) => void;
  onMediatorPctChange: (pct: string) => void;
  onOlxSelect: (id: string) => void;
  newAmtRow: () => DealAmtRow;
};

export function DealFormModal(props: DealFormModalProps) {
  const {
    open,
    editingId,
    templates,
    templateId: dealTemplateId,
    templateStep: dealTemplateStep,
    onTemplateIdChange: setDealTemplateId,
    onTemplateStepChange: setDealTemplateStep,
    dealDate,
    onDealDateChange: setDealDate,
    dealStatus,
    onDealStatusChange: setDealStatus,
    dealClientSearch,
    onDealClientSearchChange: setDealClientSearch,
    dealClientId,
    onDealClientIdChange: setDealClientId,
    dealClientSkip,
    onDealClientSkipChange: setDealClientSkip,
    dealClients,
    dealComment,
    onDealCommentChange: setDealComment,
    dealDataRows,
    onDealDataRowsChange: setDealDataRows,
    dealAmounts,
    onDealAmountsChange: setDealAmounts,
    dealParticipants,
    onDealParticipantsChange: setDealParticipants,
    dealWorkers,
    dealMediatorId,
    dealMediatorPct,
    dealOlxId,
    dealOlxPct,
    onDealOlxPctChange: setDealOlxPct,
    dealInfoPct,
    onDealInfoPctChange: setDealInfoPct,
    mediators,
    olxList,
    onClose: closeDealModal,
    onSave: saveDeal,
    onMediatorSelect: setDealMediatorSelection,
    onMediatorPctChange: applyDealMediatorPct,
    onOlxSelect: setDealOlxSelection,
    newAmtRow,
  } = props;

  const dealEditingId = editingId;

  const dealTotals = useMemo(() => {
    let tAmountIn = 0;
    let tAmountOut = 0;
    dealAmounts.forEach((r) => {
      tAmountIn += Number(r.amountIn) || 0;
      tAmountOut += Number(r.amountOut) || 0;
    });
    return { tAmountIn, tAmountOut };
  }, [dealAmounts]);

  const participantIncomeInfo = useMemo(() => {
    const activeTpl = dealTemplateId ? templates.find((t) => t.id === dealTemplateId) : null;
    if (!activeTpl) {
      return { base: dealTotals.tAmountOut, label: "сумма «получили»" };
    }
    if (activeTpl.calcSteps && activeTpl.calcSteps.length > 0 && dealDataRows[0]) {
      const chain = computeChain(dealDataRows[0].data, activeTpl.calcSteps);
      const payrollStep = chain.find((c) => c.step.isPayrollPool);
      const base = payrollStep
        ? Math.max(0, payrollStep.deductAmt)
        : chain.length > 0 ? Math.max(0, chain[chain.length - 1].result) : 0;
      const label = payrollStep
        ? `Зарплатный фонд (${payrollStep.step.label})`
        : chain.length > 0 ? chain[chain.length - 1].step.resultLabel : "Результат расчёта";
      return { base, label };
    }
    if (activeTpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && dealDataRows[0]) {
      const c = computeMediatorAiPayroll(dealDataRows[0].data, activeTpl);
      if (c) return { base: c.F, label: "зарплатный фонд (F), после AI/автоматики" };
    }
    if (activeTpl.incomeFieldKey) {
      const sum = dealDataRows.reduce((s, row) => s + (Number(row.data[activeTpl.incomeFieldKey!]) || 0), 0);
      const incField = activeTpl.fields.find((f) => f.key === activeTpl.incomeFieldKey);
      return { base: sum, label: incField?.label || activeTpl.incomeFieldKey || "" };
    }
    return { base: 0, label: "" };
  }, [dealTemplateId, templates, dealDataRows, dealTotals.tAmountOut]);

  if (!open) return null;

  return (
  <div
    className="modal-backdrop"
    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}
    onMouseDown={(e) => { if (e.target === e.currentTarget) closeDealModal(); }}
  >
    <div className="card" style={{ width: 820, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }}>
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="card-title">{dealEditingId ? "Редактировать сделку" : "Новая сделка"}</span>
          {dealTemplateStep === "form" && dealTemplateId && (
            <span style={{ fontSize: 11, background: "var(--accent-light)", color: "var(--accent)", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
              {templates.find(t => t.id === dealTemplateId)?.name}
            </span>
          )}
        </div>
        <button className="btn btn-secondary" onClick={closeDealModal}>Отмена</button>
      </div>

      {/* Template picker step */}
      {!dealEditingId && dealTemplateStep === "pick" ? (
        <div className="card-body" style={{ display: "grid", gap: 14 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Выберите шаблон сделки:</div>
          <div style={{ display: "grid", gap: 8 }}>
            {templates.map((t) => (
              <label key={t.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                border: `2px solid ${dealTemplateId === t.id ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--radius)", cursor: "pointer",
                background: dealTemplateId === t.id ? "var(--accent-light)" : "var(--bg-card)",
              }}>
                <input type="radio" name="tpl" value={t.id} checked={dealTemplateId === t.id}
                  onChange={() => setDealTemplateId(t.id)} style={{ accentColor: "var(--accent)" }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {t.fields.length} полей · {t.hasWorkers ? "с воркерами" : "без воркеров"}
                    {t.calcPreset === CALC_MEDIATOR_AI_PAYROLL ? " · расчёт посредник/ИИ/фонд" : ""}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!dealTemplateId) {
                  alert("Выберите шаблон");
                  return;
                }
                setDealTemplateStep("form");
              }}
            >
              Продолжить →
            </button>
          </div>
        </div>
      ) : (

      <div className="card-body" style={{ display: "grid", gap: 18 }}>

        {/* Date + Client */}
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 14 }}>
          <div>
            <div className="form-label">Дата *</div>
            <input className="form-input" type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
          </div>
          <div>
            <div className="form-label">Клиент</div>
            {!dealClientSkip && !dealClientId ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="form-input" placeholder="Поиск..." value={dealClientSearch} onChange={(e) => setDealClientSearch(e.target.value)} />
                  <button className="btn btn-secondary" onClick={() => setDealClientSkip(true)}>Без клиента</button>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)", maxHeight: 130, overflow: "auto" }}>
                  {dealClients.filter((c) => (c.name + " " + c.phone).toLowerCase().includes(dealClientSearch.toLowerCase())).slice(0, 20).map((c) => (
                    <div key={c.id} style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", display: "flex", gap: 10 }} onClick={() => setDealClientId(c.id)}>
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{c.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : dealClientId ? (
              <div style={{ background: "var(--green-bg)", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ flex: 1, fontWeight: 600, color: "var(--green-text)" }}>{dealClients.find((c) => c.id === dealClientId)?.name ?? "Клиент"}</span>
                <button className="btn btn-secondary" onClick={() => setDealClientId(null)}>×</button>
              </div>
            ) : (
              <div style={{ background: "var(--bg-metric)", borderRadius: 10, padding: "8px 12px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                Без клиента{" "}
                <span style={{ color: "var(--accent)", cursor: "pointer", fontStyle: "normal", marginLeft: 8 }} onClick={() => setDealClientSkip(false)}>Изменить</span>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div style={{ width: 240 }}>
          <div className="form-label">Статус</div>
          <select className="form-input" value={dealStatus} onChange={(e) => setDealStatus(e.target.value as DealStatus)}>
            <option value="NEW">Новая</option>
            <option value="IN_PROGRESS">В работе</option>
            <option value="CLOSED">Закрыта</option>
          </select>
        </div>

        {dealTemplateId && (() => {
          const tplM = templates.find((t) => t.id === dealTemplateId);
          const showMediator = tplM?.calcPreset === CALC_MEDIATOR_AI_PAYROLL || (tplM?.calcSteps && (tplM.calcSteps as CalcStep[]).length > 0);
          if (!showMediator) return null;
          const mediatorFieldKey = mediatorPctFieldKey(tplM);
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, padding: "12px 14px", background: "var(--bg-metric)", borderRadius: 10, border: "1px solid var(--border-light)" }}>
              <div>
                <div className="form-label">Посредник</div>
                <select className="form-input" value={dealMediatorId} onChange={(e) => setDealMediatorSelection(e.target.value)}>
                  <option value="">— не выбран —</option>
                  {mediators.filter((m: any) => m.isActive !== false).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name}{m.defaultPct != null ? ` (${m.defaultPct}%)` : ""}</option>
                  ))}
                </select>
                {mediatorFieldKey && (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                    % из справочника подставляется в расчёт{dealMediatorPct ? ` (сейчас ${dealMediatorPct}%)` : ""}
                  </div>
                )}
              </div>
              <div>
                <div className="form-label">% по сделке</div>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="%"
                  value={dealMediatorPct}
                  onChange={(e) => applyDealMediatorPct(e.target.value)}
                />
              </div>
            </div>
          );
        })()}

        {dealTemplateId && (() => {
          const tplM = templates.find((t) => t.id === dealTemplateId);
          const show = tplM?.calcPreset === CALC_MEDIATOR_AI_PAYROLL || (tplM?.calcSteps && (tplM.calcSteps as CalcStep[]).length > 0);
          if (!show) return null;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, padding: "12px 14px", background: "var(--bg-metric)", borderRadius: 10, border: "1px solid var(--border-light)" }}>
              <div>
                <div className="form-label">ОЛХ</div>
                <select className="form-input" value={dealOlxId} onChange={(e) => setDealOlxSelection(e.target.value)}>
                  <option value="">— не выбран —</option>
                  {olxList.filter((o: any) => o.isActive !== false).map((o: any) => (
                    <option key={o.id} value={o.id}>{o.name}{o.defaultPct != null ? ` (${o.defaultPct}%)` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="form-label">% по сделке</div>
                <input className="form-input" type="number" min={0} max={100} step="0.01" placeholder="%" value={dealOlxPct} onChange={(e) => setDealOlxPct(e.target.value)} />
              </div>
            </div>
          );
        })()}

        {dealTemplateId && (() => {
          const tplM = templates.find((t) => t.id === dealTemplateId);
          const showPartner =
            tplM?.calcPreset === CALC_MEDIATOR_AI_PAYROLL ||
            (tplM?.calcSteps && (tplM.calcSteps as CalcStep[]).length > 0);
          if (!showPartner) return null;
          return (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(100,116,139,0.08)",
                borderRadius: 10,
                border: "1px solid var(--border-light)",
              }}
            >
              <div className="form-label" style={{ fontWeight: 600 }}>Инфо</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                Процент от <b>зарплатного фонда</b> этой сделки (после посредника, ОЛХ и ИИ). У каждой сделки свой %.
              </div>
              <div style={{ maxWidth: 200 }}>
                <div className="form-label">% Инфо</div>
                <input className="form-input" type="number" min={0} max={100} step="0.01" placeholder="например 5" value={dealInfoPct} onChange={(e) => setDealInfoPct(e.target.value)} />
              </div>
            </div>
          );
        })()}

        {/* Template-based fields OR classic amounts */}
        {dealTemplateId && templates.find(t => t.id === dealTemplateId) ? (() => {
          const tpl = templates.find(t => t.id === dealTemplateId)!;
          return (
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="form-label" style={{ margin: 0 }}>Данные [{tpl.name}]</div>
                {tpl.calcPreset !== CALC_MEDIATOR_AI_PAYROLL && (
                  <button className="btn btn-secondary" onClick={() => setDealDataRows(p => [...p, { _id: crypto.randomUUID(), data: {} }])}>+ Добавить строку</button>
                )}
              </div>
              {tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>Одна строка на сделку. Расчёт по полям: сумма завода, % посредника, % ИИ (от остатка после посредника), затем {parsePayrollPoolPct(tpl)}% в зарплатный фонд.</div>
              )}
              {dealDataRows.map((row, ri) => (
                <div key={row._id} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Строка {ri + 1}</span>
                    {dealDataRows.length > 1 && (
                      <span style={{ cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }} onClick={() => setDealDataRows(p => p.filter(x => x._id !== row._id))}>×</span>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                    {tpl.fields.map((f) => {
                      if (
                        (tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL ||
                          (tpl.calcSteps && (tpl.calcSteps as CalcStep[]).length > 0)) &&
                        mediatorPctFieldKey(tpl) === f.key
                      ) {
                        return null;
                      }
                      const isGross = tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && f.key === tpl.calcGrossFieldKey;
                      const isMediator = tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && f.key === tpl.calcMediatorPctKey;
                      const isAi = tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && f.key === tpl.calcAiPctKey;
                      const calcBadge = isGross ? { icon: "💰", color: "var(--accent)", tip: "База расчёта" }
                        : isMediator ? { icon: "🏦", color: "var(--amber)", tip: "% посредника" }
                        : isAi ? { icon: "🤖", color: "var(--text-secondary)", tip: "% AI" }
                        : null;
                      return (
                      <div key={f.key} style={calcBadge ? { background: `${calcBadge.color}0d`, borderRadius: 8, padding: "6px 8px", border: `1.5px solid ${calcBadge.color}44` } : {}}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                          {calcBadge && <span title={calcBadge.tip} style={{ fontSize: 13 }}>{calcBadge.icon}</span>}
                          <span className="form-label" style={{ margin: 0 }}>{f.label}{f.required ? " *" : ""}</span>
                        </div>
                        {f.type === "CURRENCY" ? (
                          <select className="form-input" value={row.data[f.key] ?? ""}
                            onChange={(e) => setDealDataRows(p => p.map(x => x._id === row._id ? { ...x, data: { ...x.data, [f.key]: e.target.value } } : x))}
                            style={{ borderColor: calcBadge ? `${calcBadge.color}66` : undefined }}>
                            <option value="">— валюта —</option>
                            {CURRENCIES.map(c => (
                              <option key={c} value={c}>{CURRENCY_META[c]?.symbol} {c} — {CURRENCY_META[c]?.name}</option>
                            ))}
                          </select>
                        ) : f.type === "SELECT" ? (
                          <select className="form-input" value={row.data[f.key] ?? ""}
                            onChange={(e) => setDealDataRows(p => p.map(x => x._id === row._id ? { ...x, data: { ...x.data, [f.key]: e.target.value } } : x))}>
                            <option value="">— выберите —</option>
                            {(f.options ?? "").split(",").map(o => o.trim()).filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : f.type === "CHECKBOX" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38 }}>
                            <input type="checkbox" checked={row.data[f.key] === "true"}
                              onChange={(e) => setDealDataRows(p => p.map(x => x._id === row._id ? { ...x, data: { ...x.data, [f.key]: e.target.checked ? "true" : "false" } } : x))}
                              style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{f.label}</span>
                          </div>
                        ) : (
                          <input
                            className="form-input"
                            type={f.type === "NUMBER" || f.type === "PERCENT" ? "number" : f.type === "DATE" ? "date" : "text"}
                            min={f.type === "PERCENT" ? 0 : undefined}
                            max={f.type === "PERCENT" ? 100 : undefined}
                            value={row.data[f.key] ?? ""}
                            onChange={(e) => setDealDataRows(p => p.map(x => x._id === row._id ? { ...x, data: { ...x.data, [f.key]: e.target.value } } : x))}
                            style={{ fontFamily: f.type === "NUMBER" || f.type === "PERCENT" ? "'JetBrains Mono', monospace" : undefined, borderColor: calcBadge ? `${calcBadge.color}66` : undefined }}
                          />
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* === Universal Calc Chain block === */}
              {(tpl.calcSteps && tpl.calcSteps.length > 0) && (() => {
                const data = dealDataRows[0]?.data ?? {};
                const chain = computeChain(data, tpl.calcSteps!);
                const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
                const hasValues = chain.some(c => c.source > 0);
                return (
                  <div style={{ marginTop: 8, padding: 14, background: "var(--accent)08", borderRadius: 10, border: "2px solid var(--accent)33" }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      📊 Расчёт распределения
                      {!hasValues && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>— заполните числовые поля выше</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3px 16px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                      {chain.map((cr, ci) => {
                        const isPayroll = cr.step.isPayrollPool;
                        const isLast = ci === chain.length - 1;
                        const deductField = tpl.fields.find(f => f.key === cr.step.deductFieldKey);
                        const deductLabel = deductField?.label ?? cr.step.deductFieldKey;
                        return (
                          <React.Fragment key={cr.step.id}>
                            {ci === 0 && (
                              <>
                                <span style={{ color: "var(--text-secondary)" }}>
                                  {cr.step.sourceType === "field"
                                    ? (tpl.fields.find(f => f.key === cr.step.sourceId)?.label ?? cr.step.sourceId)
                                    : cr.step.sourceId}
                                </span>
                                <span style={{ textAlign: "right", fontWeight: 700 }}>{fmt(cr.source)}</span>
                              </>
                            )}
                            <span style={{ color: isPayroll ? "var(--amber)" : "var(--text-tertiary)", paddingLeft: 8 }}>
                              {isPayroll ? "👥" : "−"} {cr.step.label} ({deductLabel})
                            </span>
                            <span style={{ textAlign: "right", color: isPayroll ? "var(--amber)" : "var(--text-tertiary)", fontWeight: isPayroll ? 700 : 400 }}>
                              − {fmt(cr.deductAmt)}
                            </span>
                            <span style={{
                              color: isLast ? "var(--green)" : "var(--text-secondary)",
                              fontWeight: isLast ? 700 : 400,
                              borderTop: "1px dashed var(--border)", paddingTop: 3,
                            }}>
                              {isLast ? "🏢 " : ""}{cr.step.resultLabel}
                            </span>
                            <span style={{
                              textAlign: "right", fontWeight: isLast ? 700 : 400,
                              color: isLast ? "var(--green)" : undefined,
                              borderTop: "1px dashed var(--border)", paddingTop: 3,
                            }}>
                              {fmt(cr.result)}
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* === Legacy MEDIATOR_AI_PAYROLL block (for old templates) === */}
              {(!tpl.calcSteps || tpl.calcSteps.length === 0) && tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && (() => {
                const c = dealDataRows[0] ? computeMediatorAiPayroll(dealDataRows[0].data, tpl) : null;
                const fmt = (n: number) => n > 0 ? n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : "0";
                const grossField = tpl.fields.find(f => f.key === tpl.calcGrossFieldKey);
                return (
                  <div style={{ marginTop: 8, padding: 14, background: "var(--accent)08", borderRadius: 10, border: "2px solid var(--accent)33" }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      📊 Расчёт распределения
                      {(!c || c.G === 0) && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 4 }}>— заполните {grossField?.label ?? "Сумма завода"} 💰 выше</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 16px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                      <span style={{ color: "var(--text-secondary)" }}>💰 Сумма завода</span><span style={{ textAlign: "right", fontWeight: 700 }}>{fmt(c?.G ?? 0)}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>🏦 Посредник</span><span style={{ textAlign: "right", color: "var(--text-tertiary)" }}>− {fmt(c?.M ?? 0)}</span>
                      <span style={{ color: "var(--text-secondary)", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>R1</span><span style={{ textAlign: "right", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>{fmt(c?.R1 ?? 0)}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>🤖 AI</span><span style={{ textAlign: "right", color: "var(--text-tertiary)" }}>− {fmt(c?.A ?? 0)}</span>
                      <span style={{ color: "var(--text-secondary)", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>R2</span><span style={{ textAlign: "right", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>{fmt(c?.R2 ?? 0)}</span>
                      <span style={{ color: "var(--amber)" }}>👥 ЗП фонд ({parsePayrollPoolPct(tpl)}%)</span><span style={{ textAlign: "right", color: "var(--amber)", fontWeight: 700 }}>− {fmt(c?.F ?? 0)}</span>
                      <span style={{ fontWeight: 700, color: "var(--green)", borderTop: "2px solid var(--border)", paddingTop: 4 }}>🏢 Прибыль офиса</span><span style={{ textAlign: "right", fontWeight: 700, color: "var(--green)", borderTop: "2px solid var(--border)", paddingTop: 4 }}>{fmt(c?.P ?? 0)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })() : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="form-label" style={{ margin: 0 }}>Операции (классика, без шаблона) *</div>
            <button className="btn btn-secondary" onClick={() => setDealAmounts((p) => [...p, newAmtRow()])}>+ Добавить строку</button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {dealAmounts.map((r) => (
              <div key={r.id} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: 14 }}>
                {/* row 1: bank, type, shopName */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr 28px", gap: 8, marginBottom: 8, alignItems: "end" }}>
                  <div>
                    <div className="form-label" style={{ marginBottom: 3 }}>Банк</div>
                    <input
                      className="form-input"
                      value={r.bank}
                      onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, bank: e.target.value } : x))}
                      placeholder="ING, PKO BP..."
                    />
                  </div>
                  <div>
                    <div className="form-label" style={{ marginBottom: 3 }}>Тип</div>
                    <select
                      className="form-input"
                      value={r.operationType}
                      onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, operationType: e.target.value as OperationType } : x))}
                    >
                      <option value="ATM">Банкомат</option>
                      <option value="PURCHASE">Покупка</option>
                      <option value="TRANSFER">Перевод</option>
                    </select>
                  </div>
                  <div>
                    {r.operationType === "PURCHASE" ? (
                      <>
                        <div className="form-label" style={{ marginBottom: 3 }}>Магазин</div>
                        <input
                          className="form-input"
                          value={r.shopName}
                          onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, shopName: e.target.value } : x))}
                          placeholder="Название магазина"
                        />
                      </>
                    ) : <div />}
                  </div>
                  <div
                    style={{ width: 28, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18 }}
                    onClick={() => setDealAmounts((p) => p.filter((x) => x.id !== r.id))}
                  >×</div>
                </div>

                {/* row 2: amountIn + currencyIn → amountOut + currencyOut */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 24px 1fr 90px", gap: 8, alignItems: "end" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>Взяли</div>
                    <input
                      className="form-input"
                      value={r.amountIn}
                      onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, amountIn: e.target.value } : x))}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>Валюта</div>
                    <select
                      className="form-input"
                      value={r.currencyIn}
                      onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, currencyIn: e.target.value } : x))}
                    >
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ textAlign: "center", color: "var(--text-tertiary)", paddingBottom: 8 }}>→</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", marginBottom: 3 }}>Получили</div>
                    <input
                      className="form-input"
                      value={r.amountOut}
                      onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, amountOut: e.target.value } : x))}
                      style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--green)" }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", marginBottom: 3 }}>Валюта</div>
                    <select
                      className="form-input"
                      value={r.currencyOut}
                      onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, currencyOut: e.target.value } : x))}
                    >
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* totals row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 12, marginTop: 12, borderTop: "2px solid var(--border)" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Итого взяли</div>
              <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>{dealTotals.tAmountIn.toLocaleString()}</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Итого получили</div>
              <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "var(--green)" }}>{dealTotals.tAmountOut.toLocaleString()}</div>
            </div>
          </div>
        </div>
        )}

        {/* Participants */}
        {(() => {
          const incomeBase = participantIncomeInfo.base;
          const activeTplForParts = dealTemplateId ? templates.find(t => t.id === dealTemplateId) : null;
          const isMediator = activeTplForParts?.calcPreset === CALC_MEDIATOR_AI_PAYROLL;
          const filledParticipants = dealParticipants.filter(p => p.userId);
          const totalPct = dealParticipants.reduce((s, p) => s + (Number(p.pct) || 0), 0);
          const remaining = 100 - totalPct;

          function splitEvenly() {
            const filled = dealParticipants.filter(p => p.userId);
            if (filled.length === 0) return;
            const base = Math.floor(100 / filled.length);
            const rem = 100 - base * filled.length;
            setDealParticipants(prev => {
              let extra = rem;
              return prev.map(p => {
                if (!p.userId) return p;
                const add = extra > 0 ? 1 : 0;
                extra -= add;
                return { ...p, pct: String(base + add) };
              });
            });
          }

          return (
            <div style={{ border: `2px solid ${isMediator ? "var(--accent)44" : "var(--border)"}`, borderRadius: 14, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "12px 16px", background: isMediator ? "var(--accent)08" : "var(--bg-metric)", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    👥 Зарплата сотрудников
                    {totalPct === 100 && filledParticipants.length > 0 && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--green-bg)", color: "var(--green-text)", fontWeight: 600 }}>✓ распределено</span>
                    )}
                  </div>
                  {isMediator && incomeBase > 0 ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                      Фонд для распределения:&nbsp;
                      <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--accent)", fontSize: 14 }}>{incomeBase.toLocaleString()}</strong>
                      &nbsp;— это {parsePayrollPoolPct(activeTplForParts!)}% от суммы после всех вычетов. Раздели 100% этой суммы между сотрудниками.
                    </div>
                  ) : incomeBase > 0 ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                      База: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{incomeBase.toLocaleString()}</strong> · укажи % каждому сотруднику, в сумме 100%
                    </div>
                  ) : (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-tertiary)" }}>Укажи суммы в полях выше — сразу увидишь сколько получит каждый</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {filledParticipants.length > 1 && (
                    <button className="btn btn-secondary" style={{ fontSize: 12, height: 32 }} onClick={splitEvenly} title="Разделить поровну">⚖️ Поровну</button>
                  )}
                  <button className="btn btn-secondary" style={{ fontSize: 12, height: 32 }} onClick={() => setDealParticipants((p) => [...p, { id: crypto.randomUUID(), userId: "", pct: remaining > 0 ? String(remaining) : "0" }])}>
                    + Сотрудник
                  </button>
                </div>
              </div>

              {/* Rows */}
              <div style={{ padding: dealParticipants.length ? "8px 12px" : 0, display: "grid", gap: 6 }}>
                {dealParticipants.map((p, idx) => {
                  const pct = Number(p.pct) || 0;
                  const earn = incomeBase > 0 ? Math.round(incomeBase * pct / 100 * 100) / 100 : 0;
                  const worker = dealWorkers.find(w => w.id === p.userId);
                  const initials = worker?.name
                    ? worker.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                    : (worker?.email?.[0] ?? "?").toUpperCase();
                  return (
                    <div key={p.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr 80px auto 32px", gap: 8, alignItems: "center", padding: "8px 4px", borderRadius: 10, background: p.userId ? "var(--bg-metric)" : "transparent" }}>
                      {/* Avatar */}
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: p.userId ? "var(--accent)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: p.userId ? "#fff" : "var(--text-tertiary)", flexShrink: 0 }}>
                        {p.userId ? initials : idx + 1}
                      </div>
                      {/* Employee select */}
                      <select
                        className="form-input"
                        value={p.userId}
                        onChange={(e) => setDealParticipants((pp) => pp.map((x) => x.id === p.id ? { ...x, userId: e.target.value } : x))}
                      >
                        <option value="">— выбрать сотрудника —</option>
                        {dealWorkers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name || w.email}{w.position ? ` · ${w.position}` : ""}
                          </option>
                        ))}
                      </select>
                      {/* Pct + earn */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          className="form-input"
                          value={p.pct}
                          onChange={(e) => setDealParticipants((pp) => pp.map((x) => x.id === p.id ? { ...x, pct: e.target.value } : x))}
                          style={{ width: 52, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
                          placeholder="0"
                        />
                        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>%</span>
                      </div>
                      {/* Amount */}
                      <div style={{ minWidth: 80, textAlign: "right" }}>
                        {incomeBase > 0 && p.userId ? (
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--green)", fontSize: 13 }}>
                            {earn.toLocaleString()}
                          </div>
                        ) : <span style={{ color: "var(--border)" }}>—</span>}
                      </div>
                      {/* Remove */}
                      <button
                        style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
                        onClick={() => setDealParticipants((pp) => pp.filter((x) => x.id !== p.id))}
                      >×</button>
                    </div>
                  );
                })}
              </div>

              {/* Footer: progress bar + total */}
              {dealParticipants.length > 0 && (
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-light)", background: "var(--bg-metric)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Распределено: <strong style={{ color: totalPct === 100 ? "var(--green)" : totalPct > 100 ? "var(--red)" : "var(--amber)" }}>{totalPct}%</strong></span>
                    {incomeBase > 0 && (
                      <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "var(--text-secondary)" }}>
                        {dealParticipants.filter(p => p.userId).reduce((s, p) => s + Math.round(incomeBase * (Number(p.pct) || 0) / 100 * 100) / 100, 0).toLocaleString()} из {incomeBase.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 6, background: totalPct === 100 ? "var(--green)" : totalPct > 100 ? "var(--red)" : "var(--accent)", width: `${Math.min(totalPct, 100)}%`, transition: "width 0.2s" }} />
                  </div>
                  {totalPct !== 100 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: totalPct > 100 ? "var(--red)" : "var(--amber)" }}>
                      {totalPct > 100 ? `⚠ Превышение на ${totalPct - 100}% — уменьши проценты` : `Осталось распределить: ${100 - totalPct}%${incomeBase > 0 ? ` (${Math.round(incomeBase * (100 - totalPct) / 100 * 100) / 100} в сумме)` : ""}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Comment */}
        <div>
          <div className="form-label">Комментарий</div>
          <textarea className="form-input" value={dealComment} onChange={(e) => setDealComment(e.target.value)} style={{ height: 72, paddingTop: 10 }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {!dealEditingId && templates.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setDealTemplateStep("pick")}>← Шаблон</button>
          )}
          <button className="btn btn-secondary" onClick={closeDealModal}>Отмена</button>
          <button className="btn btn-primary" onClick={saveDeal}>
            {dealEditingId ? "Сохранить" : "Создать сделку"}
          </button>
        </div>
      </div>
      )}
    </div>
  </div>
  );
}
