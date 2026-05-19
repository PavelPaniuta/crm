export type TaskStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export type CrmTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  startsAt: string | null;
  dueAt: string | null;
  createdAt: string;
  assignee: { id: string; email: string; name: string | null };
  createdBy: { id: string; email: string; name: string | null };
};

export type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
};

export type TaskUserOption = {
  id: string;
  email: string;
  name?: string | null;
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "К выполнению",
  IN_PROGRESS: "В работе",
  DONE: "Выполнено",
  CANCELLED: "Отменена",
};

export const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  PENDING: "badge-amber",
  IN_PROGRESS: "badge-blue",
  DONE: "badge-green",
  CANCELLED: "badge-gray",
};

export async function fetchTasks(): Promise<CrmTask[]> {
  const res = await fetch("/api/tasks", { credentials: "include" });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

export async function fetchTaskPendingCount(): Promise<number> {
  try {
    const res = await fetch("/api/tasks/pending-count", { credentials: "include" });
    if (!res.ok) return 0;
    const j = await res.json();
    return j.count ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchTaskUserOptions(): Promise<TaskUserOption[]> {
  const res = await fetch("/api/users/public", { credentials: "include" });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

export async function createTaskApi(body: {
  title: string;
  description: string | null;
  assigneeId: string;
  dueAt: string | null;
  startsAt: string | null;
}): Promise<{ ok: true; task: CrmTask } | { ok: false; message: string }> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return { ok: false, message: (e as { message?: string }).message ?? "Ошибка" };
  }
  return { ok: true, task: await res.json() };
}

export async function patchTaskApi(
  id: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; task: CrmTask } | { ok: false; message: string }> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return { ok: false, message: (e as { message?: string }).message ?? "Ошибка" };
  }
  return { ok: true, task: await res.json() };
}

export async function deleteTaskApi(id: string): Promise<boolean> {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
  return res.ok;
}

export async function fetchTaskComments(taskId: string, signal?: AbortSignal): Promise<TaskComment[]> {
  const res = await fetch(`/api/tasks/${taskId}/comments`, { credentials: "include", signal });
  if (!res.ok) return [];
  return res.json();
}

export async function postTaskComment(taskId: string, body: string): Promise<TaskComment | null> {
  const res = await fetch(`/api/tasks/${taskId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) return null;
  return res.json();
}
