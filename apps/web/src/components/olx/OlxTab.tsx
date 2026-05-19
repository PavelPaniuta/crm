"use client";

export type OlxListItem = {
  id: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  defaultPct?: number | string | null;
  isActive?: boolean;
};

export type OlxDealRow = {
  dealId: string;
  title?: string | null;
  dealDate?: string | null;
  pct: number;
  amountUsd?: number;
};

export type OlxDetail = {
  totalUsd?: number;
  dealsCount?: number;
  deals?: OlxDealRow[];
};

type Props = {
  olxList: OlxListItem[];
  olxLoading: boolean;
  selectedOlx: OlxListItem | null;
  olxDetail: OlxDetail | null;
  olxDetailLoading: boolean;
  salaryPeriod: string;
  onPeriodChange: (period: string) => void;
  onAdd: () => void;
  onOpenReport: (m: OlxListItem) => void;
  onEdit: (m: OlxListItem) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
};

export function OlxTab({
  olxList,
  olxLoading,
  selectedOlx,
  olxDetail,
  olxDetailLoading,
  salaryPeriod,
  onPeriodChange,
  onAdd,
  onOpenReport,
  onEdit,
  onDelete,
  onBack,
}: Props) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {!selectedOlx ? (
        <>
          <div className="page-header">
            <div className="page-header-left">
              <div className="page-header-title">ОЛХ</div>
              <div className="page-header-sub">
                Справочник ОЛХ: % от поступления после посредника
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={onAdd}>
              + Добавить
            </button>
          </div>
          {olxLoading ? (
            <div style={{ padding: "50px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
          ) : olxList.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
              Нет ОЛХ. Добавьте первого — его можно будет выбрать при создании сделки.
            </div>
          ) : (
            <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 120px auto",
                  padding: "8px 20px",
                  borderBottom: "1px solid var(--border-light)",
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  gap: 8,
                }}
              >
                <span>Имя</span>
                <span>% по умолч.</span>
                <span>Телефон</span>
                <span />
              </div>
              {olxList.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 120px auto",
                    padding: "12px 20px",
                    gap: 8,
                    alignItems: "center",
                    borderBottom: "1px solid var(--border-light)",
                    opacity: m.isActive === false ? 0.5 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                    {m.note && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.note}</div>}
                  </div>
                  <span style={{ fontSize: 13 }}>{m.defaultPct != null ? `${m.defaultPct}%` : "—"}</span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{m.phone || "—"}</span>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => onOpenReport(m)}>
                      Отчёт
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => onEdit(m)}>
                      Изм.
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <button type="button" className="btn btn-secondary" style={{ width: "fit-content" }} onClick={onBack}>
            ← К списку
          </button>
          <div className="page-header" style={{ margin: 0 }}>
            <div className="page-header-left">
              <div className="page-header-title">{selectedOlx.name}</div>
              <div className="page-header-sub">
                {selectedOlx.defaultPct != null ? `По умолчанию ${selectedOlx.defaultPct}% · ` : ""}
                {selectedOlx.phone || "без телефона"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="month"
                value={salaryPeriod}
                onChange={(e) => onPeriodChange(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={() => onEdit(selectedOlx)}>
                Изменить
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => onDelete(selectedOlx.id)}>
                Удалить
              </button>
            </div>
          </div>
          {olxDetailLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
          ) : olxDetail ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                <div style={{ padding: "18px 22px", borderRadius: 14, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Итого за {salaryPeriod}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#D97706" }}>
                    ${(olxDetail.totalUsd ?? 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                    Сделок: {olxDetail.dealsCount ?? 0}
                  </div>
                </div>
                <div style={{ padding: "18px 22px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Как считается</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.5 }}>
                    Сумма по каждой сделке из шаблона (% ОЛХ от поступления или % в карточке сделки), в USD по курсу на дату сделки.
                    Прошлые месяцы пересчитываются автоматически.
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", fontWeight: 600 }}>Сделки</div>
                {(olxDetail.deals ?? []).length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Нет сделок за период</div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 80px 100px",
                        padding: "8px 20px",
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase",
                        gap: 8,
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <span>Сделка</span>
                      <span>Дата</span>
                      <span style={{ textAlign: "right" }}>%</span>
                      <span style={{ textAlign: "right" }}>USD</span>
                    </div>
                    {(olxDetail.deals ?? []).map((d) => (
                      <div
                        key={d.dealId}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 100px 80px 100px",
                          padding: "10px 20px",
                          gap: 8,
                          alignItems: "center",
                          borderBottom: "1px solid var(--border-light)",
                          fontSize: 13,
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{d.title || d.dealId.slice(0, 8)}</span>
                        <span style={{ color: "var(--text-tertiary)" }}>
                          {d.dealDate ? new Date(d.dealDate).toLocaleDateString("ru") : "—"}
                        </span>
                        <span style={{ textAlign: "right" }}>{d.pct}%</span>
                        <span style={{ textAlign: "right", fontWeight: 600, color: "#D97706" }}>
                          ${(d.amountUsd ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
