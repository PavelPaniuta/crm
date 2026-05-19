"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  deleteClientApi,
  fetchClientComments,
  postClientCommentApi,
  type ClientCommentEntry,
  type ClientFieldDef,
  type ClientListItem,
} from "@/lib/clients";

type Props = {
  client: ClientListItem | null;
  fieldDefs: ClientFieldDef[];
  onClose: () => void;
  onEdit: (client: ClientListItem) => void;
  onDeleted: () => void | Promise<void>;
};

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 56,
};

export function ClientViewModal({ client, fieldDefs, onClose, onEdit, onDeleted }: Props) {
  const [comments, setComments] = useState<ClientCommentEntry[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);

  useEffect(() => {
    if (!client) {
      setComments([]);
      setCommentText("");
      setCommentsLoading(false);
      return;
    }
    let cancelled = false;
    setCommentsLoading(true);
    void fetchClientComments(client.id)
      .then((list) => {
        if (!cancelled) setComments(list);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client?.id]);

  if (!client) return null;

  async function handleDelete() {
    if (!client) return;
    if (!confirm("Удалить клиента?")) return;
    try {
      await deleteClientApi(client.id);
      onClose();
      await onDeleted();
    } catch {
      alert("Не удалось удалить клиента");
    }
  }

  async function handlePostComment() {
    if (!client || !commentText.trim()) return;
    setCommentPosting(true);
    try {
      const created = await postClientCommentApi(client.id, commentText.trim());
      setComments((prev) => [...prev, created]);
      setCommentText("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось добавить комментарий");
    } finally {
      setCommentPosting(false);
    }
  }

  return (
    <div className="modal-backdrop" style={backdropStyle} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 520, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", margin: 0 }}>
        <div className="card-header" style={{ alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Клиент</div>
            <div className="card-title" style={{ marginTop: 4, lineHeight: 1.25 }}>{client.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{client.phone}</div>
            {client.status ? (
              <span className="badge" style={{ marginTop: 8, display: "inline-block", background: client.status.color ? `${client.status.color}22` : "var(--accent-light)", color: client.status.color ?? "var(--accent)", fontSize: 11 }}>
                {client.status.label}
              </span>
            ) : null}
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 14, fontSize: 13 }}>
          <DetailRow label="Банк" value={client.bank?.trim() || "—"} />
          <DetailRow label="Ассистент" value={client.assistantName?.trim() || "—"} />
          <DetailRow
            label="Начало звонка"
            value={
              client.callStartedAt
                ? new Date(client.callStartedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—"
            }
          />
          <div>
            <div style={{ color: "var(--text-tertiary)", fontSize: 12, marginBottom: 6 }}>Итог разговора</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, padding: "10px 12px", background: "var(--bg-metric)", borderRadius: 8, border: "1px solid var(--border-light)", maxHeight: 200, overflow: "auto" }}>
              {client.callSummary?.trim() || "—"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-tertiary)", fontSize: 12, marginBottom: 6 }}>Внутренняя заметка</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{client.note?.trim() || "—"}</div>
          </div>
          {fieldDefs.map((def) => {
            const raw = client.customData && typeof client.customData === "object" ? (client.customData as Record<string, unknown>)[def.key] : undefined;
            return <DetailRow key={def.id} label={def.label} value={raw != null && raw !== "" ? String(raw) : "—"} />;
          })}
          <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Комментарии</div>
            {commentsLoading ? (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "8px 0" }}>Загрузка…</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", margin: "10px 0" }}>
                {comments.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>Пока нет комментариев</div>
                ) : (
                  comments.map((cm) => (
                    <div key={cm.id} style={{ padding: "8px 10px", background: "var(--bg-metric)", borderRadius: 8, border: "1px solid var(--border-light)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4 }}>
                        {(cm.user.name || cm.user.email)} · {new Date(cm.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{cm.body}</div>
                    </div>
                  ))
                )}
              </div>
            )}
            <textarea className="form-input" rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Новый комментарий…" disabled={commentPosting} style={{ resize: "vertical", minHeight: 52 }} />
            <button type="button" className="btn btn-primary" style={{ marginTop: 8, width: "100%" }} disabled={!commentText.trim() || commentPosting} onClick={() => void handlePostComment()}>
              {commentPosting ? "Отправка…" : "Добавить комментарий"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", paddingTop: 4, borderTop: "1px solid var(--border-light)" }}>
            <button type="button" className="btn btn-secondary" onClick={() => void handleDelete()}>Удалить</button>
            <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEdit(client); }}>Редактировать</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, alignItems: "start" }}>
      <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{label}</span>
      <span style={{ wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}
