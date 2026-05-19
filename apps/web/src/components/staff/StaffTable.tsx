"use client";

const ROLE_MAP: Record<string, string> = {
  SUPER_ADMIN: "Супер Админ",
  ADMIN: "Админ",
  MANAGER: "Менеджер",
  WORKER: "Работник",
};

export type StaffMemberRow = {
  id: string;
  name?: string | null;
  email: string;
  position?: string | null;
  role: string;
  dealsCount?: number;
  totalPayout?: number;
};

type Props = {
  members: StaffMemberRow[];
  onSelect: (id: string) => void;
};

export function StaffTable({ members, onSelect }: Props) {
  if (!members || members.length === 0) {
    return (
      <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
        Нет сотрудников
      </div>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
            {["Сотрудник", "Должность", "Роль", "Сделок", "Выплаты"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "6px 8px",
                  textAlign: "left",
                  color: "var(--text-tertiary)",
                  fontWeight: 500,
                  fontSize: 11,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.id}
              style={{ borderBottom: "1px solid var(--border-color)", cursor: "pointer" }}
              onClick={() => onSelect(m.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "";
              }}
            >
              <td style={{ padding: "10px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {(m.name || m.email)?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.name || m.email}</div>
                    {m.name && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.email}</div>}
                  </div>
                </div>
              </td>
              <td style={{ padding: "10px 8px", color: "var(--text-secondary)" }}>{m.position || "—"}</td>
              <td style={{ padding: "10px 8px" }}>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 11,
                    background: "var(--accent)22",
                    color: "var(--accent)",
                  }}
                >
                  {ROLE_MAP[m.role] ?? m.role}
                </span>
              </td>
              <td style={{ padding: "10px 8px", color: "var(--text-tertiary)" }}>{m.dealsCount}</td>
              <td
                style={{
                  padding: "10px 8px",
                  fontWeight: 600,
                  color: (m.totalPayout ?? 0) > 0 ? "var(--accent)" : "var(--text-tertiary)",
                }}
              >
                {(m.totalPayout ?? 0) > 0 ? `$${m.totalPayout}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
