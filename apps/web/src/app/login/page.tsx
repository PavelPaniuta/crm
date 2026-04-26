"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Login failed");
      }
      router.replace("/app");
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Ошибка");
      }
      setForgotDone(true);
    } catch (err: any) {
      setForgotError(err?.message ?? "Ошибка");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="card-header">
          <span className="card-title">Вход в MyCRM</span>
        </div>
        <div className="card-body">
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <div>
              <div className="form-label">Email</div>
              <input
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <div className="form-label">Пароль</div>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <div style={{ color: "var(--red-text)", background: "var(--red-bg)", padding: 10, borderRadius: 10 }}>
                {error}
              </div>
            ) : null}

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Входим..." : "Войти"}
            </button>

            <button
              type="button"
              onClick={() => { setForgotOpen(true); setForgotEmail(email); setForgotDone(false); setForgotError(null); }}
              style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, textAlign: "center", padding: 0 }}
            >
              Забыли пароль?
            </button>
          </form>
        </div>
      </div>

      {forgotOpen && (
        <div className="modal-overlay" onClick={() => setForgotOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">Восстановление пароля</span>
              <button className="modal-close" onClick={() => setForgotOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {forgotDone ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                  <p style={{ fontWeight: 600, marginBottom: 8 }}>Письмо отправлено!</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                    Если аккаунт с адресом <strong>{forgotEmail}</strong> существует — вам придёт письмо со ссылкой для сброса пароля.<br />
                    Ссылка действительна 30 минут.
                  </p>
                  <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setForgotOpen(false)}>
                    Закрыть
                  </button>
                </div>
              ) : (
                <form onSubmit={onForgot} style={{ display: "grid", gap: 12 }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
                    Введите email вашего аккаунта. Мы отправим ссылку для сброса пароля.
                  </p>
                  <div>
                    <div className="form-label">Email</div>
                    <input
                      className="form-input"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  {forgotError && (
                    <div style={{ color: "var(--red-text)", background: "var(--red-bg)", padding: 10, borderRadius: 10, fontSize: 13 }}>
                      {forgotError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setForgotOpen(false)}>
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={forgotLoading}>
                      {forgotLoading ? "Отправляем..." : "Отправить письмо"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
