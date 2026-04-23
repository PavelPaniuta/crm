export default function Home() {
  // Keep root minimal; app is under /app.
  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="card-header">
          <span className="card-title">BisCRM</span>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          <div style={{ color: "var(--text-secondary)" }}>
            Откройте приложение по адресу <b>/app</b> или войдите.
          </div>
          <a className="btn btn-primary" href="/login">
            Перейти к входу
          </a>
        </div>
      </div>
    </div>
  );
}
