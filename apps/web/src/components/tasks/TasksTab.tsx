"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TASK_STATUS_BADGE,
  TASK_STATUS_LABELS,
  createTaskApi,
  deleteTaskApi,
  fetchTaskComments,
  fetchTaskPendingCount,
  fetchTaskUserOptions,
  fetchTasks,
  patchTaskApi,
  postTaskComment,
  type CrmTask,
  type TaskComment,
  type TaskStatus,
  type TaskUserOption,
} from "@/lib/tasks";

type Props = {
  active: boolean;
  userId: string | undefined;
  isManager: boolean;
  onPendingCountChange?: (count: number) => void;
};

export function TasksTab({ active, userId, isManager, onPendingCountChange }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "done">("active");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskFormTitle, setTaskFormTitle] = useState("");
  const [taskFormDesc, setTaskFormDesc] = useState("");
  const [taskFormAssigneeId, setTaskFormAssigneeId] = useState("");
  const [taskFormDue, setTaskFormDue] = useState("");
  const [taskFormStart, setTaskFormStart] = useState("");
  const [taskUsersForSelect, setTaskUsersForSelect] = useState<TaskUserOption[]>([]);
  const [taskDetail, setTaskDetail] = useState<CrmTask | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskCommentsLoading, setTaskCommentsLoading] = useState(false);
  const [taskCommentInput, setTaskCommentInput] = useState("");
  const [taskCommentSending, setTaskCommentSending] = useState(false);
  const [taskEditMode, setTaskEditMode] = useState(false);
  const [taskEditTitle, setTaskEditTitle] = useState("");
  const [taskEditDesc, setTaskEditDesc] = useState("");
  const [taskEditDue, setTaskEditDue] = useState("");
  const [taskEditStart, setTaskEditStart] = useState("");
  const [taskEditAssigneeId, setTaskEditAssigneeId] = useState("");
  const taskCommentAbortRef = useRef<AbortController | null>(null);

  const refreshPendingCount = useCallback(async () => {
    onPendingCountChange?.(await fetchTaskPendingCount());
  }, [onPendingCountChange]);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await fetch("/api/tasks", { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      setTasks(await fetchTasks());
    } finally { setTasksLoading(false); }
    await refreshPendingCount();
  }, [router, refreshPendingCount]);

  const loadTaskUserOptions = useCallback(async () => {
    if (!isManager) return;
    setTaskUsersForSelect(await fetchTaskUserOptions());
  }, [isManager]);

  useEffect(() => {
    if (!active) return;
    void loadTasks();
    if (isManager) void loadTaskUserOptions();
  }, [active, isManager, loadTasks, loadTaskUserOptions]);

  const patchTask = async (id: string, body: Record<string, unknown>) => {
    const result = await patchTaskApi(id, body);
    if (result.ok) {
      setTasks((prev) => prev.map((t) => (t.id === id ? result.task : t)));
      setTaskDetail((prev) => (prev?.id === id ? result.task : prev));
      await refreshPendingCount();
      return true;
    }
    alert(result.message);
    return false;
  };

  const createTaskFromModal = async () => {
    if (!taskFormTitle.trim() || !taskFormAssigneeId) return;
    const result = await createTaskApi({
      title: taskFormTitle.trim(),
      description: taskFormDesc.trim() || null,
      assigneeId: taskFormAssigneeId,
      dueAt: taskFormDue || null,
      startsAt: taskFormStart || null,
    });
    if (!result.ok) return alert(result.message);
    setTaskModalOpen(false);
    setTaskFormTitle(""); setTaskFormDesc(""); setTaskFormAssigneeId("");
    setTaskFormDue(""); setTaskFormStart("");
    await loadTasks();
  };

  const deleteTaskById = async (id: string) => {
    if (!confirm("Удалить задачу?")) return;
    if (await deleteTaskApi(id)) {
      if (taskDetail?.id === id) setTaskDetail(null);
      await loadTasks();
    }
  };

  const openTaskDetail = async (t: CrmTask) => {
    taskCommentAbortRef.current?.abort();
    const controller = new AbortController();
    taskCommentAbortRef.current = controller;
    setTaskDetail(t);
    setTaskEditMode(false);
    setTaskComments([]);
    setTaskCommentInput("");
    setTaskCommentsLoading(true);
    try {
      setTaskComments(await fetchTaskComments(t.id, controller.signal));
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") throw e;
    } finally { setTaskCommentsLoading(false); }
  };

  const submitTaskComment = async () => {
    if (!taskDetail || !taskCommentInput.trim() || taskCommentSending) return;
    setTaskCommentSending(true);
    try {
      const c = await postTaskComment(taskDetail.id, taskCommentInput.trim());
      if (c) { setTaskComments((prev) => [...prev, c]); setTaskCommentInput(""); }
    } finally { setTaskCommentSending(false); }
  };

  const saveTaskEdit = async () => {
    if (!taskDetail || !taskEditTitle.trim()) return;
    const ok = await patchTask(taskDetail.id, {
      title: taskEditTitle.trim(),
      description: taskEditDesc.trim() || null,
      dueAt: taskEditDue || null,
      startsAt: taskEditStart || null,
      assigneeId: taskEditAssigneeId || undefined,
    });
    if (ok) setTaskEditMode(false);
  };

  if (!active && !taskDetail) return null;

  return (
    <>
      {active ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="page-header">
                <div className="page-header-left">
                  <div className="page-header-title">Задачи</div>
                  <div className="page-header-sub">Назначайте сроки, отслеживайте статусы. Исполнители получают письмо о новой задаче.</div>
                </div>
                {isManager && (
                  <div className="page-header-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => { setTaskModalOpen(true); void loadTaskUserOptions(); }}
                    >+ Новая задача</button>
                  </div>
                )}
              </div>
              <div className="filter-tabs" style={{ width: "fit-content" }}>
                {([
                  { id: "active" as const, label: "Активные" },
                  { id: "all" as const, label: "Все" },
                  { id: "done" as const, label: "Архив" },
                ]).map((f) => (
                  <button key={f.id} type="button" className={`filter-tab ${taskFilter === f.id ? "active" : ""}`} onClick={() => setTaskFilter(f.id)}>{f.label}</button>
                ))}
              </div>
              {tasksLoading ? (
                <div style={{ color: "var(--text-secondary)" }}>Загрузка…</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {tasks
                    .filter((t) => {
                      if (taskFilter === "active") return t.status === "PENDING" || t.status === "IN_PROGRESS";
                      if (taskFilter === "done") return t.status === "DONE" || t.status === "CANCELLED";
                      return true;
                    })
                    .map((t) => {
                      const isMine = userId === t.assignee.id;
                      const due = t.dueAt ? new Date(t.dueAt) : null;
                      const overdue = !!(due && due < new Date() && t.status !== "DONE" && t.status !== "CANCELLED");
                      // status labels from lib
                      return (
                        <div
                          key={t.id}
                          className={`task-card${isMine && t.status !== "DONE" && t.status !== "CANCELLED" ? " task-card--mine" : ""}${overdue ? " task-card--due" : ""}${t.status === "DONE" ? " task-card--done" : ""}`}
                          style={{ cursor: "pointer" }}
                          onClick={() => void openTaskDetail(t)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <h3 style={{ margin: 0, flex: 1 }}>{t.title}</h3>
                            <span className={`badge ${TASK_STATUS_BADGE[t.status]}`}>
                              {TASK_STATUS_LABELS[t.status]}
                            </span>
                          </div>
                          {t.description && <div className="task-card-desc">{t.description}</div>}
                          <div className="task-card-meta">
                            <span>👤 {t.assignee.name || t.assignee.email}</span>
                            <span>·</span>
                            <span>от {t.createdBy.name || t.createdBy.email}</span>
                            {t.dueAt && (
                              <>
                                <span>·</span>
                                <span className="mono" style={overdue ? { color: "var(--amber)" } : {}}>до {new Date(t.dueAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              </>
                            )}
                          </div>
                          <div className="task-card-actions" onClick={e => e.stopPropagation()}>
                            {isMine && t.status !== "DONE" && t.status !== "CANCELLED" && (
                              <>
                                {t.status === "PENDING" && (
                                  <button className="btn btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => void patchTask(t.id, { status: "IN_PROGRESS" })}>Взять в работу</button>
                                )}
                                <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} onClick={() => void patchTask(t.id, { status: "DONE" })}>Выполнено</button>
                              </>
                            )}
                            {isManager && (
                              <button className="btn btn-ghost" style={{ height: 30, fontSize: 12, color: "var(--red-text)" }} onClick={() => void deleteTaskById(t.id)}>Удалить</button>
                            )}
                            <button className="btn btn-ghost" style={{ height: 30, fontSize: 12, marginLeft: "auto" }}>Открыть →</button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {!tasksLoading && tasks.filter((t) => taskFilter === "active" ? t.status === "PENDING" || t.status === "IN_PROGRESS" : taskFilter === "done" ? t.status === "DONE" || t.status === "CANCELLED" : true).length === 0 && (
                <div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-state-icon">
                    <svg width="24" height="24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  </div>
                  <div className="empty-state-title">Нет задач</div>
                  <div className="empty-state-desc">{isManager ? "Создайте задачу для сотрудника — он получит письмо" : "Вам пока ничего не назначили"}</div>
                </div>
              )}
              {taskModalOpen && isManager && (
                <div
                  className="modal-backdrop"
                  style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60, backdropFilter: "blur(2px)" }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) setTaskModalOpen(false); }}
                >
                  <div className="card" style={{ width: 480, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="card-title">Новая задача</span>
                      <button className="btn btn-secondary" onClick={() => setTaskModalOpen(false)}>×</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 14 }}>
                      <div>
                        <div className="form-label">Название *</div>
                        <input className="form-input" value={taskFormTitle} onChange={(e) => setTaskFormTitle(e.target.value)} placeholder="Кратко, что сделать" />
                      </div>
                      <div>
                        <div className="form-label">Описание</div>
                        <textarea className="form-input" value={taskFormDesc} onChange={(e) => setTaskFormDesc(e.target.value)} rows={3} placeholder="Детали" />
                      </div>
                      <div>
                        <div className="form-label">Исполнитель *</div>
                        <select className="form-input" value={taskFormAssigneeId} onChange={(e) => setTaskFormAssigneeId(e.target.value)}>
                          <option value="">Выберите</option>
                          {taskUsersForSelect.map((u) => (
                            <option key={u.id} value={u.id}>{u.name || u.email} ({u.email})</option>
                          ))}
                        </select>
                      </div>
                      <div className="g2">
                        <div>
                          <div className="form-label">Начало</div>
                          <input className="form-input" type="datetime-local" value={taskFormStart} onChange={(e) => setTaskFormStart(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">Срок</div>
                          <input className="form-input" type="datetime-local" value={taskFormDue} onChange={(e) => setTaskFormDue(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => setTaskModalOpen(false)}>Отмена</button>
                        <button className="btn btn-primary" onClick={() => void createTaskFromModal()} disabled={!taskFormTitle.trim() || !taskFormAssigneeId}>Создать</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
      ) : null}
      {/* ===== TASK DETAIL DRAWER ===== */}
      {taskDetail && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 70, backdropFilter: "blur(2px)" }}
            onClick={() => setTaskDetail(null)}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "min(500px, 100vw)", zIndex: 71,
            background: "var(--bg-card)", boxShadow: "-8px 0 40px rgba(0,0,0,0.2)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {taskEditMode ? (
                  <input
                    className="form-input"
                    value={taskEditTitle}
                    onChange={e => setTaskEditTitle(e.target.value)}
                    style={{ fontWeight: 700, fontSize: 16 }}
                    autoFocus
                  />
                ) : (
                  <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{taskDetail.title}</div>
                )}
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>
                  от {taskDetail.createdBy.name || taskDetail.createdBy.email} · {new Date(taskDetail.createdAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
              {isManager && !taskEditMode && (
                <button className="btn btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => {
                  setTaskEditMode(true);
                  setTaskEditTitle(taskDetail.title);
                  setTaskEditDesc(taskDetail.description ?? "");
                  setTaskEditDue(taskDetail.dueAt ? taskDetail.dueAt.slice(0, 16) : "");
                  setTaskEditStart(taskDetail.startsAt ? taskDetail.startsAt.slice(0, 16) : "");
                  setTaskEditAssigneeId(taskDetail.assignee.id);
                  void loadTaskUserOptions();
                }}>Редактировать</button>
              )}
              {taskEditMode && (
                <>
                  <button className="btn btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => void saveTaskEdit()}>Сохранить</button>
                  <button className="btn btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => setTaskEditMode(false)}>Отмена</button>
                </>
              )}
              <button className="btn btn-ghost" style={{ height: 32, width: 32, padding: 0, fontSize: 18, flexShrink: 0 }} onClick={() => setTaskDetail(null)}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Status + badge */}
              {!taskEditMode && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {(() => {
                    
                    
                    return <span className={`badge ${TASK_STATUS_BADGE[taskDetail.status]}`}>{TASK_STATUS_LABELS[taskDetail.status]}</span>;
                  })()}
                  {taskDetail.dueAt && (
                    <span style={{ fontSize: 12, color: new Date(taskDetail.dueAt) < new Date() && taskDetail.status !== "DONE" ? "var(--amber)" : "var(--text-tertiary)" }}>
                      Срок: {new Date(taskDetail.dueAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {/* Quick status actions for assignee */}
                  {userId === taskDetail.assignee.id && taskDetail.status !== "DONE" && taskDetail.status !== "CANCELLED" && (
                    <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                      {taskDetail.status === "PENDING" && (
                        <button className="btn btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={() => void patchTask(taskDetail.id, { status: "IN_PROGRESS" }).then(() => setTaskDetail(prev => prev ? { ...prev, status: "IN_PROGRESS" } : null))}>Взять в работу</button>
                      )}
                      <button className="btn btn-primary" style={{ height: 28, fontSize: 11 }} onClick={() => void patchTask(taskDetail.id, { status: "DONE" }).then(() => { setTaskDetail(prev => prev ? { ...prev, status: "DONE" } : null); void refreshPendingCount(); })}>Выполнено ✓</button>
                    </div>
                  )}
                </div>
              )}

              {/* Edit form */}
              {taskEditMode && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div className="form-label">Описание</div>
                    <textarea className="form-input" rows={3} value={taskEditDesc} onChange={e => setTaskEditDesc(e.target.value)} placeholder="Детали задачи" />
                  </div>
                  <div>
                    <div className="form-label">Исполнитель</div>
                    <select className="form-input" value={taskEditAssigneeId} onChange={e => setTaskEditAssigneeId(e.target.value)}>
                      {taskUsersForSelect.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                    </select>
                  </div>
                  <div className="g2">
                    <div>
                      <div className="form-label">Начало</div>
                      <input className="form-input" type="datetime-local" value={taskEditStart} onChange={e => setTaskEditStart(e.target.value)} />
                    </div>
                    <div>
                      <div className="form-label">Срок</div>
                      <input className="form-input" type="datetime-local" value={taskEditDue} onChange={e => setTaskEditDue(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Description (view) */}
              {!taskEditMode && taskDetail.description && (
                <div>
                  <div className="form-label" style={{ marginBottom: 6 }}>Описание</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", background: "var(--bg-metric)", borderRadius: 10, padding: "12px 14px" }}>
                    {taskDetail.description}
                  </div>
                </div>
              )}

              {/* Info row */}
              {!taskEditMode && (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>👤 Исполнитель: <strong>{taskDetail.assignee.name || taskDetail.assignee.email}</strong></span>
                  {taskDetail.startsAt && <span>📅 Начало: {new Date(taskDetail.startsAt).toLocaleDateString("ru-RU")}</span>}
                </div>
              )}

              {/* Comments */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                  Комментарии {taskComments.length > 0 && <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>({taskComments.length})</span>}
                </div>
                {taskCommentsLoading ? (
                  <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка…</div>
                ) : taskComments.length === 0 ? (
                  <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Комментариев пока нет — напишите первым!</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {taskComments.map(c => (
                      <div key={c.id} style={{ display: "flex", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                          {(c.author.name || c.author.email)[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                            {c.author.name || c.author.email}
                            <span style={{ fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 8 }}>{new Date(c.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.5, background: "var(--bg-hover)", borderRadius: 10, padding: "8px 12px" }}>{c.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment input */}
            <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
              <textarea
                className="form-input"
                value={taskCommentInput}
                onChange={e => setTaskCommentInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitTaskComment(); } }}
                placeholder="Комментарий… (Enter — отправить)"
                rows={1}
                style={{ flex: 1, resize: "none", minHeight: 38, maxHeight: 100, overflowY: "auto" }}
              />
              <button
                className="btn btn-primary"
                style={{ height: 38, minWidth: 38, padding: "0 12px" }}
                disabled={!taskCommentInput.trim() || taskCommentSending}
                onClick={() => void submitTaskComment()}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
