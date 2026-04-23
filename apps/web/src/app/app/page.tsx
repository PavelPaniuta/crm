"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  role: "ADMIN" | "MANAGER";
  activeOrganizationId: string;
};

type Client = {
  id: string;
  name: string;
  phone: string;
  note?: string | null;
};

type Expense = {
  id: string;
  title: string;
  amount: string | number;
  currency: string;
  payMethod: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
};

type AppUser = {
  id: string;
  email: string;
  role: "ADMIN" | "MANAGER";
};

type Tab = "dashboard" | "deals" | "clients" | "expenses" | "reports" | "settings";

type DealStatus = "NEW" | "IN_PROGRESS" | "CLOSED";

type Deal = {
  id: string;
  title: string;
  status: DealStatus;
  dealDate: string;
  clientId?: string | null;
  client?: { id: string; name: string; phone: string } | null;
  amounts: Array<{
    id: string;
    amount: string;
    currency: string;
    mediatorPct: number;
    rateToUsdt: string;
    payoutUsdt: string;
    branchPct: number;
    branchShareUsdt: string;
  }>;
  participants: Array<{
    id: string;
    pct: number;
    user: { id: string; email: string; role: "ADMIN" | "MANAGER" };
  }>;
};

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseCurrency, setNewExpenseCurrency] = useState("PLN");
  const [newExpensePayMethod, setNewExpensePayMethod] = useState("bank");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseEditing, setExpenseEditing] = useState<Expense | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUserLogin, setNewUserLogin] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"ADMIN" | "MANAGER">("MANAGER");

  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [dealEditingId, setDealEditingId] = useState<string | null>(null);
  const [dealFilter, setDealFilter] = useState<"ALL" | DealStatus>("ALL");

  const [dashFrom, setDashFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [dashTo, setDashTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [dashLoading, setDashLoading] = useState(false);
  const [dash, setDash] = useState<any>(null);

  const [repFrom, setRepFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [repTo, setRepTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [repLoading, setRepLoading] = useState(false);
  const [repWorkers, setRepWorkers] = useState<any>(null);

  const [dealDate, setDealDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dealStatus, setDealStatus] = useState<DealStatus>("NEW");
  const [dealClientSearch, setDealClientSearch] = useState("");
  const [dealClientId, setDealClientId] = useState<string | null>(null);
  const [dealClientSkip, setDealClientSkip] = useState(false);
  const [dealClients, setDealClients] = useState<Client[]>([]);
  const [dealWorkers, setDealWorkers] = useState<Array<{ id: string; email: string; role: "ADMIN" | "MANAGER" }>>([]);

  type DealAmtRow = {
    id: string;
    bank: string;
    mediatorPct: number;
    method: string;
    amount: string;
    currency: string;
    rate: string;
    payoutUsdt: string;
    payoutManual: boolean;
    branchPct: string;
  };
  const [dealAmounts, setDealAmounts] = useState<DealAmtRow[]>([]);

  type DealParticipantRow = { id: string; userId: string; pct: string };
  const [dealParticipants, setDealParticipants] = useState<DealParticipantRow[]>([]);
  const [dealComment, setDealComment] = useState("");

  const title = useMemo(() => {
    if (tab === "dashboard") return "Dashboard";
    if (tab === "deals") return "Сделки";
    if (tab === "clients") return "Клиенты";
    if (tab === "expenses") return "Расходы";
    if (tab === "reports") return "Отчёты";
    if (tab === "settings") return "Настройки";
    return "BisCRM";
  }, [tab]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const j = await res.json();
      setUser(j.user);
    })();
  }, [router]);

  async function loadClients() {
    setClientsLoading(true);
    try {
      const res = await fetch("/api/clients", { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const j = await res.json();
      setClients(j);
    } finally {
      setClientsLoading(false);
    }
  }

  async function loadExpenses() {
    setExpensesLoading(true);
    try {
      const res = await fetch("/api/expenses", { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const j = await res.json();
      setExpenses(j);
    } finally {
      setExpensesLoading(false);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 403) {
        setUsers([]);
        return;
      }
      const j = await res.json();
      setUsers(j);
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadDeals() {
    setDealsLoading(true);
    try {
      const res = await fetch("/api/deals", { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const j = await res.json();
      setDeals(j);
    } finally {
      setDealsLoading(false);
    }
  }

  async function loadDashboard() {
    setDashLoading(true);
    try {
      const res = await fetch(`/api/dashboard?from=${dashFrom}&to=${dashTo}`, { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const j = await res.json();
      setDash(j);
    } finally {
      setDashLoading(false);
    }
  }

  async function loadReportsWorkers() {
    setRepLoading(true);
    try {
      const res = await fetch(`/api/reports/workers?from=${repFrom}&to=${repTo}`, { credentials: "include" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const j = await res.json();
      setRepWorkers(j);
    } finally {
      setRepLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "clients") loadClients();
    if (tab === "expenses") loadExpenses();
    if (tab === "settings") loadUsers();
    if (tab === "deals") loadDeals();
    if (tab === "dashboard") loadDashboard();
    if (tab === "reports") loadReportsWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function createClient() {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: newClientName, phone: newClientPhone }),
    });
    if (!res.ok) throw new Error("Не удалось создать клиента");
    setNewClientName("");
    setNewClientPhone("");
    await loadClients();
  }

  async function createExpense() {
    const amount = Number(newExpenseAmount);
    if (!Number.isFinite(amount)) throw new Error("Некорректная сумма");
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: newExpenseTitle,
        amount,
        currency: newExpenseCurrency,
        payMethod: newExpensePayMethod,
      }),
    });
    if (!res.ok) throw new Error("Не удалось создать расход");
    setNewExpenseTitle("");
    setNewExpenseAmount("");
    await loadExpenses();
  }

  async function expenseAction(action: "submit" | "approve" | "reject") {
    if (!expenseEditing) return;
    const res = await fetch(`/api/expenses/${expenseEditing.id}/${action}`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Не удалось изменить статус");
    await loadExpenses();
    const updated = await fetch("/api/expenses", { credentials: "include" }).then((r) => r.json());
    const found = updated.find((e: Expense) => e.id === expenseEditing.id) ?? null;
    setExpenseEditing(found);
  }

  async function createUser() {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: newUserLogin,
        password: newUserPassword,
        role: newUserRole,
      }),
    });
    if (!res.ok) throw new Error("Не удалось создать пользователя");
    setNewUserLogin("");
    setNewUserPassword("");
    await loadUsers();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
  }

  function openDealModal() {
    setDealModalOpen(true);
    setDealEditingId(null);
    setDealDate(new Date().toISOString().slice(0, 10));
    setDealStatus("NEW");
    setDealClientSearch("");
    setDealClientId(null);
    setDealClientSkip(false);
    setDealComment("");

    setDealAmounts([
      {
        id: crypto.randomUUID(),
        bank: "PKO BP",
        mediatorPct: 3,
        method: "РЕКИ",
        amount: "",
        currency: "PLN",
        rate: "4.15",
        payoutUsdt: "0",
        payoutManual: false,
        branchPct: "25",
      },
    ]);
    setDealParticipants([
      { id: crypto.randomUUID(), userId: "", pct: "100" },
    ]);

    // preload clients + workers for dropdowns
    (async () => {
      const [cRes, wRes] = await Promise.all([
        fetch("/api/clients", { credentials: "include" }),
        fetch("/api/users/public", { credentials: "include" }),
      ]);
      if (cRes.ok) setDealClients(await cRes.json());
      if (wRes.ok) setDealWorkers(await wRes.json());
    })();
  }

  function openDealEditModal(deal: Deal) {
    setDealModalOpen(true);
    setDealEditingId(deal.id);
    setDealDate((deal.dealDate ?? new Date().toISOString()).slice(0, 10));
    setDealStatus(deal.status);
    setDealClientSearch("");
    setDealClientId(deal.clientId ?? null);
    setDealClientSkip(!deal.clientId);
    setDealComment("");

    setDealAmounts(
      (deal.amounts ?? []).map((a) => ({
        id: a.id,
        bank: "PKO BP",
        mediatorPct: a.mediatorPct,
        method: "РЕКИ",
        amount: String(a.amount ?? ""),
        currency: a.currency,
        rate: String(a.rateToUsdt ?? "1"),
        payoutUsdt: String(a.payoutUsdt ?? "0"),
        payoutManual: true,
        branchPct: String(a.branchPct ?? 0),
      })),
    );

    setDealParticipants(
      (deal.participants ?? []).map((p) => ({
        id: p.id,
        userId: p.user.id,
        pct: String(p.pct),
      })),
    );

    (async () => {
      const [cRes, wRes] = await Promise.all([
        fetch("/api/clients", { credentials: "include" }),
        fetch("/api/users/public", { credentials: "include" }),
      ]);
      if (cRes.ok) setDealClients(await cRes.json());
      if (wRes.ok) setDealWorkers(await wRes.json());
    })();
  }

  function closeDealModal() {
    setDealModalOpen(false);
  }

  function calcAmountRow(r: DealAmtRow) {
    const amt = Number(r.amount) || 0;
    const pct = Number(r.mediatorPct) || 0;
    const rate = Number(r.rate) || 1;
    const branchPct = Number(r.branchPct) || 0;
    const comm = Math.round((amt * pct) / 100);
    const afterComm = amt - comm;
    const payoutAuto = Math.round((afterComm / rate) * 100) / 100;
    const payout = r.payoutManual ? Number(r.payoutUsdt) || 0 : payoutAuto;
    const branchShare = Math.round(payout * branchPct) / 100;
    return { comm, afterComm, payout, branchShare, payoutAuto };
  }

  const dealTotals = useMemo(() => {
    let tAmt = 0;
    let tPay = 0;
    let tComm = 0;
    let tShare = 0;
    dealAmounts.forEach((r) => {
      const amt = Number(r.amount) || 0;
      tAmt += amt;
      const { comm, payout, branchShare } = calcAmountRow(r);
      tComm += comm;
      tPay += payout;
      tShare += branchShare;
    });
    return { tAmt, tPay, tComm, tShare };
  }, [dealAmounts]);

  const pctStatus = useMemo(() => {
    const totalPct = dealParticipants.reduce((s, p) => s + (Number(p.pct) || 0), 0);
    if (totalPct === 100) return { ok: true, text: "✓ Итого: 100%", color: "var(--green)" };
    if (totalPct > 100) return { ok: false, text: `⚠ Итого: ${totalPct}% — превышает 100%`, color: "var(--red)" };
    return { ok: false, text: `⚠ Итого: ${totalPct}% — не хватает ${100 - totalPct}%`, color: "var(--amber)" };
  }, [dealParticipants]);

  async function saveDeal() {
    // title like in MVP: client or "Без клиента"
    const selectedClient = dealClientId ? dealClients.find((c) => c.id === dealClientId) : null;
    const title = selectedClient ? `Сделка — ${selectedClient.name}` : "Сделка — без клиента";

    const targetId = dealEditingId;
    if (!targetId) {
      // create deal
      const dRes = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          status: dealStatus,
          clientId: dealClientSkip ? null : (dealClientId ?? null),
          dealDate,
        }),
      });
      if (!dRes.ok) throw new Error("Не удалось создать сделку");
      const deal = await dRes.json();
      await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: dealStatus }),
      });

      // amounts (initial create)
      for (const r of dealAmounts) {
        const { payout } = calcAmountRow(r);
        const aRes = await fetch(`/api/deals/${deal.id}/amounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amount: Number(r.amount) || 0,
            currency: r.currency,
            mediatorPct: Number(r.mediatorPct) || 0,
            rateToUsdt: Number(r.rate) || 1,
            branchPct: Number(r.branchPct) || 0,
            payoutUsdt: payout,
          }),
        });
        if (!aRes.ok) throw new Error("Не удалось сохранить суммы сделки");
      }

      // participants
      const parts = dealParticipants
        .filter((p) => p.userId)
        .map((p) => ({ userId: p.userId, pct: Number(p.pct) || 0 }));
      const totalPct = parts.reduce((s, p) => s + p.pct, 0);
      if (totalPct !== 100) throw new Error("Проценты участников должны суммарно быть 100%");
      const pRes = await fetch(`/api/deals/${deal.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ participants: parts }),
      });
      if (!pRes.ok) throw new Error("Не удалось сохранить участников сделки");
    } else {
      // update deal
      const upd = await fetch(`/api/deals/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          status: dealStatus,
          clientId: dealClientSkip ? null : (dealClientId ?? null),
          dealDate,
        }),
      });
      if (!upd.ok) throw new Error("Не удалось обновить сделку");

      // replace amounts
      const rep = await fetch(`/api/deals/${targetId}/amounts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amounts: dealAmounts.map((r) => {
            const { payout } = calcAmountRow(r);
            return {
              amount: Number(r.amount) || 0,
              currency: r.currency,
              mediatorPct: Number(r.mediatorPct) || 0,
              rateToUsdt: Number(r.rate) || 1,
              branchPct: Number(r.branchPct) || 0,
              payoutUsdt: payout,
            };
          }),
        }),
      });
      if (!rep.ok) throw new Error("Не удалось обновить суммы сделки");

      // participants
      const parts = dealParticipants
        .filter((p) => p.userId)
        .map((p) => ({ userId: p.userId, pct: Number(p.pct) || 0 }));
      const totalPct = parts.reduce((s, p) => s + p.pct, 0);
      if (totalPct !== 100) throw new Error("Проценты участников должны суммарно быть 100%");
      const pRes = await fetch(`/api/deals/${targetId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ participants: parts }),
      });
      if (!pRes.ok) throw new Error("Не удалось обновить участников сделки");
    }

    // participants (require 100%)
    const parts = dealParticipants
      .filter((p) => p.userId)
      .map((p) => ({ userId: p.userId, pct: Number(p.pct) || 0 }));
    const totalPct = parts.reduce((s, p) => s + p.pct, 0);
    if (totalPct !== 100) throw new Error("Проценты участников должны суммарно быть 100%");

    closeDealModal();
    await loadDeals();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">B</div>
          <span>BisCRM</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Основное</div>
          <a className={`nav-item ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>
            <span>Dashboard</span>
          </a>
          <a className={`nav-item ${tab === "deals" ? "active" : ""}`} onClick={() => setTab("deals")}>
            <span>Сделки</span>
          </a>
          <a className={`nav-item ${tab === "clients" ? "active" : ""}`} onClick={() => setTab("clients")}>
            <span>Клиенты</span>
          </a>
          <a className={`nav-item ${tab === "expenses" ? "active" : ""}`} onClick={() => setTab("expenses")}>
            <span>Расходы</span>
          </a>
          <a className={`nav-item ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}>
            <span>Отчёты</span>
          </a>
          <a className={`nav-item ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
            <span>Настройки</span>
          </a>
          <div className="nav-section">Аккаунт</div>
          <a className="nav-item" onClick={logout}>
            <span>Выйти</span>
          </a>
        </nav>
      </aside>

      <div className="main">
        <header className="header">
          <h1 className="header-title">{title}</h1>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            {user ? `${user.email} · ${user.role}` : "…"}
          </div>
        </header>

        <div className="content">
          {tab === "dashboard" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Период</span>
                  <button className="btn btn-secondary" onClick={loadDashboard}>
                    Обновить
                  </button>
                </div>
                <div className="card-body" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <div className="form-label">От</div>
                    <input className="form-input" type="date" value={dashFrom} onChange={(e) => setDashFrom(e.target.value)} />
                  </div>
                  <div>
                    <div className="form-label">До</div>
                    <input className="form-input" type="date" value={dashTo} onChange={(e) => setDashTo(e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {dashLoading || !dash ? (
                  <div className="card" style={{ gridColumn: "1 / -1" }}>
                    <div className="card-body" style={{ color: "var(--text-secondary)" }}>
                      Загрузка...
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Сделки</span>
                      </div>
                      <div className="card-body" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700 }}>
                        {dash.deals?.count ?? 0}
                      </div>
                    </div>
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Выплата</span>
                      </div>
                      <div className="card-body" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: "var(--green)" }}>
                        {(dash.deals?.totalPayoutUsdt ?? 0).toLocaleString()} USDT
                      </div>
                    </div>
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Воркерам</span>
                      </div>
                      <div className="card-body" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
                        {(dash.deals?.totalWorkersPayoutUsdt ?? 0).toLocaleString()} USDT
                      </div>
                    </div>
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Профит</span>
                      </div>
                      <div className="card-body" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700 }}>
                        {(dash.deals?.grossProfitUsdt ?? 0).toLocaleString()} USDT
                      </div>
                    </div>
                  </>
                )}
              </div>

              {!dashLoading && dash ? (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Расходы</span>
                  </div>
                  <div className="card-body" style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "var(--text-secondary)" }}>
                    <div><b>{dash.expenses?.count ?? 0}</b> записей</div>
                    <div><b>{(dash.expenses?.totalAmount ?? 0).toLocaleString()}</b> сумма (в валюте записей)</div>
                    <div>DRAFT: <b>{dash.expenses?.byStatus?.DRAFT ?? 0}</b></div>
                    <div>SUBMITTED: <b>{dash.expenses?.byStatus?.SUBMITTED ?? 0}</b></div>
                    <div>APPROVED: <b>{dash.expenses?.byStatus?.APPROVED ?? 0}</b></div>
                    <div>REJECTED: <b>{dash.expenses?.byStatus?.REJECTED ?? 0}</b></div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "reports" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Период</span>
                  <button className="btn btn-secondary" onClick={loadReportsWorkers}>
                    Обновить
                  </button>
                </div>
                <div className="card-body" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <div className="form-label">От</div>
                    <input className="form-input" type="date" value={repFrom} onChange={(e) => setRepFrom(e.target.value)} />
                  </div>
                  <div>
                    <div className="form-label">До</div>
                    <input className="form-input" type="date" value={repTo} onChange={(e) => setRepTo(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Выплаты воркерам (USDT)</span>
                </div>
                <div className="card-body">
                  {repLoading || !repWorkers ? (
                    <div style={{ color: "var(--text-secondary)" }}>Загрузка...</div>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Воркер</th>
                          <th>Роль</th>
                          <th>Сделок</th>
                          <th style={{ textAlign: "right" }}>Выплата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(repWorkers.rows ?? []).map((r: any) => (
                          <tr key={r.userId}>
                            <td>{r.email}</td>
                            <td>{r.role}</td>
                            <td>{r.dealsCount}</td>
                            <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                              {Number(r.payoutUsdt ?? 0).toLocaleString()} USDT
                            </td>
                          </tr>
                        ))}
                        {(repWorkers.rows ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ color: "var(--text-secondary)" }}>
                              Нет данных за период
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "deals" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { id: "ALL", label: "Все" },
                    { id: "NEW", label: "Новые" },
                    { id: "IN_PROGRESS", label: "В работе" },
                    { id: "CLOSED", label: "Закрытые" },
                  ].map((f) => (
                    <span
                      key={f.id}
                      className={`filter-pill ${dealFilter === (f.id as any) ? "active" : ""}`}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        background: dealFilter === (f.id as any) ? "var(--accent-light)" : "transparent",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        color: dealFilter === (f.id as any) ? "var(--accent)" : "var(--text-secondary)",
                      }}
                      onClick={() => setDealFilter(f.id as any)}
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Сделки</span>
                  <button className="btn btn-primary" onClick={openDealModal}>
                    + Новая сделка
                  </button>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Клиент</th>
                        <th>Статус</th>
                        <th style={{ textAlign: "right" }}>Выплата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dealsLoading ? (
                        <tr>
                          <td colSpan={4} style={{ padding: 16, color: "var(--text-secondary)" }}>
                            Загрузка...
                          </td>
                        </tr>
                      ) : deals.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: 16, color: "var(--text-secondary)" }}>
                            Пока пусто
                          </td>
                        </tr>
                      ) : (
                        deals
                          .filter((d) => (dealFilter === "ALL" ? true : d.status === dealFilter))
                          .map((d) => {
                          const payout = d.amounts.reduce((s, a) => s + Number(a.payoutUsdt || 0), 0);
                          return (
                            <tr key={d.id} onClick={() => openDealEditModal(d)}>
                              <td style={{ color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                                {d.id.slice(0, 8)}
                              </td>
                              <td>{d.client ? d.client.name : <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Без клиента</span>}</td>
                              <td>
                                <span className={`badge ${d.status === "CLOSED" ? "badge-green" : d.status === "IN_PROGRESS" ? "badge-amber" : "badge-blue"}`}>
                                  {d.status}
                                </span>
                              </td>
                              <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                                {payout.toLocaleString()} USDT
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {dealModalOpen ? (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    zIndex: 50,
                  }}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) closeDealModal();
                  }}
                >
                  <div className="card" style={{ width: 780, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }}>
                    <div className="card-header">
                      <span className="card-title">Новая сделка</span>
                      <button className="btn btn-secondary" onClick={closeDealModal}>
                        Отмена
                      </button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 18 }}>
                      {/* DATE + CLIENT */}
                      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 14 }}>
                        <div>
                          <div className="form-label">Дата сделки *</div>
                          <input className="form-input" type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">Клиент</div>
                          {!dealClientSkip && !dealClientId ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <input
                                  className="form-input"
                                  placeholder="Поиск по имени или телефону..."
                                  value={dealClientSearch}
                                  onChange={(e) => setDealClientSearch(e.target.value)}
                                />
                                <button className="btn btn-secondary" onClick={() => setDealClientSkip(true)}>
                                  Без клиента
                                </button>
                              </div>
                              <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)", maxHeight: 140, overflow: "auto" }}>
                                {dealClients
                                  .filter((c) => (c.name + " " + c.phone).toLowerCase().includes(dealClientSearch.toLowerCase()))
                                  .slice(0, 20)
                                  .map((c) => (
                                    <div
                                      key={c.id}
                                      style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", display: "flex", gap: 10 }}
                                      onClick={() => setDealClientId(c.id)}
                                    >
                                      <span style={{ flex: 1 }}>{c.name}</span>
                                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{c.phone}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ) : dealClientId ? (
                            <div style={{ background: "var(--green-bg)", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                              <span style={{ flex: 1, fontWeight: 600, color: "var(--green-text)" }}>
                                {dealClients.find((c) => c.id === dealClientId)?.name ?? "Клиент"}
                              </span>
                              <button className="btn btn-secondary" onClick={() => setDealClientId(null)}>
                                x
                              </button>
                            </div>
                          ) : (
                            <div style={{ background: "var(--bg-metric)", borderRadius: 10, padding: "8px 12px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                              Без клиента — привяжу позже{" "}
                              <span style={{ color: "var(--accent)", cursor: "pointer", fontStyle: "normal", marginLeft: 8 }} onClick={() => setDealClientSkip(false)}>
                                Изменить
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* STATUS */}
                      <div style={{ width: 240 }}>
                        <div className="form-label">Статус</div>
                        <select className="form-input" value={dealStatus} onChange={(e) => setDealStatus(e.target.value as any)}>
                          <option value="NEW">Новая</option>
                          <option value="IN_PROGRESS">В работе</option>
                          <option value="CLOSED">Закрыта</option>
                        </select>
                      </div>

                      {/* AMOUNTS */}
                      <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div className="form-label" style={{ margin: 0 }}>
                            Суммы сделки *
                          </div>
                          <button
                            className="btn btn-secondary"
                            onClick={() =>
                              setDealAmounts((prev) => [
                                ...prev,
                                {
                                  id: crypto.randomUUID(),
                                  bank: "PKO BP",
                                  mediatorPct: 3,
                                  method: "РЕКИ",
                                  amount: "",
                                  currency: "PLN",
                                  rate: "4.15",
                                  payoutUsdt: "0",
                                  payoutManual: false,
                                  branchPct: "25",
                                },
                              ])
                            }
                          >
                            + Добавить сумму
                          </button>
                        </div>

                        <div style={{ display: "grid", gap: 8 }}>
                          {dealAmounts.map((r) => {
                            const { comm, afterComm, payout, branchShare, payoutAuto } = calcAmountRow(r);
                            return (
                              <div key={r.id} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: 14 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px 100px", gap: 8, marginBottom: 8 }}>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>
                                      Банк клиента
                                    </div>
                                    <select
                                      className="form-input"
                                      value={r.bank}
                                      onChange={(e) => setDealAmounts((p) => p.map((x) => (x.id === r.id ? { ...x, bank: e.target.value } : x)))}
                                    >
                                      <option>PKO BP</option>
                                      <option>mBank</option>
                                      <option>ING</option>
                                      <option>Santander</option>
                                      <option>Pekao</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>
                                      Посредник
                                    </div>
                                    <select
                                      className="form-input"
                                      value={String(r.mediatorPct)}
                                      onChange={(e) =>
                                        setDealAmounts((p) =>
                                          p.map((x) =>
                                            x.id === r.id ? { ...x, mediatorPct: Number(e.target.value), payoutManual: false } : x,
                                          ),
                                        )
                                      }
                                    >
                                      <option value="3">Посредник А (3%)</option>
                                      <option value="5">Посредник Б (5%)</option>
                                      <option value="2">Посредник В (2%)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3, color: "var(--red)" }}>
                                      Ком.%
                                    </div>
                                    <input
                                      className="form-input"
                                      value={String(r.mediatorPct)}
                                      onChange={(e) =>
                                        setDealAmounts((p) =>
                                          p.map((x) => (x.id === r.id ? { ...x, mediatorPct: Number(e.target.value) || 0, payoutManual: false } : x)),
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>
                                      Способ
                                    </div>
                                    <select
                                      className="form-input"
                                      value={r.method}
                                      onChange={(e) => setDealAmounts((p) => p.map((x) => (x.id === r.id ? { ...x, method: e.target.value } : x)))}
                                    >
                                      <option>РЕКИ</option>
                                      <option>КЕШ</option>
                                      <option>КАРТА</option>
                                      <option>БЛИК</option>
                                      <option>ПОКУПКА</option>
                                    </select>
                                  </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 1fr 70px 60px 28px", gap: 8, alignItems: "end" }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Сумма</div>
                                    <input
                                      className="form-input"
                                      value={r.amount}
                                      onChange={(e) => setDealAmounts((p) => p.map((x) => (x.id === r.id ? { ...x, amount: e.target.value, payoutManual: false } : x)))}
                                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                    />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Валюта</div>
                                    <select
                                      className="form-input"
                                      value={r.currency}
                                      onChange={(e) => setDealAmounts((p) => p.map((x) => (x.id === r.id ? { ...x, currency: e.target.value, payoutManual: false } : x)))}
                                    >
                                      <option>PLN</option>
                                      <option>CHF</option>
                                      <option>USDT</option>
                                      <option>UAH</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Курс</div>
                                    <input
                                      className="form-input"
                                      value={r.rate}
                                      onChange={(e) => setDealAmounts((p) => p.map((x) => (x.id === r.id ? { ...x, rate: e.target.value, payoutManual: false } : x)))}
                                      style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}
                                    />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase" }}>Выплата (USDT)</div>
                                    <input
                                      className="form-input"
                                      value={r.payoutManual ? r.payoutUsdt : String(payoutAuto)}
                                      onChange={(e) =>
                                        setDealAmounts((p) =>
                                          p.map((x) => (x.id === r.id ? { ...x, payoutUsdt: e.target.value, payoutManual: true } : x)),
                                        )
                                      }
                                      style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--green)" }}
                                    />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>Филиал%</div>
                                    <input
                                      className="form-input"
                                      value={r.branchPct}
                                      onChange={(e) => setDealAmounts((p) => p.map((x) => (x.id === r.id ? { ...x, branchPct: e.target.value } : x)))}
                                      style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: "center", color: "var(--accent)" }}
                                    />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>Доля</div>
                                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--accent)", padding: "10px 0", textAlign: "center" }}>
                                      {branchShare.toLocaleString()}
                                    </div>
                                  </div>
                                  <div
                                    style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)" }}
                                    onClick={() => setDealAmounts((p) => p.filter((x) => x.id !== r.id))}
                                  >
                                    ×
                                  </div>
                                </div>

                                <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
                                  {`${(Number(r.amount) || 0).toLocaleString()} ${r.currency} − ${r.mediatorPct}% (${comm.toLocaleString()}) = ${afterComm.toLocaleString()} / ${r.rate} = `}
                                  <span style={{ color: "var(--green)", fontWeight: 600 }}>
                                    {payout.toLocaleString()} USDT
                                  </span>
                                  {r.payoutManual ? <span style={{ color: "var(--amber)" }}> (ручная правка)</span> : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, paddingTop: 12, marginTop: 12, borderTop: "2px solid var(--border)" }}>
                          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "8px 10px" }}>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Итого сумма</div>
                            <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>{dealTotals.tAmt.toLocaleString()} PLN</div>
                          </div>
                          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "8px 10px" }}>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Итого выплата</div>
                            <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "var(--green)" }}>{dealTotals.tPay.toLocaleString()} USDT</div>
                          </div>
                          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "8px 10px" }}>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Комиссия поср.</div>
                            <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "var(--red)" }}>{dealTotals.tComm.toLocaleString()} PLN</div>
                          </div>
                          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "8px 10px" }}>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Доля филиала</div>
                            <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "var(--accent)" }}>{dealTotals.tShare.toLocaleString()} USDT</div>
                          </div>
                        </div>
                      </div>

                      {/* PARTICIPANTS */}
                      <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div>
                            <div className="form-label" style={{ margin: 0 }}>
                              Участники (воркеры)
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Распределение % от выплаты</div>
                          </div>
                          <button
                            className="btn btn-secondary"
                            onClick={() => setDealParticipants((p) => [...p, { id: crypto.randomUUID(), userId: "", pct: "0" }])}
                          >
                            + Добавить
                          </button>
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                          {dealParticipants.map((p) => {
                            const pct = Number(p.pct) || 0;
                            const payout = Math.round((dealTotals.tPay * pct) / 100);
                            return (
                              <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", background: "var(--bg-metric)", borderRadius: 10 }}>
                                <select
                                  className="form-input"
                                  value={p.userId}
                                  onChange={(e) => setDealParticipants((pp) => pp.map((x) => (x.id === p.id ? { ...x, userId: e.target.value } : x)))}
                                  style={{ flex: 1 }}
                                >
                                  <option value="">— выбрать —</option>
                                  {dealWorkers.map((w) => (
                                    <option key={w.id} value={w.id}>
                                      {w.email} — {w.role}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="form-input"
                                  value={p.pct}
                                  onChange={(e) => setDealParticipants((pp) => pp.map((x) => (x.id === p.id ? { ...x, pct: e.target.value } : x)))}
                                  style={{ width: 80, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}
                                />
                                <span style={{ color: "var(--text-secondary)" }}>%</span>
                                <span style={{ minWidth: 120, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                                  {dealTotals.tPay > 0 ? `${payout.toLocaleString()} USDT` : "—"}
                                </span>
                                <span style={{ cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16, padding: "4px 8px" }} onClick={() => setDealParticipants((pp) => pp.filter((x) => x.id !== p.id))}>
                                  ×
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: pctStatus.color }}>{pctStatus.text}</div>
                      </div>

                      {/* COMMENT */}
                      <div>
                        <div className="form-label">Комментарий</div>
                        <textarea className="form-input" value={dealComment} onChange={(e) => setDealComment(e.target.value)} style={{ height: 80, paddingTop: 10 }} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <button className="btn btn-secondary" onClick={closeDealModal}>
                          Отмена
                        </button>
                        <button className="btn btn-primary" onClick={saveDeal} disabled={!pctStatus.ok || dealTotals.tPay <= 0}>
                          {dealEditingId ? "Сохранить изменения" : "Создать сделку"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "clients" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Новый клиент</span>
                  <button className="btn btn-primary" onClick={createClient} disabled={!newClientName || !newClientPhone}>
                    + Создать
                  </button>
                </div>
                <div className="card-body" style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div className="form-label">Имя</div>
                    <input className="form-input" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
                  </div>
                  <div>
                    <div className="form-label">Телефон</div>
                    <input className="form-input" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Клиенты</span>
                  <button className="btn btn-secondary" onClick={loadClients}>
                    Обновить
                  </button>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Имя</th>
                        <th>Телефон</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientsLoading ? (
                        <tr>
                          <td colSpan={2} style={{ padding: 16, color: "var(--text-secondary)" }}>
                            Загрузка...
                          </td>
                        </tr>
                      ) : clients.length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ padding: 16, color: "var(--text-secondary)" }}>
                            Пока пусто
                          </td>
                        </tr>
                      ) : (
                        clients.map((c) => (
                          <tr key={c.id}>
                            <td>{c.name}</td>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-secondary)" }}>{c.phone}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "expenses" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Новый расход</span>
                  <button
                    className="btn btn-primary"
                    onClick={createExpense}
                    disabled={!newExpenseTitle || !newExpenseAmount}
                  >
                    + Создать
                  </button>
                </div>
                <div className="card-body" style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div className="form-label">Название</div>
                    <input className="form-input" value={newExpenseTitle} onChange={(e) => setNewExpenseTitle(e.target.value)} />
                  </div>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 120px 140px" }}>
                    <div>
                      <div className="form-label">Сумма</div>
                      <input className="form-input" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} />
                    </div>
                    <div>
                      <div className="form-label">Валюта</div>
                      <select
                        className="form-input"
                        value={newExpenseCurrency}
                        onChange={(e) => setNewExpenseCurrency(e.target.value)}
                      >
                        <option value="PLN">PLN</option>
                        <option value="CHF">CHF</option>
                        <option value="USDT">USDT</option>
                        <option value="UAH">UAH</option>
                      </select>
                    </div>
                    <div>
                      <div className="form-label">Оплата</div>
                      <select
                        className="form-input"
                        value={newExpensePayMethod}
                        onChange={(e) => setNewExpensePayMethod(e.target.value)}
                      >
                        <option value="bank">Банк</option>
                        <option value="usdt">USDT</option>
                        <option value="cash">Кэш</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Расходы</span>
                  <button className="btn btn-secondary" onClick={loadExpenses}>
                    Обновить
                  </button>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Статус</th>
                        <th style={{ textAlign: "right" }}>Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensesLoading ? (
                        <tr>
                          <td colSpan={3} style={{ padding: 16, color: "var(--text-secondary)" }}>
                            Загрузка...
                          </td>
                        </tr>
                      ) : expenses.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: 16, color: "var(--text-secondary)" }}>
                            Пока пусто
                          </td>
                        </tr>
                      ) : (
                        expenses.map((e) => (
                          <tr
                            key={e.id}
                            onClick={() => {
                              setExpenseEditing(e);
                              setExpenseModalOpen(true);
                            }}
                          >
                            <td>{e.title}</td>
                            <td>
                              <span className={`badge ${e.status === "APPROVED" ? "badge-green" : e.status === "SUBMITTED" ? "badge-blue" : "badge-amber"}`}>
                                {e.status}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                              {e.amount} {e.currency}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {expenseModalOpen && expenseEditing ? (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    zIndex: 50,
                  }}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) setExpenseModalOpen(false);
                  }}
                >
                  <div className="card" style={{ width: 720, maxWidth: "100%" }}>
                    <div className="card-header">
                      <span className="card-title">Расход</span>
                      <button className="btn btn-secondary" onClick={() => setExpenseModalOpen(false)}>
                        Закрыть
                      </button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 12 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div className="form-label">Название</div>
                        <div style={{ fontWeight: 600 }}>{expenseEditing.title}</div>
                      </div>
                      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr 1fr" }}>
                        <div>
                          <div className="form-label">Сумма</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                            {expenseEditing.amount} {expenseEditing.currency}
                          </div>
                        </div>
                        <div>
                          <div className="form-label">Оплата</div>
                          <div style={{ color: "var(--text-secondary)" }}>{expenseEditing.payMethod}</div>
                        </div>
                        <div>
                          <div className="form-label">Статус</div>
                          <span className={`badge ${expenseEditing.status === "APPROVED" ? "badge-green" : expenseEditing.status === "SUBMITTED" ? "badge-blue" : "badge-amber"}`}>
                            {expenseEditing.status}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                        {expenseEditing.status === "DRAFT" ? (
                          <button className="btn btn-primary" onClick={() => expenseAction("submit")}>
                            Отправить на одобрение
                          </button>
                        ) : null}

                        {user?.role === "ADMIN" && expenseEditing.status === "SUBMITTED" ? (
                          <>
                            <button className="btn btn-secondary" onClick={() => expenseAction("reject")}>
                              Отклонить
                            </button>
                            <button className="btn btn-primary" onClick={() => expenseAction("approve")}>
                              Одобрить
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "settings" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Пользователи</span>
                  <button className="btn btn-secondary" onClick={loadUsers}>
                    Обновить
                  </button>
                </div>
                <div className="card-body" style={{ color: "var(--text-secondary)", display: "grid", gap: 12 }}>
                  {user?.role !== "ADMIN" ? (
                    <div>Доступно только для admin.</div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 180px 140px" }}>
                        <div>
                          <div className="form-label">Логин</div>
                          <input className="form-input" value={newUserLogin} onChange={(e) => setNewUserLogin(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">Пароль</div>
                          <input className="form-input" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">Роль</div>
                          <select className="form-input" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)}>
                            <option value="MANAGER">MANAGER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", alignItems: "end" }}>
                          <button className="btn btn-primary" onClick={createUser} disabled={!newUserLogin || !newUserPassword}>
                            + Создать
                          </button>
                        </div>
                      </div>

                      <div className="card" style={{ border: "1px solid var(--border-light)" }}>
                        <div className="card-body" style={{ padding: 0 }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Логин</th>
                                <th>Роль</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usersLoading ? (
                                <tr>
                                  <td colSpan={2} style={{ padding: 16 }}>
                                    Загрузка...
                                  </td>
                                </tr>
                              ) : users.length === 0 ? (
                                <tr>
                                  <td colSpan={2} style={{ padding: 16 }}>
                                    Пока пусто
                                  </td>
                                </tr>
                              ) : (
                                users.map((u) => (
                                  <tr key={u.id}>
                                    <td>{u.email}</td>
                                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-secondary)" }}>{u.role}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

