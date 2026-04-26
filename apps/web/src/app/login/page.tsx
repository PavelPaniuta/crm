"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }} autoComplete="off">
            <div>
              <div className="form-label">Email / Логин</div>
              <input
                className="form-input"
                type="text"
                name="login"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                placeholder="Введите логин"
              />
            </div>
            <div>
              <div className="form-label">Пароль</div>
              <input
                className="form-input"
                type="password"
                name="pwd"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Введите пароль"
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
        <div
          className="modal-backdrop"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100, backdropFilter: "blur(2px)" }}
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 420, borderRadius: "var(--radius-xl)", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="card-title">Восстановление пароля</span>
              <button onClick={() => setForgotOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}>✕</button>
            </div>
            <div className="card-body">
              {forgotDone ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
                  <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Письмо отправлено!</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
                    Если аккаунт с адресом <strong>{forgotEmail}</strong> существует — вам придёт письмо со ссылкой для сброса пароля.<br />
                    Ссылка действительна 30 минут.
                  </p>
                  <button className="btn btn-primary" style={{ marginTop: 20, width: "100%" }} onClick={() => setForgotOpen(false)}>
                    Закрыть
                  </button>
                </div>
              ) : (
                <form onSubmit={onForgot} style={{ display: "grid", gap: 16 }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
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
                    <div style={{ color: "var(--red-text)", background: "var(--red-bg)", padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
                      {forgotError}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
