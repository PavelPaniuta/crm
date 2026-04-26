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
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "var(--accent)", color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 800, marginBottom: 12, boxShadow: "0 4px 16px rgba(99,102,241,0.35)"
          }}>M</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>MyCRM</div>
        </div>

        <div className="card" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
          <div className="card-header">
            <span className="card-title">
              {tokenValid === null ? "Проверка ссылки…" :
               tokenValid === false ? "Ссылка недействительна" :
               done ? "Готово!" : "Новый пароль"}
            </span>
          </div>
          <div className="card-body">

            {tokenValid === null && (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-secondary)" }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>⏳</div>
                Проверяем ссылку…
              </div>
            )}

            {tokenValid === false && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⛔</div>
                <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Ссылка недействительна</p>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                  Ссылка устарела или уже была использована.<br />
                  Запросите сброс пароля заново.
                </p>
                <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => router.replace("/login")}>
                  На страницу входа
                </button>
              </div>
            )}

            {tokenValid === true && !done && (
              <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                  Придумайте новый пароль для вашего аккаунта.
                </p>
                <div>
                  <div className="form-label">Новый пароль</div>
                  <input
                    className="form-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
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
                    placeholder="Повторите пароль"
                    required
                  />
                </div>
                {error && (
                  <div style={{ color: "var(--red-text)", background: "var(--red-bg)", padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
                    {error}
                  </div>
                )}
                <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", height: 44 }}>
                  {loading ? "Сохраняем…" : "Сохранить пароль"}
                </button>
              </form>
            )}

            {done && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Пароль изменён!</p>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
                  Теперь вы можете войти с новым паролем.
                </p>
                <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => router.replace("/login")}>
                  Войти в MyCRM
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="auth-shell">
        <div style={{ color: "var(--text-secondary)", textAlign: "center" }}>Загрузка…</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
