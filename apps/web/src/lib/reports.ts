/** API отчётов (учёт сделок, воркеры). */

export type WorkersReportRow = {
  userId: string;
  email: string;
  role: string;
  dealsCount: number;
  payoutUsdt: number;
};

export type WorkersReport = {
  range?: { from: string; to: string };
  rows: WorkersReportRow[];
};

export async function fetchWorkersReport(
  from: string,
  to: string,
): Promise<WorkersReport | null> {
  const res = await fetch(
    `/api/reports/workers?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { credentials: "include" },
  );
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return res.json();
}

export async function downloadAccountingExport(
  from: string,
  to: string,
): Promise<{ ok: true; filename: string } | { ok: false; message: string; unauthorized?: boolean }> {
  const res = await fetch(
    `/api/reports/accounting/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { credentials: "include" },
  );
  if (res.status === 401) return { ok: false, message: "Требуется вход", unauthorized: true };
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return { ok: false, message: (j as { message?: string }).message ?? "Не удалось сформировать отчёт" };
  }
  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition");
  const match = disp?.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] ?? `uchet-sdelok_${from}_${to}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true, filename };
}
