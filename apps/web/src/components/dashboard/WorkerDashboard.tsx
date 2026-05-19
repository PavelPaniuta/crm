"use client";

export function WorkerDashboard() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Мой кабинет</span>
        </div>
        <div className="card-body" style={{ padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Раздел в разработке</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Здесь будут отображаться ваши задачи, учёт рабочего времени и расчёт зарплаты.
          </div>
        </div>
      </div>
      <div className="g3">
        {[
          { icon: "📋", title: "Мои задачи", desc: "Список задач и их статус" },
          { icon: "💰", title: "Моя зарплата", desc: "История выплат и начислений" },
          { icon: "📊", title: "Моя статистика", desc: "Сделки в которых участвовал" },
        ].map((card) => (
          <div key={card.title} className="card" style={{ opacity: 0.5 }}>
            <div className="card-body" style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{card.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{card.desc}</div>
              <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>Скоро</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
