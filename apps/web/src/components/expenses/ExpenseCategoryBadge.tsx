"use client";

type Props = {
  name: string;
  color?: string | null;
};

export function ExpenseCategoryBadge({ name, color }: Props) {
  const bg = color ? `${color}22` : "var(--bg-metric)";
  const fg = color || "var(--text-secondary)";
  return (
    <span
      className="badge"
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${color ? `${color}44` : "var(--border-light)"}`,
      }}
    >
      {name}
    </span>
  );
}
