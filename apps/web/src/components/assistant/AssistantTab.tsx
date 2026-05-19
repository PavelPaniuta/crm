"use client";

import React, { useEffect, useState } from "react";
import {
  executeAgentPendingAction,
  fetchAiConfigured,
  sendAgentMessageApi,
  type AgentHistoryItem,
  type AgentPendingAction,
} from "@/lib/assistant";
import type { ClientPipelineStatus } from "@/lib/clients";

type Props = {
  active: boolean;
  clientStatuses: ClientPipelineStatus[];
  onClientCreated?: () => void;
};

export function AssistantTab({ active, clientStatuses, onClientCreated }: Props) {
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [agentHistory, setAgentHistory] = useState<AgentHistoryItem[]>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentPending, setAgentPending] = useState<AgentPendingAction | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (active && aiConfigured === null) {
      void fetchAiConfigured().then(setAiConfigured);
    }
  }, [active, aiConfigured]);

  async function sendAgentMessage(msg?: string) {
    const text = (msg ?? agentInput).trim();
    if (!text || agentLoading) return;
    const newHistory = [...agentHistory, { role: "user" as const, content: text }];
    setAgentHistory(newHistory);
    setAgentInput("");
    setAgentPending(null);
    setAgentLoading(true);
    try {
      const result = await sendAgentMessageApi(
        text,
        agentHistory.map((h) => ({ role: h.role, content: h.content })),
      );
      if (!result.ok) {
        setAgentHistory((h) => [
          ...h,
          { role: "assistant", content: `❌ Ошибка сервера (${result.status}): ${result.errorText}` },
        ]);
        return;
      }
      setAgentHistory((h) => [
        ...h,
        { role: "assistant", content: result.text, pendingAction: result.pendingAction },
      ]);
      if (result.pendingAction) setAgentPending(result.pendingAction);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setAgentHistory((h) => [...h, { role: "assistant", content: `❌ Ошибка сети: ${message}` }]);
    } finally {
      setAgentLoading(false);
    }
  }

  async function confirmAgentAction() {
    if (!agentPending) return;
    const pending = agentPending;
    setAgentPending(null);
    try {
      const content = await executeAgentPendingAction(pending, clientStatuses);
      setAgentHistory((h) => [...h, { role: "assistant", content }]);
      if (pending.type === "create_client") onClientCreated?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setAgentHistory((h) => [...h, { role: "assistant", content: `❌ ${message}` }]);
    }
  }

  function startVoice() {
    if (typeof window === "undefined") return;
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      alert("Браузер не поддерживает голосовой ввод. Используйте Chrome или Edge.");
      return;
    }
    const rec = new SR();
    rec.lang = "ru-RU";
    rec.interimResults = false;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setAgentInput(transcript);
    };
    rec.start();
  }

  if (!active) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", maxWidth: 820, margin: "0 auto", gap: 0 }}>

              {/* Not configured banner */}
              {aiConfigured === false && (
                <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 12, background: "#f59e0b22", border: "1px solid #f59e0b55", fontSize: 13, color: "#f59e0b", flexShrink: 0 }}>
                  ⚠️ <strong>AI не настроен.</strong> На сервере нет OPENAI_API_KEY. Добавьте в файл <code>.env</code> на VPS:<br/>
                  <code style={{ display: "block", marginTop: 6, padding: "4px 8px", background: "#0005", borderRadius: 6, fontFamily: "monospace" }}>OPENAI_API_KEY=sk-proj-...</code>
                  Затем: <code>docker compose up -d backend</code>
                </div>
              )}

              {/* Header */}
              <div className="card" style={{ padding: "16px 20px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, var(--accent), #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>✦</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>AI Ассистент</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    Сделки, расходы и карточки клиентов из текста или голоса — в том числе вставка уведомления о звонке
                  </div>
                </div>
                {agentHistory.length > 0 && (
                  <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => { setAgentHistory([]); setAgentPending(null); }}>
                    Очистить
                  </button>
                )}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
                {agentHistory.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "40px 20px" }}>
                    <div style={{ fontSize: 48 }}>✦</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Чем могу помочь?</div>
                      <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20 }}>Надиктуйте или напишите — или вставьте готовое уведомление о звонке: подготовлю карточку клиента на подтверждение</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600 }}>
                      {(
                        [
                          "Запиши сделку: вчера Ди и олх взяли 6838 от eurocom 75/25, закрыл Ант",
                          "Кто топ воркер этого месяца?",
                          "Запиши расход: аренда офиса 500$",
                          "Покажи статистику за неделю",
                          "Какой доход за апрель?",
                          {
                            label: "✅ Клиент из уведомления о звонке (пример)",
                            text: "✅ Новый звонок\n\n👤Ассистент: Robert Nowak PKO BP\n\n🏦Банк: PKO BP\n\n🧍‍♀️Клиент: Marta Rusowicz\n\n☎️Телефон: +48503703469\n\n📝 Summary: клиентка заявила, что не имеет счёта в PKO BP.\n⏰ Время начала звонка: 04.05.2026, 11:31",
                          },
                        ] as const
                      ).map((q) => {
                        const label = typeof q === "string" ? q : q.label;
                        const message = typeof q === "string" ? q : q.text;
                        return (
                        <button key={label} className="btn btn-secondary" style={{ fontSize: 12, padding: "8px 14px", textAlign: "left", lineHeight: 1.4 }}
                          onClick={() => sendAgentMessage(message)} disabled={agentLoading}>
                          {label}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  agentHistory.map((m, i) => (
                    <div key={i} style={{
                      display: "flex",
                      justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    }}>
                      {m.role === "assistant" && (
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginRight: 8, marginTop: 2 }}>✦</div>
                      )}
                      <div style={{
                        maxWidth: "75%",
                        padding: "12px 16px",
                        borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: m.role === "user" ? "var(--accent)" : "var(--bg-card)",
                        border: m.role === "assistant" ? "1px solid var(--border-light)" : "none",
                        color: m.role === "user" ? "#fff" : "var(--text-primary)",
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}>
                        {m.content}
                        {/* Confirm buttons */}
                        {m.role === "assistant" && m.pendingAction && agentPending && i === agentHistory.length - 1 && (
                          <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-light)" }}>
                            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={confirmAgentAction}>
                              ✅ Подтвердить
                            </button>
                            <button className="btn btn-secondary" style={{ fontSize: 13 }}
                              onClick={() => { setAgentPending(null); setAgentHistory(h => [...h, { role: "assistant", content: "Отменено. Что нужно изменить?" }]); }}>
                              ✏️ Изменить
                            </button>
                            <button className="btn btn-secondary" style={{ fontSize: 13, color: "var(--red)" }}
                              onClick={() => { setAgentPending(null); setAgentHistory(h => [...h, { role: "assistant", content: "Отменено." }]); }}>
                              ✕ Отмена
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {agentLoading && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✦</div>
                    <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "var(--bg-card)", border: "1px solid var(--border-light)", fontSize: 14, color: "var(--text-tertiary)" }}>
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <span style={{ animation: "pulse 1s ease-in-out infinite" }}>●</span>
                        <span style={{ animation: "pulse 1s ease-in-out 0.2s infinite" }}>●</span>
                        <span style={{ animation: "pulse 1s ease-in-out 0.4s infinite" }}>●</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="card" style={{ padding: "12px 16px", flexShrink: 0, marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea
                    className="form-input"
                    value={agentInput}
                    onChange={e => setAgentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAgentMessage(); } }}
                    placeholder="Напишите или надиктуйте... (Enter — отправить, Shift+Enter — новая строка)"
                    disabled={agentLoading}
                    rows={2}
                    style={{ flex: 1, resize: "none", lineHeight: 1.5, paddingTop: 10 }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      onClick={startVoice}
                      disabled={agentLoading}
                      title="Голосовой ввод (Chrome/Edge)"
                      style={{
                        width: 44, height: 44, borderRadius: 12, border: "none",
                        background: isListening ? "#ef4444" : "var(--bg-hover)",
                        cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s",
                        boxShadow: isListening ? "0 0 0 4px #ef444433" : "none",
                      }}
                    >
                      {isListening ? "⏹" : "🎤"}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => sendAgentMessage()}
                      disabled={agentLoading || !agentInput.trim()}
                      style={{ width: 44, height: 44, padding: 0, borderRadius: 12, fontSize: 18 }}
                    >→</button>
                  </div>
                </div>
                {isListening && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "pulse 1s ease-in-out infinite" }} />
                    Говорите... (Chrome слушает)
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
                  Можно вставить уведомление о звонке (клиент, телефон, банк, summary) — после подтверждения появится карточка в «Клиентах»
                </div>
              </div>

            </div>
  );
}
