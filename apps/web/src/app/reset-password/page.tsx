"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    fetch(`/api/auth/check-reset-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => setTokenValid(!!j.valid))
      .catch(() => setTokenValid(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Пароли не совпадают"); return; }
    if (password.length < 6) { setError("Минимум 6 символов"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Ошибка");
      }
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="card-header">
          <span className="card-title">Новый пароль — MyCRM</span>
        </div>
        <div className="card-body">
          {tokenValid === null && (
            <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>Проверяем ссылку…</p>
          )}
          {tokenValid === false && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⛔</div>
              <p style={{ fontWeight: 600 }}>Ссылка недействительна</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                Ссылка устарела или уже была использована.<br />
                Запросите сброс пароля заново.
              </p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => router.replace("/login")}>
                На страницу входа
              </button>
            </div>
          )}
          {tokenValid === true && !done && (
            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <div>
                <div className="form-label">Новый пароль</div>
                <input
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div>
                <div className="form-label">Повторите пароль</div>
                <input
                  className="form-input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div style={{ color: "var(--red-text)", background: "var(--red-bg)", padding: 10, borderRadius: 10, fontSize: 13 }}>
                  {error}
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Сохраняем..." : "Сохранить пароль"}
              </button>
            </form>
          )}
          {done && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p style={{ fontWeight: 600 }}>Пароль успешно изменён!</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => router.replace("/login")}>
                Войти
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-shell"><p style={{ color: "var(--text-secondary)" }}>Загрузка…</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
