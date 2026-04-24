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
  position?: string | null;
  organizationId: string;
};

type Org = {
  id: string;
  name: string;
  _count: { users: number; deals: number };
};

type DealWorker = {
  id: string;
  email: string;
  role: string;
  position?: string | null;
  organizationId: string;
  organization?: { name: string };
};

type Tab = "dashboard" | "deals" | "clients" | "expenses" | "reports" | "settings";
type DealStatus = "NEW" | "IN_PROGRESS" | "CLOSED";
type OperationType = "PURCHASE" | "ATM" | "TRANSFER";

type Deal = {
  id: string;
  title: string;
  status: DealStatus;
  dealDate: string;
  comment?: string | null;
  clientId?: string | null;
  client?: { id: string; name: string; phone: string } | null;
  amounts: Array<{
    id: string;
    amountIn: string;
    currencyIn: string;
    amountOut: string;
    currencyOut: string;
    bank: string;
    operationType: OperationType;
    shopName?: string | null;
  }>;
  participants: Array<{
    id: string;
    pct: number;
    user: { id: string; email: string; role: "ADMIN" | "MANAGER" };
  }>;
};

type DealAmtRow = {
  id: string;
  bank: string;
  operationType: OperationType;
  amountIn: string;
  currencyIn: string;
  amountOut: string;
  currencyOut: string;
  shopName: string;
};

type DealParticipantRow = { id: string; userId: string; pct: string };

const OP_LABELS: Record<OperationType, string> = {
  PURCHASE: "Покупка",
  ATM: "Банкомат",
  TRANSFER: "Перевод",
};

const CURRENCIES = ["PLN", "CHF", "USDT", "UAH", "EUR", "USD"];

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  // --- Clients ---
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [clientEditing, setClientEditing] = useState<Client | null>(null);
  const [clientEditName, setClientEditName] = useState("");
  const [clientEditPhone, setClientEditPhone] = useState("");

  // --- Expenses ---
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseCurrency, setNewExpenseCurrency] = useState("PLN");
  const [newExpensePayMethod, setNewExpensePayMethod] = useState("bank");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseEditing, setExpenseEditing] = useState<Expense | null>(null);

  // --- Users ---
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUserLogin, setNewUserLogin] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"ADMIN" | "MANAGER">("MANAGER");
  const [newUserPosition, setNewUserPosition] = useState("");
  const [newUserTargetOrgId, setNewUserTargetOrgId] = useState("");
  const [userPwdId, setUserPwdId] = useState<string | null>(null);
  const [userPwdValue, setUserPwdValue] = useState("");
  const [userPositionId, setUserPositionId] = useState<string | null>(null);
  const [userPositionValue, setUserPositionValue] = useState("");

  // --- Mobile sidebar ---
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Orgs ---
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [orgSwitchOpen, setOrgSwitchOpen] = useState(false);
  const [globalDash, setGlobalDash] = useState<any>(null);
  const [globalDashLoading, setGlobalDashLoading] = useState(false);
  const [dashView, setDashView] = useState<"current" | "global">("current");

  // --- Deals ---
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [dealEditingId, setDealEditingId] = useState<string | null>(null);
  const [dealFilter, setDealFilter] = useState<"ALL" | DealStatus>("ALL");
  const [dealDate, setDealDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dealStatus, setDealStatus] = useState<DealStatus>("NEW");
  const [dealClientSearch, setDealClientSearch] = useState("");
  const [dealClientId, setDealClientId] = useState<string | null>(null);
  const [dealClientSkip, setDealClientSkip] = useState(false);
  const [dealClients, setDealClients] = useState<Client[]>([]);
  const [dealWorkers, setDealWorkers] = useState<DealWorker[]>([]);
  const [dealAmounts, setDealAmounts] = useState<DealAmtRow[]>([]);
  const [dealParticipants, setDealParticipants] = useState<DealParticipantRow[]>([]);
  const [dealComment, setDealComment] = useState("");

  // --- Dashboard ---
  const [dashFrom, setDashFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [dashTo, setDashTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [dashLoading, setDashLoading] = useState(false);
  const [dash, setDash] = useState<any>(null);

  // --- Reports ---
  const [repFrom, setRepFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [repTo, setRepTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [repLoading, setRepLoading] = useState(false);
  const [repWorkers, setRepWorkers] = useState<any>(null);

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
      if (!res.ok) { router.replace("/login"); return; }
      const j = await res.json();
      setUser(j.user);
      // Load orgs for all users (ADMIN sees all, MANAGER sees own)
      const orgRes = await fetch("/api/orgs", { credentials: "include" });
      if (orgRes.ok) setOrgs(await orgRes.json());
    })();
  }, [router]);

  useEffect(() => {
    if (tab === "clients") loadClients();
    if (tab === "expenses") loadExpenses();
    if (tab === "settings") { loadUsers(); loadOrgs(); }
    if (tab === "deals") loadDeals();
    if (tab === "dashboard") { loadDashboard(); loadDeals(); loadExpenses(); }
    if (tab === "reports") loadReportsWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ---- loaders ----
  async function loadClients() {
    setClientsLoading(true);
    try {
      const res = await fetch("/api/clients", { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) return;
      const j = await res.json();
      setClients(Array.isArray(j) ? j : []);
    } finally { setClientsLoading(false); }
  }

  async function loadExpenses() {
    setExpensesLoading(true);
    try {
      const res = await fetch("/api/expenses", { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) return;
      const j = await res.json();
      setExpenses(Array.isArray(j) ? j : []);
    } finally { setExpensesLoading(false); }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      // For ADMIN: fetch all users across orgs via /public; for MANAGER: own org only
      const url = user?.role === "ADMIN" ? "/api/users/public" : "/api/users";
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) { setUsers([]); return; }
      const j = await res.json();
      setUsers(Array.isArray(j) ? j : []);
    } finally { setUsersLoading(false); }
  }

  async function loadDeals() {
    setDealsLoading(true);
    try {
      const res = await fetch("/api/deals", { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) return;
      const j = await res.json();
      setDeals(Array.isArray(j) ? j : []);
    } finally { setDealsLoading(false); }
  }

  async function loadDashboard() {
    setDashLoading(true);
    try {
      const res = await fetch(`/api/dashboard?from=${dashFrom}&to=${dashTo}`, { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) return;
      setDash(await res.json());
    } finally { setDashLoading(false); }
  }

  async function loadReportsWorkers() {
    setRepLoading(true);
    try {
      const res = await fetch(`/api/reports/workers?from=${repFrom}&to=${repTo}`, { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) return;
      setRepWorkers(await res.json());
    } finally { setRepLoading(false); }
  }

  // ---- orgs ----
  async function loadOrgs() {
    const res = await fetch("/api/orgs", { credentials: "include" });
    if (res.ok) setOrgs(await res.json());
  }

  async function createOrg() {
    if (!newOrgName.trim()) return;
    const res = await fetch("/api/orgs", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newOrgName.trim() }),
    });
    if (!res.ok) return alert("Не удалось создать офис");
    setNewOrgName("");
    await loadOrgs();
  }

  async function switchOrg(orgId: string) {
    const res = await fetch("/api/orgs/switch", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId }),
    });
    if (!res.ok) return alert("Не удалось переключиться");
    setOrgSwitchOpen(false);
    // Reload user to get new activeOrganizationId, then reload current tab
    const meRes = await fetch("/api/auth/me", { credentials: "include" });
    if (meRes.ok) { const j = await meRes.json(); setUser(j.user); }
    loadDeals(); loadClients(); loadExpenses(); loadDashboard();
  }

  async function deleteOrg(orgId: string, orgName: string) {
    if (!confirm(`Удалить офис "${orgName}"?\n\nВНИМАНИЕ: удалятся все сделки, клиенты, расходы и пользователи этого офиса!`)) return;
    const res = await fetch(`/api/orgs/${orgId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.message ?? "Не удалось удалить офис");
      return;
    }
    await loadOrgs();
  }

  async function loadGlobalDash() {
    setGlobalDashLoading(true);
    try {
      const res = await fetch(`/api/dashboard/global?from=${dashFrom}&to=${dashTo}`, { credentials: "include" });
      if (res.ok) setGlobalDash(await res.json());
    } finally { setGlobalDashLoading(false); }
  }

  // ---- clients ----
  async function createClient() {
    const res = await fetch("/api/clients", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClientName, phone: newClientPhone }),
    });
    if (!res.ok) return alert("Не удалось создать клиента");
    setNewClientName(""); setNewClientPhone("");
    await loadClients();
  }

  function openClientEdit(c: Client) {
    setClientEditing(c);
    setClientEditName(c.name);
    setClientEditPhone(c.phone);
    setClientEditOpen(true);
  }

  async function saveClientEdit() {
    if (!clientEditing) return;
    const res = await fetch(`/api/clients/${clientEditing.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: clientEditName, phone: clientEditPhone }),
    });
    if (!res.ok) return alert("Не удалось обновить клиента");
    setClientEditOpen(false);
    await loadClients();
  }

  async function deleteClient(id: string) {
    if (!confirm("Удалить клиента?")) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return alert("Не удалось удалить клиента");
    await loadClients();
  }

  // ---- expenses ----
  async function createExpense() {
    const amount = Number(newExpenseAmount);
    if (!Number.isFinite(amount)) return alert("Некорректная сумма");
    const res = await fetch("/api/expenses", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newExpenseTitle, amount, currency: newExpenseCurrency, payMethod: newExpensePayMethod }),
    });
    if (!res.ok) return alert("Не удалось создать расход");
    setNewExpenseTitle(""); setNewExpenseAmount("");
    await loadExpenses();
  }

  async function expenseAction(action: "submit" | "approve" | "reject") {
    if (!expenseEditing) return;
    const res = await fetch(`/api/expenses/${expenseEditing.id}/${action}`, { method: "POST", credentials: "include" });
    if (!res.ok) return alert("Не удалось изменить статус");
    const list = await fetch("/api/expenses", { credentials: "include" }).then((r) => r.json());
    setExpenses(list);
    setExpenseEditing(list.find((e: Expense) => e.id === expenseEditing.id) ?? null);
  }

  // ---- users ----
  async function createUser() {
    const res = await fetch("/api/users", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newUserLogin, password: newUserPassword, role: newUserRole,
        position: newUserPosition || null,
        targetOrgId: newUserTargetOrgId || null,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const msg = errBody?.message ?? `HTTP ${res.status}`;
      return alert(`Не удалось создать пользователя:\n${Array.isArray(msg) ? msg.join("\n") : msg}`);
    }
    setNewUserLogin(""); setNewUserPassword(""); setNewUserPosition(""); setNewUserTargetOrgId("");
    await loadUsers();
    await loadOrgs();
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Удалить пользователя "${email}"?`)) return;
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return alert(j?.message ?? "Не удалось удалить пользователя");
    }
    await loadUsers();
    await loadOrgs();
  }

  async function setUserPosition(userId: string) {
    const res = await fetch("/api/users/position", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, position: userPositionValue || null }),
    });
    if (!res.ok) return alert("Не удалось обновить должность");
    setUserPositionId(null); setUserPositionValue("");
    await loadUsers();
  }

  async function changeUserRole(userId: string, role: "ADMIN" | "MANAGER") {
    const res = await fetch("/api/users/role", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) return alert("Не удалось сменить роль");
    await loadUsers();
  }

  async function resetUserPassword(userId: string) {
    if (!userPwdValue.trim()) return alert("Введите пароль");
    const res = await fetch("/api/users/password", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password: userPwdValue }),
    });
    if (!res.ok) return alert("Не удалось сбросить пароль");
    setUserPwdId(null); setUserPwdValue("");
    alert("Пароль обновлён");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
  }

  // ---- deal modal helpers ----
  function newAmtRow(): DealAmtRow {
    return {
      id: crypto.randomUUID(),
      bank: "ING",
      operationType: "ATM",
      amountIn: "",
      currencyIn: "PLN",
      amountOut: "",
      currencyOut: "PLN",
      shopName: "",
    };
  }

  function openDealModal() {
    setDealModalOpen(true); setDealEditingId(null);
    setDealDate(new Date().toISOString().slice(0, 10));
    setDealStatus("NEW"); setDealClientSearch(""); setDealClientId(null);
    setDealClientSkip(false); setDealComment("");
    setDealAmounts([newAmtRow()]);
    setDealParticipants([{ id: crypto.randomUUID(), userId: "", pct: "100" }]);
    fetchDealDropdowns();
  }

  function openDealEditModal(deal: Deal) {
    setDealModalOpen(true); setDealEditingId(deal.id);
    setDealDate((deal.dealDate ?? new Date().toISOString()).slice(0, 10));
    setDealStatus(deal.status); setDealClientSearch("");
    setDealClientId(deal.clientId ?? null);
    setDealClientSkip(!deal.clientId);
    setDealComment(deal.comment ?? "");
    setDealAmounts(
      (deal.amounts ?? []).map((a) => ({
        id: a.id,
        bank: a.bank,
        operationType: a.operationType,
        amountIn: String(a.amountIn ?? ""),
        currencyIn: a.currencyIn,
        amountOut: String(a.amountOut ?? ""),
        currencyOut: a.currencyOut,
        shopName: a.shopName ?? "",
      })),
    );
    setDealParticipants(
      (deal.participants ?? []).map((p) => ({ id: p.id, userId: p.user.id, pct: String(p.pct) })),
    );
    fetchDealDropdowns();
  }

  function fetchDealDropdowns() {
    Promise.all([
      fetch("/api/clients", { credentials: "include" }),
      fetch("/api/users/public", { credentials: "include" }),
    ]).then(async ([cRes, wRes]) => {
      if (cRes.ok) setDealClients(await cRes.json());
      if (wRes.ok) setDealWorkers(await wRes.json());
    });
  }

  function closeDealModal() { setDealModalOpen(false); }

  // totals
  const dealTotals = useMemo(() => {
    let tAmountIn = 0;
    let tAmountOut = 0;
    dealAmounts.forEach((r) => {
      tAmountIn += Number(r.amountIn) || 0;
      tAmountOut += Number(r.amountOut) || 0;
    });
    return { tAmountIn, tAmountOut };
  }, [dealAmounts]);

  const pctStatus = useMemo(() => {
    const total = dealParticipants.reduce((s, p) => s + (Number(p.pct) || 0), 0);
    if (total === 100) return { ok: true, text: "✓ Итого: 100%", color: "var(--green)" };
    if (total > 100) return { ok: false, text: `⚠ Итого: ${total}% — превышает 100%`, color: "var(--red)" };
    return { ok: false, text: `⚠ Итого: ${total}% — не хватает ${100 - total}%`, color: "var(--amber)" };
  }, [dealParticipants]);

  async function saveDeal() {
    const parts = dealParticipants.filter((p) => p.userId).map((p) => ({ userId: p.userId, pct: Number(p.pct) || 0 }));
    const totalPct = parts.reduce((s, p) => s + p.pct, 0);
    if (totalPct !== 100) return alert("Проценты участников должны суммарно быть 100%");

    const selectedClient = dealClientId ? dealClients.find((c) => c.id === dealClientId) : null;
    const titleText = selectedClient ? `Сделка — ${selectedClient.name}` : "Сделка";
    const amountsPayload = dealAmounts.map((r) => ({
      amountIn: Number(r.amountIn) || 0,
      currencyIn: r.currencyIn,
      amountOut: Number(r.amountOut) || 0,
      currencyOut: r.currencyOut,
      bank: r.bank,
      operationType: r.operationType,
      shopName: r.operationType === "PURCHASE" ? (r.shopName || null) : null,
    }));

    if (!dealEditingId) {
      const dRes = await fetch("/api/deals", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleText, status: dealStatus, clientId: dealClientSkip ? null : (dealClientId ?? null), dealDate, comment: dealComment || null }),
      });
      if (!dRes.ok) return alert("Не удалось создать сделку");
      const deal = await dRes.json();

      for (const a of amountsPayload) {
        const aRes = await fetch(`/api/deals/${deal.id}/amounts`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(a),
        });
        if (!aRes.ok) return alert("Не удалось сохранить суммы");
      }

      const pRes = await fetch(`/api/deals/${deal.id}/participants`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: parts }),
      });
      if (!pRes.ok) return alert("Не удалось сохранить участников");
    } else {
      const upd = await fetch(`/api/deals/${dealEditingId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleText, status: dealStatus, clientId: dealClientSkip ? null : (dealClientId ?? null), dealDate, comment: dealComment || null }),
      });
      if (!upd.ok) return alert("Не удалось обновить сделку");

      const rep = await fetch(`/api/deals/${dealEditingId}/amounts`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amounts: amountsPayload }),
      });
      if (!rep.ok) return alert("Не удалось обновить суммы");

      const pRes = await fetch(`/api/deals/${dealEditingId}/participants`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: parts }),
      });
      if (!pRes.ok) return alert("Не удалось обновить участников");
    }

    closeDealModal();
    await loadDeals();
  }

  // =========================================================
  // RENDER
  // =========================================================
  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      <div className={`sidebar-overlay${sidebarOpen ? " is-open" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">M</div>
          <span>MyCRM</span>
        </div>

        {/* Org switcher */}
        <div style={{ padding: "8px 12px 4px", position: "relative" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 12px",
              cursor: user?.role === "ADMIN" ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onClick={() => user?.role === "ADMIN" && setOrgSwitchOpen((v) => !v)}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1 }}>Офис</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {orgs.find((o) => o.id === user?.activeOrganizationId)?.name ?? "…"}
              </div>
            </div>
            {user?.role === "ADMIN" && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>⌄</div>}
          </div>

          {orgSwitchOpen && user?.role === "ADMIN" ? (
            <div style={{
              position: "absolute", top: "100%", left: 12, right: 12, zIndex: 200,
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)", overflow: "hidden",
            }}>
              {orgs.map((o) => (
                <div
                  key={o.id}
                  onClick={() => switchOrg(o.id)}
                  style={{
                    padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                    background: o.id === user?.activeOrganizationId ? "var(--accent-light)" : "transparent",
                    color: o.id === user?.activeOrganizationId ? "var(--accent)" : "var(--text-primary)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{o.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{o._count.users} польз. · {o._count.deals} сделок</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Основное</div>
          {(["dashboard", "deals", "clients", "expenses", "reports", "settings"] as Tab[]).map((t) => (
            <a key={t} className={`nav-item ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); setOrgSwitchOpen(false); setSidebarOpen(false); }}>
              <span>
                {t === "dashboard" ? "Dashboard" : t === "deals" ? "Сделки" : t === "clients" ? "Клиенты" : t === "expenses" ? "Расходы" : t === "reports" ? "Отчёты" : "Настройки"}
              </span>
            </a>
          ))}
          <div className="nav-section">Аккаунт</div>
          <a className="nav-item" onClick={logout}><span>Выйти</span></a>
        </nav>
      </aside>

      <div className="main">
        <header className="header">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <h1 className="header-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, textAlign: "right", flexShrink: 0 }}>
            <div>{user ? `${user.email} · ${user.role}` : "…"}</div>
            {orgs.find((o) => o.id === user?.activeOrganizationId) ? (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {orgs.find((o) => o.id === user?.activeOrganizationId)!.name}
              </div>
            ) : null}
          </div>
        </header>

        <div className="content">
          {/* ===== DASHBOARD ===== */}
          {tab === "dashboard" ? (
            <div style={{ display: "grid", gap: 20 }}>

              {/* Period bar */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 260 }}>
                  <input className="form-input" type="date" value={dashFrom} onChange={(e) => setDashFrom(e.target.value)} style={{ height: 36 }} />
                  <span style={{ color: "var(--text-tertiary)" }}>—</span>
                  <input className="form-input" type="date" value={dashTo} onChange={(e) => setDashTo(e.target.value)} style={{ height: 36 }} />
                  <button className="btn btn-secondary" style={{ height: 36, whiteSpace: "nowrap" }} onClick={() => dashView === "global" ? loadGlobalDash() : loadDashboard()}>↻ Обновить</button>
                </div>
                {user?.role === "ADMIN" ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    {([{ id: "current", label: "Текущий офис" }, { id: "global", label: "Все офисы" }] as const).map((v) => (
                      <span key={v.id} onClick={() => { setDashView(v.id); if (v.id === "global") loadGlobalDash(); else loadDashboard(); }}
                        style={{ padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 600,
                          border: "1px solid var(--border)",
                          background: dashView === v.id ? "var(--accent-light)" : "transparent",
                          color: dashView === v.id ? "var(--accent)" : "var(--text-secondary)" }}
                      >{v.label}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              {dashView === "current" ? (
                <>
                  {/* 4 Metric cards */}
                  {dashLoading || !dash ? (
                    <div style={{ color: "var(--text-secondary)", padding: "8px 0" }}>Загрузка...</div>
                  ) : (() => {
                    const amountOut = dash.deals?.totalAmountOut ?? 0;
                    const expenses = dash.expenses?.totalAmount ?? 0;
                    const profit = amountOut - expenses;
                    return (
                      <div className="g4" style={{ gap: 14 }}>
                        {[
                          { label: "Сделки за период", value: String(dash.deals?.count ?? 0), sub: `новых: ${dash.deals?.byStatus?.NEW ?? 0}`, color: "var(--text-primary)" },
                          { label: "Доход", value: amountOut.toLocaleString(), sub: `воркерам: ${(dash.deals?.totalWorkersPayoutUsdt ?? 0).toLocaleString()}`, color: "var(--green)" },
                          { label: "Расходы", value: expenses.toLocaleString(), sub: `записей: ${dash.expenses?.count ?? 0}`, color: "var(--amber)" },
                          { label: "Чистая прибыль", value: profit.toLocaleString(), sub: "доход − расходы", color: profit >= 0 ? "var(--text-primary)" : "var(--red)" },
                        ].map((m) => (
                          <div key={m.label} className="card" style={{ border: "1px solid var(--border-light)" }}>
                            <div className="card-body" style={{ padding: "18px 20px" }}>
                              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-tertiary)", marginBottom: 10 }}>{m.label}</div>
                              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: m.color, lineHeight: 1 }}>{m.value}</div>
                              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>{m.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 3 Quick action cards */}
                  <div className="g3" style={{ gap: 14 }}>
                    {[
                      { icon: "+", title: "Новая сделка", desc: "Создать сделку с клиентом или без", action: () => { setTab("deals"); setTimeout(openDealModal, 50); } },
                      { icon: "+", title: "Новый клиент", desc: "Добавить по номеру телефона", action: () => setTab("clients") },
                      { icon: "+", title: "Новый расход", desc: "Крипта, офис, материалы", action: () => setTab("expenses") },
                    ].map((a) => (
                      <div key={a.title} onClick={a.action} style={{
                        background: "var(--bg-card)", border: "2px dashed var(--border)", borderRadius: "var(--radius-lg)",
                        padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", gap: 8, transition: "var(--transition)", textAlign: "center",
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.background = "var(--accent-light)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-card)"; }}
                      >
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--accent)", fontWeight: 300 }}>{a.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{a.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent activity: deals + expenses */}
                  <div className="dash-recent-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {/* Recent deals */}
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Последние сделки</span>
                        <span style={{ fontSize: 12, color: "var(--accent)", cursor: "pointer", fontWeight: 600 }} onClick={() => setTab("deals")}>Все сделки →</span>
                      </div>
                      <div className="table-scroll" style={{ padding: 0 }}>
                        <table className="data-table">
                          <thead><tr><th>Клиент</th><th>Статус</th><th style={{ textAlign: "right" }}>Выход</th></tr></thead>
                          <tbody>
                            {deals.length === 0 ? (
                              <tr><td colSpan={3} style={{ padding: 16, color: "var(--text-secondary)" }}>Нет сделок</td></tr>
                            ) : deals.slice(0, 5).map((d) => {
                              const out = d.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
                              return (
                                <tr key={d.id} style={{ cursor: "pointer" }} onClick={() => { setTab("deals"); setTimeout(() => openDealEditModal(d), 50); }}>
                                  <td style={{ fontWeight: 500 }}>{d.client ? d.client.name : <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Без клиента</span>}</td>
                                  <td><span className={`badge ${d.status === "CLOSED" ? "badge-green" : d.status === "IN_PROGRESS" ? "badge-amber" : "badge-blue"}`}>{d.status === "NEW" ? "Новая" : d.status === "IN_PROGRESS" ? "В работе" : "Закрыта"}</span></td>
                                  <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{out > 0 ? out.toLocaleString() : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Recent expenses */}
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Последние расходы</span>
                        <span style={{ fontSize: 12, color: "var(--accent)", cursor: "pointer", fontWeight: 600 }} onClick={() => setTab("expenses")}>Все расходы →</span>
                      </div>
                      <div className="table-scroll" style={{ padding: 0 }}>
                        <table className="data-table">
                          <thead><tr><th>Название</th><th>Статус</th><th style={{ textAlign: "right" }}>Сумма</th></tr></thead>
                          <tbody>
                            {expenses.length === 0 ? (
                              <tr><td colSpan={3} style={{ padding: 16, color: "var(--text-secondary)" }}>Нет расходов</td></tr>
                            ) : expenses.slice(0, 5).map((e) => (
                              <tr key={e.id}>
                                <td style={{ fontWeight: 500 }}>{e.title}</td>
                                <td><span className={`badge ${e.status === "APPROVED" ? "badge-green" : e.status === "SUBMITTED" ? "badge-blue" : e.status === "REJECTED" ? "badge-red" : "badge-amber"}`}>{e.status}</span></td>
                                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{Number(e.amount).toLocaleString()} {e.currency}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Global view for ADMIN */
                <div className="card">
                  <div className="card-header"><span className="card-title">Сводка по всем офисам</span></div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {globalDashLoading || !globalDash ? (
                      <div style={{ padding: 16, color: "var(--text-secondary)" }}>Загрузка...</div>
                    ) : (
                      <>
                        <div className="g4" style={{ gap: 12, padding: 16, borderBottom: "1px solid var(--border)" }}>
                          {[
                            { label: "Сделок всего", value: String(globalDash.totals?.dealsCount ?? 0), color: "var(--text-primary)" },
                            { label: "Доход", value: (globalDash.totals?.totalAmountOut ?? 0).toLocaleString(), color: "var(--green)" },
                            { label: "Воркерам", value: (globalDash.totals?.totalWorkersPayoutUsdt ?? 0).toLocaleString(), color: "var(--accent)" },
                            { label: "Расходы", value: (globalDash.totals?.totalExpenses ?? 0).toLocaleString(), color: "var(--amber)" },
                          ].map((c) => (
                            <div key={c.label} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: "14px 16px" }}>
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 6 }}>{c.label}</div>
                              <div style={{ fontWeight: 700, fontSize: 22, fontFamily: "'JetBrains Mono', monospace", color: c.color }}>{c.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="table-scroll"><table className="data-table">
                          <thead>
                            <tr>
                              <th>Офис</th>
                              <th style={{ textAlign: "right" }}>Сделок</th>
                              <th style={{ textAlign: "right" }}>Доход</th>
                              <th style={{ textAlign: "right" }}>Воркерам</th>
                              <th style={{ textAlign: "right" }}>Расходы</th>
                              <th style={{ width: 100 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(globalDash.byOrg ?? []).map((r: any) => (
                              <tr key={r.orgId}>
                                <td style={{ fontWeight: 600 }}>{r.orgName}</td>
                                <td style={{ textAlign: "right" }}>{r.dealsCount}</td>
                                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--green)" }}>{(r.totalAmountOut ?? 0).toLocaleString()}</td>
                                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--accent)" }}>{(r.totalWorkersPayoutUsdt ?? 0).toLocaleString()}</td>
                                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--amber)" }}>{(r.totalExpenses ?? 0).toLocaleString()}</td>
                                <td><button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => switchOrg(r.orgId)}>Перейти</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table></div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* ===== REPORTS ===== */}
          {tab === "reports" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Период</span>
                  <button className="btn btn-secondary" onClick={loadReportsWorkers}>Обновить</button>
                </div>
                <div className="card-body g2">
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
                <div className="card-header"><span className="card-title">Выплаты воркерам</span></div>
                <div className="card-body">
                  {repLoading || !repWorkers ? (
                    <div style={{ color: "var(--text-secondary)" }}>Загрузка...</div>
                  ) : (
                    <div className="table-scroll"><table className="data-table">
                      <thead>
                        <tr>
                          <th>Воркер</th><th>Роль</th><th>Сделок</th>
                          <th style={{ textAlign: "right" }}>Заработок</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(repWorkers.rows ?? []).length === 0 ? (
                          <tr><td colSpan={4} style={{ color: "var(--text-secondary)" }}>Нет данных за период</td></tr>
                        ) : (repWorkers.rows ?? []).map((r: any) => (
                          <tr key={r.userId}>
                            <td>{r.email}</td><td>{r.role}</td><td>{r.dealsCount}</td>
                            <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                              {Number(r.payoutUsdt ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* ===== DEALS ===== */}
          {tab === "deals" ? (
            <div style={{ display: "grid", gap: 16 }}>
              {/* filter bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {([{ id: "ALL", label: "Все" }, { id: "NEW", label: "Новые" }, { id: "IN_PROGRESS", label: "В работе" }, { id: "CLOSED", label: "Закрытые" }] as const).map((f) => (
                    <span
                      key={f.id}
                      onClick={() => setDealFilter(f.id as any)}
                      style={{
                        padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--border)",
                        background: dealFilter === f.id ? "var(--accent-light)" : "transparent",
                        color: dealFilter === f.id ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >{f.label}</span>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Сделки</span>
                  <button className="btn btn-primary" onClick={openDealModal}>+ Новая сделка</button>
                </div>
                <div className="card-body table-scroll" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Дата</th><th>Клиент</th><th>Воркеры</th><th>Статус</th>
                        <th style={{ textAlign: "right" }}>Сумма выхода</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dealsLoading ? (
                        <tr><td colSpan={5} style={{ padding: 16, color: "var(--text-secondary)" }}>Загрузка...</td></tr>
                      ) : deals.filter((d) => dealFilter === "ALL" || d.status === dealFilter).length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: 16, color: "var(--text-secondary)" }}>Пока пусто</td></tr>
                      ) : (
                        deals
                          .filter((d) => dealFilter === "ALL" || d.status === dealFilter)
                          .map((d) => {
                            const totalOut = d.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
                            const workerNames = d.participants.map((p) => p.user.email.split("@")[0]).join(", ");
                            return (
                              <tr key={d.id} onClick={() => openDealEditModal(d)} style={{ cursor: "pointer" }}>
                                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                                  {d.dealDate ? new Date(d.dealDate).toLocaleDateString("ru-RU") : "—"}
                                </td>
                                <td>{d.client ? d.client.name : <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Без клиента</span>}</td>
                                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{workerNames || "—"}</td>
                                <td>
                                  <span className={`badge ${d.status === "CLOSED" ? "badge-green" : d.status === "IN_PROGRESS" ? "badge-amber" : "badge-blue"}`}>
                                    {d.status === "NEW" ? "Новая" : d.status === "IN_PROGRESS" ? "В работе" : "Закрыта"}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                                  {totalOut.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deal modal */}
              {dealModalOpen ? (
                <div
                  className="modal-backdrop"
                  style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) closeDealModal(); }}
                >
                  <div className="card" style={{ width: 820, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }}>
                    <div className="card-header">
                      <span className="card-title">{dealEditingId ? "Редактировать сделку" : "Новая сделка"}</span>
                      <button className="btn btn-secondary" onClick={closeDealModal}>Отмена</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 18 }}>

                      {/* Date + Client */}
                      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 14 }}>
                        <div>
                          <div className="form-label">Дата *</div>
                          <input className="form-input" type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">Клиент</div>
                          {!dealClientSkip && !dealClientId ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <input className="form-input" placeholder="Поиск..." value={dealClientSearch} onChange={(e) => setDealClientSearch(e.target.value)} />
                                <button className="btn btn-secondary" onClick={() => setDealClientSkip(true)}>Без клиента</button>
                              </div>
                              <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)", maxHeight: 130, overflow: "auto" }}>
                                {dealClients.filter((c) => (c.name + " " + c.phone).toLowerCase().includes(dealClientSearch.toLowerCase())).slice(0, 20).map((c) => (
                                  <div key={c.id} style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", display: "flex", gap: 10 }} onClick={() => setDealClientId(c.id)}>
                                    <span style={{ flex: 1 }}>{c.name}</span>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{c.phone}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : dealClientId ? (
                            <div style={{ background: "var(--green-bg)", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                              <span style={{ flex: 1, fontWeight: 600, color: "var(--green-text)" }}>{dealClients.find((c) => c.id === dealClientId)?.name ?? "Клиент"}</span>
                              <button className="btn btn-secondary" onClick={() => setDealClientId(null)}>×</button>
                            </div>
                          ) : (
                            <div style={{ background: "var(--bg-metric)", borderRadius: 10, padding: "8px 12px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                              Без клиента{" "}
                              <span style={{ color: "var(--accent)", cursor: "pointer", fontStyle: "normal", marginLeft: 8 }} onClick={() => setDealClientSkip(false)}>Изменить</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{ width: 240 }}>
                        <div className="form-label">Статус</div>
                        <select className="form-input" value={dealStatus} onChange={(e) => setDealStatus(e.target.value as DealStatus)}>
                          <option value="NEW">Новая</option>
                          <option value="IN_PROGRESS">В работе</option>
                          <option value="CLOSED">Закрыта</option>
                        </select>
                      </div>

                      {/* Amounts */}
                      <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div className="form-label" style={{ margin: 0 }}>Операции *</div>
                          <button className="btn btn-secondary" onClick={() => setDealAmounts((p) => [...p, newAmtRow()])}>+ Добавить строку</button>
                        </div>

                        <div style={{ display: "grid", gap: 10 }}>
                          {dealAmounts.map((r) => (
                            <div key={r.id} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: 14 }}>
                              {/* row 1: bank, type, shopName */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr 28px", gap: 8, marginBottom: 8, alignItems: "end" }}>
                                <div>
                                  <div className="form-label" style={{ marginBottom: 3 }}>Банк</div>
                                  <input
                                    className="form-input"
                                    value={r.bank}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, bank: e.target.value } : x))}
                                    placeholder="ING, PKO BP..."
                                  />
                                </div>
                                <div>
                                  <div className="form-label" style={{ marginBottom: 3 }}>Тип</div>
                                  <select
                                    className="form-input"
                                    value={r.operationType}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, operationType: e.target.value as OperationType } : x))}
                                  >
                                    <option value="ATM">Банкомат</option>
                                    <option value="PURCHASE">Покупка</option>
                                    <option value="TRANSFER">Перевод</option>
                                  </select>
                                </div>
                                <div>
                                  {r.operationType === "PURCHASE" ? (
                                    <>
                                      <div className="form-label" style={{ marginBottom: 3 }}>Магазин</div>
                                      <input
                                        className="form-input"
                                        value={r.shopName}
                                        onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, shopName: e.target.value } : x))}
                                        placeholder="Название магазина"
                                      />
                                    </>
                                  ) : <div />}
                                </div>
                                <div
                                  style={{ width: 28, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18 }}
                                  onClick={() => setDealAmounts((p) => p.filter((x) => x.id !== r.id))}
                                >×</div>
                              </div>

                              {/* row 2: amountIn + currencyIn → amountOut + currencyOut */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 24px 1fr 90px", gap: 8, alignItems: "end" }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>Взяли</div>
                                  <input
                                    className="form-input"
                                    value={r.amountIn}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, amountIn: e.target.value } : x))}
                                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>Валюта</div>
                                  <select
                                    className="form-input"
                                    value={r.currencyIn}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, currencyIn: e.target.value } : x))}
                                  >
                                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                                  </select>
                                </div>
                                <div style={{ textAlign: "center", color: "var(--text-tertiary)", paddingBottom: 8 }}>→</div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", marginBottom: 3 }}>Получили</div>
                                  <input
                                    className="form-input"
                                    value={r.amountOut}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, amountOut: e.target.value } : x))}
                                    style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--green)" }}
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", marginBottom: 3 }}>Валюта</div>
                                  <select
                                    className="form-input"
                                    value={r.currencyOut}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, currencyOut: e.target.value } : x))}
                                  >
                                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* totals row */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 12, marginTop: 12, borderTop: "2px solid var(--border)" }}>
                          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "8px 10px" }}>
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Итого взяли</div>
                            <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>{dealTotals.tAmountIn.toLocaleString()}</div>
                          </div>
                          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "8px 10px" }}>
                            <div style={{ fontSize: 10, color: "var(--green)", textTransform: "uppercase" }}>Итого получили</div>
                            <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "var(--green)" }}>{dealTotals.tAmountOut.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>

                      {/* Participants */}
                      <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div>
                            <div className="form-label" style={{ margin: 0 }}>Участники (воркеры)</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>% от суммы выхода</div>
                          </div>
                          <button className="btn btn-secondary" onClick={() => setDealParticipants((p) => [...p, { id: crypto.randomUUID(), userId: "", pct: "0" }])}>
                            + Добавить
                          </button>
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {dealParticipants.map((p) => {
                            const pct = Number(p.pct) || 0;
                            const earn = Math.round((dealTotals.tAmountOut * pct) / 100 * 100) / 100;
                            return (
                              <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", background: "var(--bg-metric)", borderRadius: 10 }}>
                                <select
                                  className="form-input"
                                  value={p.userId}
                                  onChange={(e) => setDealParticipants((pp) => pp.map((x) => x.id === p.id ? { ...x, userId: e.target.value } : x))}
                                  style={{ flex: 1 }}
                                >
                                  <option value="">— выбрать —</option>
                                  {dealWorkers.map((w) => (
                                    <option key={w.id} value={w.id}>
                                      {w.email}{w.organization ? ` [${w.organization.name}]` : ""}{w.position ? ` · ${w.position}` : ""}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="form-input"
                                  value={p.pct}
                                  onChange={(e) => setDealParticipants((pp) => pp.map((x) => x.id === p.id ? { ...x, pct: e.target.value } : x))}
                                  style={{ width: 70, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}
                                />
                                <span style={{ color: "var(--text-secondary)" }}>%</span>
                                <span style={{ minWidth: 110, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--green)" }}>
                                  {dealTotals.tAmountOut > 0 ? `${earn.toLocaleString()}` : "—"}
                                </span>
                                <span style={{ cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16, padding: "4px 8px" }} onClick={() => setDealParticipants((pp) => pp.filter((x) => x.id !== p.id))}>×</span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: pctStatus.color }}>{pctStatus.text}</div>
                      </div>

                      {/* Comment */}
                      <div>
                        <div className="form-label">Комментарий</div>
                        <textarea className="form-input" value={dealComment} onChange={(e) => setDealComment(e.target.value)} style={{ height: 72, paddingTop: 10 }} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <button className="btn btn-secondary" onClick={closeDealModal}>Отмена</button>
                        <button className="btn btn-primary" onClick={saveDeal} disabled={!pctStatus.ok}>
                          {dealEditingId ? "Сохранить" : "Создать сделку"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ===== CLIENTS ===== */}
          {tab === "clients" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Новый клиент</span>
                  <button className="btn btn-primary" onClick={createClient} disabled={!newClientName || !newClientPhone}>+ Создать</button>
                </div>
                <div className="card-body g2">
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
                  <button className="btn btn-secondary" onClick={loadClients}>Обновить</button>
                </div>
                <div className="card-body table-scroll" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Имя</th><th>Телефон</th><th style={{ width: 100 }}></th></tr>
                    </thead>
                    <tbody>
                      {clientsLoading ? (
                        <tr><td colSpan={3} style={{ padding: 16, color: "var(--text-secondary)" }}>Загрузка...</td></tr>
                      ) : clients.length === 0 ? (
                        <tr><td colSpan={3} style={{ padding: 16, color: "var(--text-secondary)" }}>Пока пусто</td></tr>
                      ) : (
                        clients.map((c) => (
                          <tr key={c.id}>
                            <td>{c.name}</td>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-secondary)" }}>{c.phone}</td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openClientEdit(c)}>Ред.</button>
                                <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => deleteClient(c.id)}>Удал.</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* client edit modal */}
              {clientEditOpen && clientEditing ? (
                <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) setClientEditOpen(false); }}>
                  <div className="card" style={{ width: 420, maxWidth: "100%" }}>
                    <div className="card-header">
                      <span className="card-title">Редактировать клиента</span>
                      <button className="btn btn-secondary" onClick={() => setClientEditOpen(false)}>Отмена</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 12 }}>
                      <div>
                        <div className="form-label">Имя</div>
                        <input className="form-input" value={clientEditName} onChange={(e) => setClientEditName(e.target.value)} />
                      </div>
                      <div>
                        <div className="form-label">Телефон</div>
                        <input className="form-input" value={clientEditPhone} onChange={(e) => setClientEditPhone(e.target.value)} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <button className="btn btn-secondary" onClick={() => setClientEditOpen(false)}>Отмена</button>
                        <button className="btn btn-primary" onClick={saveClientEdit}>Сохранить</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ===== EXPENSES ===== */}
          {tab === "expenses" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Новый расход</span>
                  <button className="btn btn-primary" onClick={createExpense} disabled={!newExpenseTitle || !newExpenseAmount}>+ Создать</button>
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
                      <select className="form-input" value={newExpenseCurrency} onChange={(e) => setNewExpenseCurrency(e.target.value)}>
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="form-label">Оплата</div>
                      <select className="form-input" value={newExpensePayMethod} onChange={(e) => setNewExpensePayMethod(e.target.value)}>
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
                  <button className="btn btn-secondary" onClick={loadExpenses}>Обновить</button>
                </div>
                <div className="card-body table-scroll" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Название</th><th>Статус</th><th style={{ textAlign: "right" }}>Сумма</th></tr>
                    </thead>
                    <tbody>
                      {expensesLoading ? (
                        <tr><td colSpan={3} style={{ padding: 16, color: "var(--text-secondary)" }}>Загрузка...</td></tr>
                      ) : expenses.length === 0 ? (
                        <tr><td colSpan={3} style={{ padding: 16, color: "var(--text-secondary)" }}>Пока пусто</td></tr>
                      ) : (
                        expenses.map((e) => (
                          <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => { setExpenseEditing(e); setExpenseModalOpen(true); }}>
                            <td>{e.title}</td>
                            <td>
                              <span className={`badge ${e.status === "APPROVED" ? "badge-green" : e.status === "SUBMITTED" ? "badge-blue" : e.status === "REJECTED" ? "badge-red" : "badge-amber"}`}>
                                {e.status}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{e.amount} {e.currency}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {expenseModalOpen && expenseEditing ? (
                <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) setExpenseModalOpen(false); }}>
                  <div className="card" style={{ width: 500, maxWidth: "100%" }}>
                    <div className="card-header">
                      <span className="card-title">Расход</span>
                      <button className="btn btn-secondary" onClick={() => setExpenseModalOpen(false)}>Закрыть</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 12 }}>
                      <div><div className="form-label">Название</div><div style={{ fontWeight: 600 }}>{expenseEditing.title}</div></div>
                      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr 1fr" }}>
                        <div>
                          <div className="form-label">Сумма</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{expenseEditing.amount} {expenseEditing.currency}</div>
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
                          <button className="btn btn-primary" onClick={() => expenseAction("submit")}>Отправить на одобрение</button>
                        ) : null}
                        {user?.role === "ADMIN" && expenseEditing.status === "SUBMITTED" ? (
                          <>
                            <button className="btn btn-secondary" onClick={() => expenseAction("reject")}>Отклонить</button>
                            <button className="btn btn-primary" onClick={() => expenseAction("approve")}>Одобрить</button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ===== SETTINGS ===== */}
          {tab === "settings" ? (
            <div style={{ display: "grid", gap: 16 }}>

              {/* Organisations block (ADMIN only) */}
              {user?.role === "ADMIN" ? (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Офисы / Организации</span>
                    <button className="btn btn-secondary" onClick={loadOrgs}>Обновить</button>
                  </div>
                  <div className="card-body" style={{ display: "grid", gap: 16 }}>
                    {/* Create org */}
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <div className="form-label">Название офиса</div>
                        <input className="form-input" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Київ, Дніпро, Львів..." />
                      </div>
                      <button className="btn btn-primary" onClick={createOrg} disabled={!newOrgName.trim()}>+ Создать офис</button>
                    </div>

                    {/* Orgs table */}
                    <div className="card" style={{ border: "1px solid var(--border-light)" }}>
                      <div className="card-body table-scroll" style={{ padding: 0 }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Название</th>
                              <th style={{ textAlign: "right" }}>Сотрудников</th>
                              <th style={{ textAlign: "right" }}>Сделок</th>
                              <th style={{ width: 180 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {orgs.length === 0 ? (
                              <tr><td colSpan={5} style={{ padding: 16, color: "var(--text-secondary)" }}>Нет офисов</td></tr>
                            ) : (
                              orgs.map((o) => (
                                <tr key={o.id}>
                                  <td style={{ fontWeight: 600 }}>
                                    {o.name}
                                    {o.id === user.activeOrganizationId ? (
                                      <span style={{ marginLeft: 8, fontSize: 11, background: "var(--accent-light)", color: "var(--accent)", borderRadius: 6, padding: "2px 7px" }}>активный</span>
                                    ) : null}
                                  </td>
                                  <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{o._count.users}</td>
                                  <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{o._count.deals}</td>
                                  <td>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      {o.id !== user.activeOrganizationId ? (
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: "4px 12px", fontSize: 12 }}
                                          onClick={() => switchOrg(o.id)}
                                        >Перейти</button>
                                      ) : null}
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: "4px 12px", fontSize: 12, color: "var(--red)" }}
                                        onClick={() => deleteOrg(o.id, o.name)}
                                      >Удалить</button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Пользователи</span>
                  <button className="btn btn-secondary" onClick={loadUsers}>Обновить</button>
                </div>
                <div className="card-body" style={{ display: "grid", gap: 16 }}>
                  {user?.role !== "ADMIN" ? (
                    <div style={{ color: "var(--text-secondary)" }}>Доступно только для admin.</div>
                  ) : (
                    <>
                      {/* create form */}
                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                        <div>
                          <div className="form-label">Логин</div>
                          <input className="form-input" value={newUserLogin} onChange={(e) => setNewUserLogin(e.target.value)} placeholder="email или username" />
                        </div>
                        <div>
                          <div className="form-label">Пароль</div>
                          <input className="form-input" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">Должность / Роль в команде</div>
                          <input className="form-input" value={newUserPosition} onChange={(e) => setNewUserPosition(e.target.value)} placeholder="Воркер, Кассир, Бухгалтер..." />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <div className="form-label">Доступ</div>
                            <select className="form-input" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)}>
                              <option value="MANAGER">MANAGER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </div>
                          <div>
                            <div className="form-label">Офис</div>
                            <select className="form-input" value={newUserTargetOrgId} onChange={(e) => setNewUserTargetOrgId(e.target.value)}>
                              <option value="">Текущий</option>
                              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div>
                        <button className="btn btn-primary" onClick={createUser} disabled={!newUserLogin || !newUserPassword}>+ Создать пользователя</button>
                      </div>

                      {/* users table */}
                      <div className="card" style={{ border: "1px solid var(--border-light)" }}>
                        <div className="card-body table-scroll" style={{ padding: 0 }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Логин</th>
                                <th>Должность</th>
                                <th>Офис</th>
                                <th>Доступ</th>
                                <th style={{ width: 260 }}>Действия</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usersLoading ? (
                                <tr><td colSpan={5} style={{ padding: 16 }}>Загрузка...</td></tr>
                              ) : users.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 16 }}>Пока пусто</td></tr>
                              ) : (
                                users.map((u) => (
                                  <tr key={u.id}>
                                    <td style={{ fontWeight: 600 }}>{u.email}</td>
                                    <td>
                                      {userPositionId === u.id ? (
                                        <div style={{ display: "flex", gap: 4 }}>
                                          <input
                                            className="form-input"
                                            value={userPositionValue}
                                            onChange={(e) => setUserPositionValue(e.target.value)}
                                            placeholder="Воркер..."
                                            style={{ width: 120 }}
                                          />
                                          <button className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setUserPosition(u.id)}>OK</button>
                                          <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setUserPositionId(null)}>×</button>
                                        </div>
                                      ) : (
                                        <span
                                          style={{ cursor: "pointer", color: u.position ? "var(--text-primary)" : "var(--text-tertiary)", fontStyle: u.position ? "normal" : "italic" }}
                                          onClick={() => { setUserPositionId(u.id); setUserPositionValue(u.position ?? ""); }}
                                        >
                                          {u.position || "не задана"}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                      {orgs.find((o) => o.id === u.organizationId)?.name ?? "—"}
                                    </td>
                                    <td>
                                      <select
                                        className="form-input"
                                        value={u.role}
                                        style={{ width: 120 }}
                                        onChange={(e) => changeUserRole(u.id, e.target.value as any)}
                                      >
                                        <option value="MANAGER">MANAGER</option>
                                        <option value="ADMIN">ADMIN</option>
                                      </select>
                                    </td>
                                    <td>
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        {userPwdId === u.id ? (
                                          <div style={{ display: "flex", gap: 4 }}>
                                            <input
                                              className="form-input"
                                              type="password"
                                              placeholder="Новый пароль"
                                              value={userPwdValue}
                                              onChange={(e) => setUserPwdValue(e.target.value)}
                                              style={{ width: 120 }}
                                            />
                                            <button className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => resetUserPassword(u.id)}>OK</button>
                                            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => { setUserPwdId(null); setUserPwdValue(""); }}>×</button>
                                          </div>
                                        ) : (
                                          <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { setUserPwdId(u.id); setUserPwdValue(""); }}>
                                            Сменить пароль
                                          </button>
                                        )}
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                                          onClick={() => deleteUser(u.id, u.email)}
                                        >Удалить</button>
                                      </div>
                                    </td>
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
