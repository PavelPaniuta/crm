"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  fetchChatContacts,
  fetchChatConversations,
  fetchChatMessages,
  fetchChatUnreadCount,
  markChatRead,
  sendChatMessageApi,
  type ChatContact,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/chat";

type Props = {
  active: boolean;
  userId: string | undefined;
  onUnreadChange?: (count: number) => void;
};

export function ChatTab({ active, userId, onUnreadChange }: Props) {
  const [chatContacts, setChatContacts] = useState<ChatContact[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [chatActiveUser, setChatActiveUser] = useState<ChatContact | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatShowContacts, setChatShowContacts] = useState(false);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const chatActiveUserRef = useRef<ChatContact | null>(null);

  async function loadChatUnread() {
    const count = await fetchChatUnreadCount();
    onUnreadChange?.(count);
  }

  async function openChatWith(contact: ChatContact) {
    chatActiveUserRef.current = contact;
    setChatActiveUser(contact);
    setChatMessages([]);
    setChatShowContacts(false);
    setChatLoading(true);
    try {
      setChatMessages(await fetchChatMessages(contact.id, 50));
      await markChatRead(contact.id);
      setChatConversations((prev) =>
        prev.map((c) => (c.user?.id === contact.id ? { ...c, unread: 0 } : c)),
      );
    } finally {
      setChatLoading(false);
    }
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "instant" }), 80);
  }

  async function pollChatMessages() {
    const activeUser = chatActiveUserRef.current;
    if (!activeUser) return;
    try {
      const msgs = await fetchChatMessages(activeUser.id, 20);
      setChatMessages((prev) => {
        if (prev.length === 0) return msgs;
        const existIds = new Set(prev.map((m) => m.id));
        const newOnes = msgs.filter((m) => !existIds.has(m.id));
        if (!newOnes.length) return prev;
        void markChatRead(activeUser.id);
        return [...prev, ...newOnes];
      });
    } catch {
      /* ignore */
    }
    const convs = await fetchChatConversations();
    setChatConversations(convs);
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatSending || !chatActiveUser) return;
    setChatSending(true);
    setChatInput("");
    try {
      const msg = await sendChatMessageApi(chatActiveUser.id, text);
      if (msg) {
        setChatMessages((prev) => [...prev, msg]);
        setChatConversations(await fetchChatConversations());
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally {
      setChatSending(false);
    }
  }

  useEffect(() => {
    if (!active) {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
      return;
    }
    void (async () => {
      setChatContacts(await fetchChatContacts());
      setChatConversations(await fetchChatConversations());
    })();
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    chatPollRef.current = setInterval(() => {
      void pollChatMessages();
      void loadChatUnread();
    }, 5000);
    return () => {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (active) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [chatMessages, active]);

  if (!active) return null;

  return (
    <div className="chat-container">

              {/* Left: contacts / conversations */}
              <div className={`chat-sidebar${chatActiveUser ? " chat-sidebar--hidden" : ""}`}>
                <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Сообщения</div>
                  <button
                    className="btn btn-secondary"
                    style={{ height: 28, fontSize: 11, padding: "0 10px" }}
                    onClick={() => setChatShowContacts(v => !v)}
                    title="Новый чат"
                  >+ Новый</button>
                </div>

                {/* New chat: pick a contact */}
                {chatShowContacts && (
                  <div style={{ borderBottom: "1px solid var(--border)", maxHeight: 220, overflowY: "auto" }}>
                    <div style={{ padding: "8px 12px 4px", fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Сотрудники</div>
                    {chatContacts.map(c => (
                      <div
                        key={c.id}
                        onClick={() => void openChatWith(c)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {(c.name || c.email)[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name || c.email}</div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.position || c.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Existing conversations */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {chatConversations.length === 0 && !chatShowContacts && (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                      Нажмите «+ Новый» чтобы начать переписку
                    </div>
                  )}
                  {chatConversations.map(conv => {
                    if (!conv.user) return null;
                    const isActive = chatActiveUser?.id === conv.user.id;
                    return (
                      <div
                        key={conv.user.id}
                        onClick={() => void openChatWith(conv.user!)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer",
                          background: isActive ? "var(--accent-light)" : "transparent",
                          borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                          transition: "background 0.15s",
                        }}
                      >
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-hover)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
                            {(conv.user.name || conv.user.email)[0].toUpperCase()}
                          </div>
                          {conv.unread > 0 && (
                            <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {conv.unread > 9 ? "9+" : conv.unread}
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: conv.unread > 0 ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {conv.user.name || conv.user.email}
                          </div>
                          {conv.lastMessage && (
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                              {conv.lastMessage.sender.id === userId ? "Вы: " : ""}{conv.lastMessage.body}
                            </div>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0 }}>
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: message area */}
              <div className={`chat-main${chatActiveUser ? " chat-main--visible" : ""}`}>
                {!chatActiveUser ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", gap: 12 }}>
                    <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" style={{ opacity: 0.3 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <div style={{ fontWeight: 600, fontSize: 15, opacity: 0.6 }}>Выберите собеседника</div>
                    <div style={{ fontSize: 13, opacity: 0.5 }}>Все сообщения шифруются AES-256</div>
                  </div>
                ) : (
                  <>
                    {/* Chat header */}
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <button className="chat-back-btn" onClick={() => { chatActiveUserRef.current = null; setChatActiveUser(null); }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                      </button>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                        {(chatActiveUser.name || chatActiveUser.email)[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chatActiveUser.name || chatActiveUser.email}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{chatActiveUser.position || chatActiveUser.role}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        AES-256
                      </div>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {chatLoading && chatMessages.length === 0 ? (
                        <div style={{ textAlign: "center", color: "var(--text-tertiary)", paddingTop: 40 }}>Загрузка…</div>
                      ) : chatMessages.length === 0 ? (
                        <div style={{ textAlign: "center", color: "var(--text-tertiary)", paddingTop: 40 }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>Начните общение</div>
                          <div style={{ fontSize: 13 }}>Напишите {chatActiveUser.name || chatActiveUser.email}</div>
                        </div>
                      ) : chatMessages.map((m, i) => {
                        const isMe = m.sender.id === userId;
                        const prev = chatMessages[i - 1];
                        const msgDate = new Date(m.createdAt);
                        const prevDate = prev ? new Date(prev.createdAt) : null;
                        const showDate = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
                        const grouped = prev && prev.sender.id === m.sender.id && !showDate;
                        return (
                          <div key={m.id}>
                            {showDate && (
                              <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-tertiary)", margin: "10px 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
                                {msgDate.toLocaleDateString("ru-RU", { day: "2-digit", month: "long" })}
                                <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
                              </div>
                            )}
                            <div style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end", marginTop: grouped ? 2 : 8 }}>
                              <div style={{ maxWidth: "75%", minWidth: 40 }}>
                                <div style={{
                                  background: isMe ? "var(--accent)" : "var(--bg-hover)",
                                  color: isMe ? "#fff" : "var(--text-primary)",
                                  borderRadius: isMe
                                    ? (grouped ? "16px 4px 4px 16px" : "16px 16px 4px 16px")
                                    : (grouped ? "4px 16px 16px 4px" : "16px 16px 16px 4px"),
                                  padding: "9px 14px",
                                  fontSize: 14, lineHeight: 1.5,
                                  wordBreak: "break-word",
                                  boxShadow: isMe ? "0 2px 6px rgba(99,102,241,0.2)" : "var(--shadow-sm)",
                                }}>
                                  {m.body}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, textAlign: isMe ? "right" : "left", paddingLeft: isMe ? 0 : 2, paddingRight: isMe ? 2 : 0 }}>
                                  {msgDate.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Input */}
                    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
                      <textarea
                        className="form-input"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChatMessage(); } }}
                        placeholder={`Написать ${chatActiveUser.name || chatActiveUser.email}… (Enter — отправить)`}
                        rows={1}
                        style={{ flex: 1, resize: "none", minHeight: 40, maxHeight: 120, overflowY: "auto", lineHeight: 1.5 }}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ height: 40, minWidth: 44, padding: "0 14px" }}
                        disabled={!chatInput.trim() || chatSending}
                        onClick={() => void sendChatMessage()}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
  );
}
