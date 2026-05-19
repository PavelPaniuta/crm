"use client";

import type { ClientKanbanColumn, ClientListItem } from "@/lib/clients";

type Props = {
  columns: ClientKanbanColumn[];
  onSelectClient: (client: ClientListItem) => void;
};

export function ClientsKanbanBoard({ columns, onSelectClient }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "stretch",
        overflowX: "auto",
        paddingBottom: 6,
        maxHeight: "calc(100vh - 240px)",
        minHeight: 280,
      }}
    >
      {columns.map((col) => {
        const accent = col.color || "var(--accent)";
        const tint = col.color ? `${col.color}12` : "var(--bg-metric)";
        return (
          <div
            key={col.key}
            style={{
              flex: "0 0 268px",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              maxHeight: "100%",
              borderRadius: 12,
              border: "1px solid var(--border-light)",
              background: "var(--bg-card)",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                padding: "8px 12px",
                background: tint,
                borderBottom: "1px solid var(--border-light)",
                borderLeft: `3px solid ${accent}`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.3 }}>
                {col.label}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{col.clients.length} шт.</div>
            </div>
            <div
              role="list"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {col.clients.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    padding: "16px 8px",
                    textAlign: "center",
                    lineHeight: 1.45,
                  }}
                >
                  Нет клиентов
                </div>
              ) : (
                col.clients.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectClient(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectClient(c);
                      }
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--border-light)",
                      background: "var(--bg-card)",
                      cursor: "pointer",
                      transition: "box-shadow 0.12s ease, border-color 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                      e.currentTarget.style.borderColor = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.borderColor = "var(--border-light)";
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "var(--green-bg)",
                          color: "var(--green-text)",
                          fontWeight: 700,
                          fontSize: 11,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {(c.name || "?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            lineHeight: 1.25,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.name}
                        </div>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            marginTop: 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.phone}
                        </div>
                      </div>
                    </div>
                    {c.bank || c.assistantName ? (
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-secondary)",
                          marginTop: 6,
                          lineHeight: 1.35,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={[c.bank, c.assistantName].filter(Boolean).join(" · ")}
                      >
                        {[c.bank, c.assistantName].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
