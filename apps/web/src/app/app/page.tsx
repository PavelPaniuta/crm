"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";

type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "WORKER";

type User = {
  id: string;
  email: string;
  role: Role;
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
  name?: string | null;
  role: Role;
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
  name?: string | null;
  role: Role;
  position?: string | null;
  organizationId: string;
  organization?: { name: string };
};

type TaskStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";

type CrmTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  startsAt: string | null;
  dueAt: string | null;
  createdAt: string;
  assignee: { id: string; email: string; name: string | null };
  createdBy: { id: string; email: string; name: string | null };
};

type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; email: string };
  receiverId?: string;
};

type ChatContact = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  position?: string | null;
};

type ChatConversation = {
  user: ChatContact | null;
  lastMessage: (ChatMessage & { body: string }) | null;
  unread: number;
  lastAt: string;
};

type Tab = "dashboard" | "deals" | "clients" | "expenses" | "reports" | "settings" | "profile" | "staff" | "tasks" | "assistant" | "chat";
type DealStatus = "NEW" | "IN_PROGRESS" | "CLOSED";
type OperationType = "PURCHASE" | "ATM" | "TRANSFER";
type FieldType = "TEXT" | "NUMBER" | "SELECT" | "DATE" | "PERCENT" | "CHECKBOX";

type TemplateField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  order: number;
  options?: string | null;
};

type DealTemplate = {
  id: string;
  name: string;
  hasWorkers: boolean;
  incomeFieldKey?: string | null;
  fields: TemplateField[];
};

type DealDataRow = {
  id: string;
  data: Record<string, unknown>;
  order: number;
};

type Deal = {
  id: string;
  title: string;
  status: DealStatus;
  dealDate: string;
  comment?: string | null;
  clientId?: string | null;
  templateId?: string | null;
  template?: DealTemplate | null;
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
  dataRows?: DealDataRow[];
  participants: Array<{
    id: string;
    pct: number;
    user: { id: string; email: string; name?: string | null; role: "ADMIN" | "MANAGER" };
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

function StaffTable({ members, onSelect }: { members: any[]; onSelect: (id: string) => void }) {
  const ROLE_MAP: Record<string, string> = { SUPER_ADMIN: "Супер Админ", ADMIN: "Админ", MANAGER: "Менеджер", WORKER: "Работник" };
  if (!members || members.length === 0) return <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Нет сотрудников</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
            {["Сотрудник", "Должность", "Роль", "Сделок", "Выплаты"].map(h => (
              <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 500, fontSize: 11 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m: any) => (
            <tr key={m.id} style={{ borderBottom: "1px solid var(--border-color)", cursor: "pointer" }}
              onClick={() => onSelect(m.id)}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <td style={{ padding: "10px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {(m.name || m.email)?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.name || m.email}</div>
                    {m.name && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.email}</div>}
                  </div>
                </div>
              </td>
              <td style={{ padding: "10px 8px", color: "var(--text-secondary)" }}>{m.position || "—"}</td>
              <td style={{ padding: "10px 8px" }}>
                <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "var(--accent)22", color: "var(--accent)" }}>
                  {ROLE_MAP[m.role] ?? m.role}
                </span>
              </td>
              <td style={{ padding: "10px 8px", color: "var(--text-tertiary)" }}>{m.dealsCount}</td>
              <td style={{ padding: "10px 8px", fontWeight: 600, color: m.totalPayout > 0 ? "var(--accent)" : "var(--text-tertiary)" }}>
                {m.totalPayout > 0 ? `$${m.totalPayout}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("MANAGER");
  const [newUserPosition, setNewUserPosition] = useState("");
  const [newUserTargetOrgId, setNewUserTargetOrgId] = useState("");
  const [userPwdId, setUserPwdId] = useState<string | null>(null);
  const [userPwdValue, setUserPwdValue] = useState("");
  const [userPositionId, setUserPositionId] = useState<string | null>(null);
  const [userPositionValue, setUserPositionValue] = useState("");

  // --- Theme ---
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("mycrm-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mycrm-theme", theme);
  }, [theme]);

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

  // --- Deal Templates (for deal modal) ---
  const [dealTemplateId, setDealTemplateId] = useState<string | null>(null);
  const [dealTemplateStep, setDealTemplateStep] = useState<"pick" | "form">("pick");
  const [dealDataRows, setDealDataRows] = useState<Array<{ _id: string; data: Record<string, string> }>>([]);

  // --- Template Management ---
  const [templates, setTemplates] = useState<DealTemplate[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateEditing, setTemplateEditing] = useState<DealTemplate | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplHasWorkers, setTplHasWorkers] = useState(true);
  const [tplIncomeFieldKey, setTplIncomeFieldKey] = useState("");
  const [tplFields, setTplFields] = useState<Array<{ _id: string; label: string; type: FieldType; required: boolean; options: string }>>([]);

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

  // --- Profile ---
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileTelegram, setProfileTelegram] = useState("");
  const [profileContacts, setProfileContacts] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [pwdOld, setPwdOld] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // --- AI Agent ---
  const [agentHistory, setAgentHistory] = useState<{ role: "user" | "assistant"; content: string; pendingAction?: any }[]>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentPending, setAgentPending] = useState<{ type: string; params: any; workersMap?: Record<string, string> } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const agentEndRef = typeof window !== "undefined" ? null : null;

  // --- AI ---
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiChatHistory, setAiChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  // AI template parser (inside template modal)
  const [aiParseOpen, setAiParseOpen] = useState(false);
  const [aiParseSample, setAiParseSample] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiParseError, setAiParseError] = useState<string | null>(null);

  // --- Staff ---
  const [staffData, setStaffData] = useState<any>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffMember, setStaffMember] = useState<any>(null);
  const [staffMemberLoading, setStaffMemberLoading] = useState(false);

  // --- Tasks ---
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskPendingCount, setTaskPendingCount] = useState(0);
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "done">("active");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskFormTitle, setTaskFormTitle] = useState("");
  const [taskFormDesc, setTaskFormDesc] = useState("");
  const [taskFormAssigneeId, setTaskFormAssigneeId] = useState("");
  const [taskFormDue, setTaskFormDue] = useState("");
  const [taskFormStart, setTaskFormStart] = useState("");
  const [taskUsersForSelect, setTaskUsersForSelect] = useState<AppUser[]>([]);

  // --- Task detail drawer ---
  const [taskDetail, setTaskDetail] = useState<CrmTask | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskCommentsLoading, setTaskCommentsLoading] = useState(false);
  const [taskCommentInput, setTaskCommentInput] = useState("");
  const [taskCommentSending, setTaskCommentSending] = useState(false);
  const [taskEditMode, setTaskEditMode] = useState(false);
  const [taskEditTitle, setTaskEditTitle] = useState("");
  const [taskEditDesc, setTaskEditDesc] = useState("");
  const [taskEditDue, setTaskEditDue] = useState("");
  const [taskEditStart, setTaskEditStart] = useState("");
  const [taskEditAssigneeId, setTaskEditAssigneeId] = useState("");

  // --- Chat (DM) ---
  const [chatContacts, setChatContacts] = useState<ChatContact[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [chatActiveUser, setChatActiveUser] = useState<ChatContact | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatShowContacts, setChatShowContacts] = useState(false);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Role helpers
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isManager = user?.role === "MANAGER" || isAdmin;
  const isWorker = user?.role === "WORKER";

  const ROLE_LABELS: Record<Role, string> = {
    SUPER_ADMIN: "Супер Админ",
    ADMIN: "Админ офиса",
    MANAGER: "Менеджер",
    WORKER: "Работник",
  };

  const title = useMemo(() => {
    if (tab === "dashboard") return "Dashboard";
    if (tab === "deals") return "Сделки";
    if (tab === "clients") return "Клиенты";
    if (tab === "expenses") return "Расходы";
    if (tab === "reports") return "Отчёты";
    if (tab === "settings") return "Настройки";
    if (tab === "profile") return "Мой профиль";
    if (tab === "staff") return "Сотрудники";
    if (tab === "tasks") return "Задачи";
    if (tab === "chat") return "Чат";
    if (tab === "assistant") return "AI Ассистент";
    return "MyCRM";
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
    if (user) {
      void loadTaskPendingCount();
      void loadChatUnread();
      const unreadTimer = setInterval(() => void loadChatUnread(), 30000);
      return () => clearInterval(unreadTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Scroll chat to bottom when messages arrive on chat tab
  useEffect(() => {
    if (tab === "chat") setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [chatMessages, tab]);

  useEffect(() => {
    if (tab === "clients") loadClients();
    if (tab === "expenses") loadExpenses();
    if (tab === "settings") { loadUsers(); loadOrgs(); loadTemplates(); }
    if (tab === "deals") { loadDeals(); loadTemplates(); }
    if (tab === "dashboard" && user?.role !== "WORKER") { loadDashboard(); loadDeals(); loadExpenses(); }
    if (tab === "reports") loadReportsWorkers();
    if (tab === "profile") loadProfile();
    if (tab === "staff") loadStaff();
    if (tab === "tasks") { void loadTasks(); if (isManager) void loadTaskUserOptions(); }
    if ((tab === "reports" || tab === "assistant") && aiConfigured === null) {
      fetch("/api/ai/status", { credentials: "include" }).then(r => r.json()).then(j => setAiConfigured(j.configured));
    }
    if (tab === "chat") {
      void loadChatContacts();
      void loadChatConversations();
      if (chatPollRef.current) clearInterval(chatPollRef.current);
      chatPollRef.current = setInterval(() => { void pollChatMessages(); void loadChatUnread(); }, 5000);
    } else {
      if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; }
    }
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
      // SUPER_ADMIN fetches all users across orgs; ADMIN fetches own org users
      const url = user?.role === "SUPER_ADMIN" ? "/api/users/public" : "/api/users";
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) { setUsers([]); return; }
      const j = await res.json();
      setUsers(Array.isArray(j) ? j : []);
    } finally { setUsersLoading(false); }
  }

  async function deleteDeal(id: string) {
    if (!confirm("Удалить сделку? Это действие нельзя отменить.")) return;
    const res = await fetch(`/api/deals/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok || res.status === 204) {
      setDeals(ds => ds.filter(d => d.id !== id));
    } else {
      alert("Не удалось удалить сделку");
    }
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

  async function loadStaff() {
    setStaffLoading(true);
    setStaffMember(null);
    try {
      const res = await fetch("/api/staff", { credentials: "include" });
      if (res.ok) setStaffData(await res.json());
    } finally { setStaffLoading(false); }
  }

  async function loadStaffMember(id: string) {
    setStaffMemberLoading(true);
    try {
      const [memberRes, membershipsRes] = await Promise.all([
        fetch(`/api/staff/${id}`, { credentials: "include" }),
        fetch(`/api/memberships/${id}`, { credentials: "include" }),
      ]);
      if (memberRes.ok) {
        const member = await memberRes.json();
        const memberships = membershipsRes.ok ? await membershipsRes.json() : [];
        setStaffMember({ ...member, extraMemberships: memberships });
      }
    } finally { setStaffMemberLoading(false); }
  }

  async function loadTaskPendingCount() {
    try {
      const res = await fetch("/api/tasks/pending-count", { credentials: "include" });
      if (res.ok) {
        const j = await res.json();
        setTaskPendingCount(j.count ?? 0);
      }
    } catch { /* ignore */ }
  }

  async function loadTasks() {
    setTasksLoading(true);
    try {
      const res = await fetch("/api/tasks", { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) { setTasks([]); return; }
      const j = await res.json();
      setTasks(Array.isArray(j) ? j : []);
    } finally {
      setTasksLoading(false);
    }
    await loadTaskPendingCount();
  }

  async function loadTaskUserOptions() {
    if (!isManager) return;
    // MANAGER нет доступа к GET /api/users — используем public (тот же org, что в activeOrganization)
    const res = await fetch("/api/users/public", { credentials: "include" });
    if (res.ok) {
      const j = await res.json();
      setTaskUsersForSelect(Array.isArray(j) ? j : []);
    }
  }

  async function createTaskFromModal() {
    if (!taskFormTitle.trim() || !taskFormAssigneeId) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskFormTitle.trim(),
        description: taskFormDesc.trim() || null,
        assigneeId: taskFormAssigneeId,
        dueAt: taskFormDue || null,
        startsAt: taskFormStart || null,
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return alert((e as { message?: string }).message ?? "Ошибка");
    }
    setTaskModalOpen(false);
    setTaskFormTitle(""); setTaskFormDesc(""); setTaskFormAssigneeId("");
    setTaskFormDue(""); setTaskFormStart("");
    await loadTasks();
  }

  async function patchTask(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await loadTasks();
    else { const e = await res.json().catch(() => ({})); alert((e as { message?: string }).message ?? "Ошибка"); }
  }

  async function deleteTaskById(id: string) {
    if (!confirm("Удалить задачу?")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) { if (taskDetail?.id === id) setTaskDetail(null); await loadTasks(); }
  }

  async function openTaskDetail(t: CrmTask) {
    setTaskDetail(t);
    setTaskEditMode(false);
    setTaskComments([]);
    setTaskCommentInput("");
    setTaskCommentsLoading(true);
    try {
      const res = await fetch(`/api/tasks/${t.id}/comments`, { credentials: "include" });
      if (res.ok) setTaskComments(await res.json());
    } finally { setTaskCommentsLoading(false); }
  }

  async function submitTaskComment() {
    if (!taskDetail || !taskCommentInput.trim() || taskCommentSending) return;
    setTaskCommentSending(true);
    try {
      const res = await fetch(`/api/tasks/${taskDetail.id}/comments`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: taskCommentInput.trim() }),
      });
      if (res.ok) {
        const c = await res.json();
        setTaskComments(prev => [...prev, c]);
        setTaskCommentInput("");
      }
    } finally { setTaskCommentSending(false); }
  }

  async function saveTaskEdit() {
    if (!taskDetail || !taskEditTitle.trim()) return;
    await patchTask(taskDetail.id, {
      title: taskEditTitle.trim(),
      description: taskEditDesc.trim() || null,
      dueAt: taskEditDue || null,
      startsAt: taskEditStart || null,
      assigneeId: taskEditAssigneeId || undefined,
    });
    // reload updated task
    const res = await fetch("/api/tasks", { credentials: "include" });
    if (res.ok) {
      const all: CrmTask[] = await res.json();
      const updated = all.find(t => t.id === taskDetail.id);
      if (updated) setTaskDetail(updated);
    }
    setTaskEditMode(false);
  }

  // --- Chat (DM) functions ---
  async function loadChatContacts() {
    const res = await fetch("/api/chat/users", { credentials: "include" });
    if (res.ok) setChatContacts(await res.json());
  }

  async function loadChatConversations() {
    const res = await fetch("/api/chat/conversations", { credentials: "include" });
    if (res.ok) setChatConversations(await res.json());
  }

  async function openChatWith(contact: ChatContact) {
    setChatActiveUser(contact);
    setChatMessages([]);
    setChatShowContacts(false);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/chat/messages?with=${contact.id}&limit=50`, { credentials: "include" });
      if (res.ok) setChatMessages(await res.json());
      // mark as read
      await fetch("/api/chat/read", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: contact.id }),
      });
      setChatConversations(prev => prev.map(c => c.user?.id === contact.id ? { ...c, unread: 0 } : c));
    } finally { setChatLoading(false); }
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "instant" }), 80);
  }

  async function pollChatMessages() {
    if (!chatActiveUser) return;
    try {
      const res = await fetch(`/api/chat/messages?with=${chatActiveUser.id}&limit=20`, { credentials: "include" });
      if (res.ok) {
        const msgs: ChatMessage[] = await res.json();
        setChatMessages(prev => {
          if (prev.length === 0) return msgs;
          const existIds = new Set(prev.map(m => m.id));
          const newOnes = msgs.filter(m => !existIds.has(m.id));
          if (!newOnes.length) return prev;
          // auto-mark read for incoming messages
          void fetch("/api/chat/read", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ otherUserId: chatActiveUser.id }),
          });
          return [...prev, ...newOnes];
        });
      }
    } catch { /* ignore */ }
    // also refresh conversations sidebar
    void loadChatConversations();
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatSending || !chatActiveUser) return;
    setChatSending(true);
    setChatInput("");
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, receiverId: chatActiveUser.id }),
      });
      if (res.ok) {
        const msg: ChatMessage = await res.json();
        setChatMessages(prev => [...prev, msg]);
        void loadChatConversations();
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally { setChatSending(false); }
  }

  async function loadChatUnread() {
    try {
      const res = await fetch("/api/chat/unread", { credentials: "include" });
      if (res.ok) { const j = await res.json(); setChatUnread(j.count ?? 0); }
    } catch { /* ignore */ }
  }

  async function addMembership(userId: string, organizationId: string) {
    const res = await fetch("/api/memberships", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, organizationId }),
    });
    if (res.ok) loadStaffMember(userId);
    else { const e = await res.json().catch(() => ({})); alert(e.message ?? "Ошибка"); }
  }

  async function removeMembership(userId: string, orgId: string) {
    const res = await fetch(`/api/memberships/${userId}/${orgId}`, { method: "DELETE", credentials: "include" });
    if (res.ok) loadStaffMember(userId);
  }

  async function sendAiMessage(msg?: string) {
    const question = (msg ?? aiChatInput).trim();
    if (!question) return;
    const newHistory = [...aiChatHistory, { role: "user" as const, content: question }];
    setAiChatHistory(newHistory);
    setAiChatInput("");
    setAiChatLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: aiChatHistory }),
      });
      const j = await res.json();
      setAiChatHistory(h => [...h, { role: "assistant", content: j.answer }]);
    } finally { setAiChatLoading(false); }
  }

  async function sendAgentMessage(msg?: string) {
    const text = (msg ?? agentInput).trim();
    if (!text || agentLoading) return;
    const newHistory = [...agentHistory, { role: "user" as const, content: text }];
    setAgentHistory(newHistory);
    setAgentInput("");
    setAgentPending(null);
    setAgentLoading(true);
    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: agentHistory.map(h => ({ role: h.role, content: h.content })),
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        setAgentHistory(h => [...h, { role: "assistant", content: `❌ Ошибка сервера (${res.status}): ${errText.slice(0, 200)}` }]);
        return;
      }
      const j = await res.json();
      const content = j.text || j.answer || j.message || j.error || "Нет ответа от AI";
      const assistantMsg = { role: "assistant" as const, content, pendingAction: j.pendingAction };
      setAgentHistory(h => [...h, assistantMsg]);
      if (j.pendingAction) setAgentPending(j.pendingAction);
    } catch (e: any) {
      setAgentHistory(h => [...h, { role: "assistant", content: `❌ Ошибка сети: ${e.message}` }]);
    } finally { setAgentLoading(false); }
  }

  async function confirmAgentAction() {
    if (!agentPending) return;
    setAgentPending(null);
    try {
      if (agentPending.type === "create_deal") {
        const p = agentPending.params;
        // Step 1: create deal
        const res = await fetch("/api/deals", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: p.title ?? "",
            dealDate: p.date,
            status: p.status ?? "NEW",
            comment: p.comment ?? "",
            templateId: p.templateId ?? null,
            dataRows: (p.dataRows ?? []).map((r: any, i: number) => ({ data: r, order: i })),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setAgentHistory(h => [...h, { role: "assistant", content: `❌ Ошибка создания сделки: ${err.message ?? res.status}` }]);
          return;
        }
        const deal = await res.json();
        // Step 2: set participants
        const parts = (p.participants ?? []).filter((x: any) => x.userId);
        if (parts.length > 0) {
          await fetch(`/api/deals/${deal.id}/participants`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participants: parts }),
          });
        }
        // Step 3: set amounts (classic deal)
        const amounts = (p.amounts ?? []).filter((a: any) => a.amountOut);
        if (amounts.length > 0) {
          await fetch(`/api/deals/${deal.id}/amounts`, {
            method: "PUT", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amounts: amounts.map((a: any) => ({
              amountIn: a.amountIn ?? 0, currencyIn: a.currencyIn ?? "USD",
              amountOut: a.amountOut, currencyOut: a.currencyOut ?? "USD",
              bank: a.bank ?? "", operationType: a.operationType ?? "ATM",
            })) }),
          });
        }
        const wMap = agentPending.workersMap ?? {};
        const partsText = parts.map((x: any) => `${wMap[x.userId] ?? x.userId} (${x.pct}%)`).join(" + ");
        setAgentHistory(h => [...h, { role: "assistant", content: `✅ Сделка создана!\n${partsText ? `👥 ${partsText}` : ""}\nОткройте вкладку «Сделки» чтобы посмотреть.` }]);
      } else if (agentPending.type === "create_expense") {
        const p = agentPending.params;
        const res = await fetch("/api/expenses", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: p.title || p.description || "Расход",
            amount: p.amount,
            currency: p.currency ?? "USD",
            payMethod: p.payMethod ?? "Наличные",
          }),
        });
        if (res.ok) {
          setAgentHistory(h => [...h, { role: "assistant", content: "✅ Расход записан!" }]);
        } else {
          const err = await res.json().catch(() => ({}));
          setAgentHistory(h => [...h, { role: "assistant", content: `❌ Ошибка записи расхода: ${err.message ?? res.status}` }]);
        }
      }
    } catch (e: any) {
      setAgentHistory(h => [...h, { role: "assistant", content: `❌ ${e.message}` }]);
    }
  }

  function startVoice() {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Браузер не поддерживает голосовой ввод. Используйте Chrome или Edge."); return; }
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

  async function aiParseTemplate() {
    if (!aiParseSample.trim()) return;
    setAiParsing(true);
    setAiParseError(null);
    try {
      const res = await fetch("/api/ai/parse-template", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleRows: aiParseSample }),
      });
      const j = await res.json();
      if (j.error) { setAiParseError(j.error); return; }
      // Fill template fields from AI response
      setTplName(j.name ?? "");
      setTplHasWorkers(j.hasWorkers ?? false);
      setTplIncomeFieldKey(j.incomeFieldKey ?? "");
      setTplFields((j.fields ?? []).map((f: any, i: number) => ({
        _id: crypto.randomUUID(),
        label: f.label ?? `Поле ${i + 1}`,
        type: (f.type as FieldType) ?? "TEXT",
        required: f.required ?? false,
        options: f.options ?? "",
      })));
      setAiParseOpen(false);
      setAiParseSample("");
    } finally { setAiParsing(false); }
  }

  async function loadTemplates() {
    const res = await fetch("/api/deal-templates", { credentials: "include" });
    if (res.ok) setTemplates(await res.json());
  }

  async function loadProfile() {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (!res.ok) return;
      const j = await res.json();
      setProfile(j);
      setProfileName(j.name ?? "");
      setProfileEmail(j.email ?? "");
      setProfilePhone(j.phone ?? "");
      setProfileTelegram(j.telegram ?? "");
      setProfileContacts(j.contacts ?? "");
    } finally { setProfileLoading(false); }
  }

  async function saveProfile() {
    setProfileSaving(true); setProfileError(null); setProfileSuccess(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName || null,
          email: profileEmail || undefined,
          phone: profilePhone || null,
          telegram: profileTelegram || null,
          contacts: profileContacts || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setProfileError(j?.message ?? "Ошибка сохранения"); return; }
      setProfile(j);
      setProfileSuccess("Профиль сохранён");
      setTimeout(() => setProfileSuccess(null), 3000);
    } finally { setProfileSaving(false); }
  }

  async function changePassword() {
    setPwdError(null); setPwdSuccess(null);
    if (!pwdOld) return setPwdError("Введите текущий пароль");
    if (!pwdNew) return setPwdError("Введите новый пароль");
    if (pwdNew.length < 6) return setPwdError("Новый пароль минимум 6 символов");
    if (pwdNew !== pwdConfirm) return setPwdError("Пароли не совпадают");
    setPwdSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: pwdOld, newPassword: pwdNew }),
      });
      const j = await res.json();
      if (!res.ok) { setPwdError(j?.message ?? "Ошибка"); return; }
      setPwdSuccess("Пароль изменён");
      setPwdOld(""); setPwdNew(""); setPwdConfirm("");
      setTimeout(() => setPwdSuccess(null), 3000);
    } finally { setPwdSaving(false); }
  }

  function openTemplateModal(tpl?: DealTemplate) {
    setTemplateEditing(tpl ?? null);
    setTplName(tpl?.name ?? "");
    setTplHasWorkers(tpl?.hasWorkers ?? true);
    setTplIncomeFieldKey(tpl?.incomeFieldKey ?? "");
    setTplFields(
      tpl?.fields.map((f) => ({
        _id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.options ?? "",
      })) ?? []
    );
    setTemplateModalOpen(true);
  }

  function addTplField() {
    setTplFields((prev) => [...prev, { _id: crypto.randomUUID(), label: "", type: "TEXT", required: false, options: "" }]);
  }

  async function saveTemplate() {
    if (!tplName.trim()) return alert("Введите название шаблона");
    if (tplFields.length === 0) return alert("Добавьте хотя бы одно поле");
    for (const f of tplFields) {
      if (!f.label.trim()) return alert("У всех полей должно быть название");
    }
    const fields = tplFields.map((f, i) => ({
      key: f.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_а-яё]/gi, "") || `field_${i}`,
      label: f.label,
      type: f.type,
      required: f.required,
      order: i,
      options: f.options.trim() || null,
    }));
    const payload = { name: tplName, hasWorkers: tplHasWorkers, incomeFieldKey: tplIncomeFieldKey || null, fields };

    if (templateEditing) {
      const res = await fetch(`/api/deal-templates/${templateEditing.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) return alert("Не удалось сохранить шаблон");
    } else {
      const res = await fetch("/api/deal-templates", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) return alert("Не удалось создать шаблон");
    }
    setTemplateModalOpen(false);
    loadTemplates();
  }

  async function deleteTemplate(id: string, name: string) {
    if (!confirm(`Удалить шаблон "${name}"? Существующие сделки не будут затронуты.`)) return;
    await fetch(`/api/deal-templates/${id}`, { method: "DELETE", credentials: "include" });
    loadTemplates();
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
        name: newUserName || null,
        position: newUserPosition || null,
        targetOrgId: newUserTargetOrgId || null,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const msg = errBody?.message ?? `HTTP ${res.status}`;
      return alert(`Не удалось создать пользователя:\n${Array.isArray(msg) ? msg.join("\n") : msg}`);
    }
    setNewUserLogin(""); setNewUserName(""); setNewUserPassword(""); setNewUserPosition(""); setNewUserTargetOrgId("");
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
    setDealTemplateId(null);
    setDealTemplateStep(templates.length > 0 ? "pick" : "form");
    setDealDataRows([{ _id: crypto.randomUUID(), data: {} }]);
    fetchDealDropdowns();
  }

  function openDealEditModal(deal: Deal) {
    setDealModalOpen(true); setDealEditingId(deal.id);
    setDealDate((deal.dealDate ?? new Date().toISOString()).slice(0, 10));
    setDealStatus(deal.status); setDealClientSearch("");
    setDealClientId(deal.clientId ?? null);
    setDealClientSkip(!deal.clientId);
    setDealComment(deal.comment ?? "");
    setDealTemplateId(deal.templateId ?? null);
    setDealTemplateStep("form");
    setDealDataRows(
      (deal.dataRows ?? []).length > 0
        ? deal.dataRows!.map((r) => ({ _id: r.id, data: Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, String(v ?? "")])) }))
        : [{ _id: crypto.randomUUID(), data: {} }]
    );
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
    const activeTpl = dealTemplateId ? templates.find((t) => t.id === dealTemplateId) : null;
    const needWorkers = activeTpl ? activeTpl.hasWorkers : true;

    const parts = dealParticipants.filter((p) => p.userId).map((p) => ({ userId: p.userId, pct: Number(p.pct) || 0 }));
    if (needWorkers && parts.length > 0) {
      const totalPct = parts.reduce((s, p) => s + p.pct, 0);
      if (totalPct !== 100) return alert("Проценты участников должны суммарно быть 100%");
    }

    const selectedClient = dealClientId ? dealClients.find((c) => c.id === dealClientId) : null;
    const tplName2 = activeTpl ? ` [${activeTpl.name}]` : "";
    const titleText = selectedClient ? `Сделка — ${selectedClient.name}${tplName2}` : `Сделка${tplName2}`;

    const basePayload = {
      title: titleText,
      status: dealStatus,
      clientId: dealClientSkip ? null : (dealClientId ?? null),
      dealDate,
      comment: dealComment || null,
    };

    if (activeTpl) {
      // Template-based deal
      const rowsPayload = dealDataRows.map((r, i) => ({ data: r.data, order: i }));
      const payload = { ...basePayload, templateId: activeTpl.id, dataRows: rowsPayload };

      if (!dealEditingId) {
        const dRes = await fetch("/api/deals", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!dRes.ok) return alert("Не удалось создать сделку");
        const deal = await dRes.json();
        if (needWorkers && parts.length > 0) {
          await fetch(`/api/deals/${deal.id}/participants`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participants: parts }),
          });
        }
      } else {
        const upd = await fetch(`/api/deals/${dealEditingId}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!upd.ok) return alert("Не удалось обновить сделку");
        if (needWorkers) {
          await fetch(`/api/deals/${dealEditingId}/participants`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participants: parts }),
          });
        }
      }
    } else {
      // Classic deal
      if (parts.length > 0) {
        const totalPct = parts.reduce((s, p) => s + p.pct, 0);
        if (totalPct !== 100) return alert("Проценты участников должны суммарно быть 100%");
      }
      const amountsPayload = dealAmounts.map((r) => ({
        amountIn: Number(r.amountIn) || 0, currencyIn: r.currencyIn,
        amountOut: Number(r.amountOut) || 0, currencyOut: r.currencyOut,
        bank: r.bank, operationType: r.operationType,
        shopName: r.operationType === "PURCHASE" ? (r.shopName || null) : null,
      }));

      if (!dealEditingId) {
        const dRes = await fetch("/api/deals", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(basePayload),
        });
        if (!dRes.ok) return alert("Не удалось создать сделку");
        const deal = await dRes.json();
        for (const a of amountsPayload) {
          await fetch(`/api/deals/${deal.id}/amounts`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify(a),
          });
        }
        if (parts.length > 0) {
          await fetch(`/api/deals/${deal.id}/participants`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participants: parts }),
          });
        }
      } else {
        const upd = await fetch(`/api/deals/${dealEditingId}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(basePayload),
        });
        if (!upd.ok) return alert("Не удалось обновить сделку");
        await fetch(`/api/deals/${dealEditingId}/amounts`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amounts: amountsPayload }),
        });
        await fetch(`/api/deals/${dealEditingId}/participants`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participants: parts }),
        });
      }
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
              cursor: isSuperAdmin ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onClick={() => isSuperAdmin && setOrgSwitchOpen((v) => !v)}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1 }}>Офис</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {orgs.find((o) => o.id === user?.activeOrganizationId)?.name ?? "…"}
              </div>
            </div>
            {isSuperAdmin && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>⌄</div>}
          </div>

          {orgSwitchOpen && isSuperAdmin ? (
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
          {(() => {
            const NAV_LABELS: Record<string, string> = {
              dashboard: isWorker ? "Мой кабинет" : "Обзор",
              deals: "Сделки", clients: "Клиенты",
              expenses: "Расходы", reports: "Отчёты",
              staff: "Сотрудники", tasks: "Задачи", chat: "Чат",
              assistant: "AI Ассистент", settings: "Настройки", profile: "Профиль"
            };
            const NAV_SVG: Record<string, ReactElement> = {
              dashboard: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
              deals: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>,
              clients: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              expenses: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
              reports: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
              staff: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
              tasks: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
              chat: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
              assistant: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg>,
              settings: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
              profile: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
            };

            const renderItem = (t: Tab) => (
              <a key={t} className={`nav-item ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); setOrgSwitchOpen(false); setSidebarOpen(false); }}>
                <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: tab === t ? 1 : 0.55 }}>{NAV_SVG[t]}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  {NAV_LABELS[t]}
                  {t === "tasks" && taskPendingCount > 0 && (
                    <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "18px", textAlign: "center" }}>{taskPendingCount > 9 ? "9+" : taskPendingCount}</span>
                  )}
                  {t === "chat" && chatUnread > 0 && (
                    <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "18px", textAlign: "center" }}>{chatUnread > 9 ? "9+" : chatUnread}</span>
                  )}
                </span>
              </a>
            );

            if (isWorker) {
              return (
                <>
                  {renderItem("dashboard")}
                  <div className="nav-divider" />
                  <div className="nav-section">Задачи и чат</div>
                  {renderItem("tasks")}
                  {renderItem("chat")}
                  <div className="nav-divider" />
                  <div className="nav-section">Аккаунт</div>
                  {renderItem("profile")}
                </>
              );
            }

            return (
              <>
                {renderItem("dashboard")}

                <div className="nav-divider" />
                <div className="nav-section">Продажи</div>
                {renderItem("deals")}
                {renderItem("clients")}

                <div className="nav-divider" />
                <div className="nav-section">Финансы</div>
                {renderItem("expenses")}
                {isAdmin && renderItem("reports")}

                <div className="nav-divider" />
                <div className="nav-section">Команда</div>
                {isAdmin && renderItem("staff")}
                {renderItem("tasks")}
                {renderItem("chat")}

                <div className="nav-divider" />
                <div className="nav-section">Система</div>
                {renderItem("assistant")}
                {isAdmin && renderItem("settings")}
                {renderItem("profile")}
              </>
            );
          })()}
          <div className="nav-divider" />
          <a className="nav-item" onClick={logout}>
            <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.55 }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            <span>Выйти</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", opacity: 0.6 }}>
                {theme === "dark"
                  ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                  : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                }
              </span>
              <span>{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>
            </span>
            <span className={`theme-toggle-pill${theme === "dark" ? " is-dark" : ""}`} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <h1 className="header-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, textAlign: "right", flexShrink: 0 }}>
            <div>{user ? `${user.email} · ${ROLE_LABELS[user.role] ?? user.role}` : "…"}</div>
            {orgs.find((o) => o.id === user?.activeOrganizationId) ? (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {orgs.find((o) => o.id === user?.activeOrganizationId)!.name}
              </div>
            ) : null}
          </div>
        </header>

        <div className="content">
          {/* ===== WORKER CABINET ===== */}
          {tab === "dashboard" && isWorker ? (
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
          ) : null}

          {/* ===== DASHBOARD ===== */}
          {tab === "dashboard" && !isWorker ? (
            <div style={{ display: "grid", gap: 16 }}>

              {/* Period bar */}
              <div className="dash-period-bar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div className="dash-period-dates" style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                  <input className="form-input" type="date" value={dashFrom} onChange={(e) => setDashFrom(e.target.value)} style={{ height: 36 }} />
                  <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>—</span>
                  <input className="form-input" type="date" value={dashTo} onChange={(e) => setDashTo(e.target.value)} style={{ height: 36 }} />
                  <button className="btn btn-secondary" style={{ height: 36, whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => dashView === "global" ? loadGlobalDash() : loadDashboard()}>↻ Обновить</button>
                </div>
                {isSuperAdmin ? (
                  <div className="dash-view-tabs" style={{ display: "flex", gap: 6 }}>
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
                    const expTotal = dash.expenses?.totalAmount ?? 0;
                    const profit = amountOut - expTotal;
                    const metrics = [
                      {
                        label: "Сделки", value: String(dash.deals?.count ?? 0), sub: `новых: ${dash.deals?.byStatus?.NEW ?? 0}`,
                        iconColor: "#6366F1", iconBg: "rgba(99,102,241,0.12)",
                        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
                      },
                      {
                        label: "Доход", value: amountOut.toLocaleString(), sub: `воркерам: ${(dash.deals?.totalWorkersPayoutUsdt ?? 0).toLocaleString()}`,
                        iconColor: "#059669", iconBg: "rgba(5,150,105,0.12)",
                        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>,
                      },
                      {
                        label: "Расходы", value: expTotal.toLocaleString(), sub: `записей: ${dash.expenses?.count ?? 0}`,
                        iconColor: "#D97706", iconBg: "rgba(217,119,6,0.12)",
                        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
                      },
                      {
                        label: "Прибыль", value: profit.toLocaleString(), sub: "доход − расходы",
                        iconColor: profit >= 0 ? "#059669" : "#DC2626", iconBg: profit >= 0 ? "rgba(5,150,105,0.12)" : "rgba(220,38,38,0.12)",
                        icon: profit >= 0
                          ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                      },
                    ];
                    return (
                      <div className="metric-grid">
                        {metrics.map((m) => (
                          <div key={m.label} className="metric-card">
                            <div className="metric-icon" style={{ background: m.iconBg, color: m.iconColor }}>{m.icon}</div>
                            <div className="metric-body">
                              <div className="metric-label">{m.label}</div>
                              <div className="metric-value" style={{ color: m.iconColor }}>{m.value}</div>
                              <div className="metric-sub">{m.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Quick actions */}
                  <div className="dash-quick-actions g3" style={{ gap: 10 }}>
                    {[
                      { title: "Новая сделка", desc: "Создать сделку с клиентом", action: () => { setTab("deals"); setTimeout(openDealModal, 50); },
                        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg> },
                      { title: "Новый клиент", desc: "Добавить по номеру телефона", action: () => setTab("clients"),
                        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> },
                      { title: "Новый расход", desc: "Крипта, офис, материалы", action: () => setTab("expenses"),
                        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> },
                    ].map((a) => (
                      <button key={a.title} onClick={a.action} style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                        padding: "16px", display: "flex", alignItems: "center", gap: 12,
                        cursor: "pointer", transition: "var(--transition)", textAlign: "left",
                        fontFamily: "inherit",
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.background = "var(--accent-light)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-card)"; }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>{a.icon}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>{a.desc}</div>
                        </div>
                      </button>
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
                        <div className="metric-grid" style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
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
              <div className="page-header">
                <div className="page-header-left">
                  <div className="page-header-title">Отчёты</div>
                  <div className="page-header-sub">Аналитика выплат и статистика по воркерам</div>
                </div>
                <div className="page-header-actions">
                  <button className="btn btn-secondary" onClick={loadReportsWorkers}>↻ Обновить</button>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Период</span>
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
              {/* Page header */}
              <div className="page-header">
                <div className="page-header-left">
                  <div className="page-header-title">Сделки</div>
                  <div className="page-header-sub">Управляйте сделками, участниками и выплатами</div>
                </div>
                <div className="page-header-actions">
                  <div className="filter-tabs">
                    {([{ id: "ALL", label: "Все" }, { id: "NEW", label: "Новые" }, { id: "IN_PROGRESS", label: "В работе" }, { id: "CLOSED", label: "Закрытые" }] as const).map((f) => (
                      <button key={f.id} className={`filter-tab ${dealFilter === f.id ? "active" : ""}`} onClick={() => setDealFilter(f.id as any)}>{f.label}</button>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={openDealModal}>+ Новая сделка</button>
                </div>
              </div>

              <div className="card">
                <div className="card-body table-scroll" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Дата</th><th>Клиент</th><th>Воркеры</th><th>Статус</th>
                        <th style={{ textAlign: "right" }}>Выход</th>
                        {isAdmin && <th style={{ width: 40 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {dealsLoading ? (
                        <tr><td colSpan={6} style={{ padding: 24, color: "var(--text-secondary)" }}>Загрузка...</td></tr>
                      ) : deals.filter((d) => dealFilter === "ALL" || d.status === dealFilter).length === 0 ? (
                        <tr><td colSpan={6}>
                          <div className="empty-state">
                            <div className="empty-state-icon">
                              <svg width="22" height="22" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                            </div>
                            <div className="empty-state-title">Нет сделок</div>
                            <div className="empty-state-desc">Создайте первую сделку чтобы начать вести учёт</div>
                            <button className="btn btn-primary" onClick={openDealModal}>+ Новая сделка</button>
                          </div>
                        </td></tr>
                      ) : (
                        deals
                          .filter((d) => dealFilter === "ALL" || d.status === dealFilter)
                          .map((d) => {
                            const totalOut = d.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
                            const workerParts = d.participants.map((p) => {
                              const label = p.user.name || p.user.email.split("@")[0];
                              return `${label} ${p.pct}%`;
                            }).join(" · ");
                            return (
                              <tr key={d.id} style={{ cursor: "pointer" }}>
                                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} onClick={() => openDealEditModal(d)}>
                                  {d.dealDate ? new Date(d.dealDate).toLocaleDateString("ru-RU") : "—"}
                                </td>
                                <td onClick={() => openDealEditModal(d)}>{d.client ? d.client.name : <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Без клиента</span>}</td>
                                <td style={{ fontSize: 12, color: "var(--text-secondary)" }} onClick={() => openDealEditModal(d)}>{workerParts || "—"}</td>
                                <td onClick={() => openDealEditModal(d)}>
                                  <span className={`badge ${d.status === "CLOSED" ? "badge-green" : d.status === "IN_PROGRESS" ? "badge-amber" : "badge-blue"}`}>
                                    {d.status === "NEW" ? "Новая" : d.status === "IN_PROGRESS" ? "В работе" : "Закрыта"}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }} onClick={() => openDealEditModal(d)}>
                                  {totalOut.toLocaleString()}
                                </td>
                                {isAdmin && (
                                  <td style={{ width: 40, padding: "0 8px 0 0" }}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteDeal(d.id); }}
                                      className="btn btn-ghost"
                                      style={{ width: 28, height: 28, padding: 0, color: "var(--text-tertiary)" }}
                                      title="Удалить сделку"
                                    >
                                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>
                                    </button>
                                  </td>
                                )}
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
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="card-title">{dealEditingId ? "Редактировать сделку" : "Новая сделка"}</span>
                        {dealTemplateStep === "form" && dealTemplateId && (
                          <span style={{ fontSize: 11, background: "var(--accent-light)", color: "var(--accent)", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                            {templates.find(t => t.id === dealTemplateId)?.name}
                          </span>
                        )}
                      </div>
                      <button className="btn btn-secondary" onClick={closeDealModal}>Отмена</button>
                    </div>

                    {/* Template picker step */}
                    {!dealEditingId && dealTemplateStep === "pick" ? (
                      <div className="card-body" style={{ display: "grid", gap: 14 }}>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Выберите шаблон сделки:</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {templates.map((t) => (
                            <label key={t.id} style={{
                              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                              border: `2px solid ${dealTemplateId === t.id ? "var(--accent)" : "var(--border)"}`,
                              borderRadius: "var(--radius)", cursor: "pointer",
                              background: dealTemplateId === t.id ? "var(--accent-light)" : "var(--bg-card)",
                            }}>
                              <input type="radio" name="tpl" value={t.id} checked={dealTemplateId === t.id}
                                onChange={() => setDealTemplateId(t.id)} style={{ accentColor: "var(--accent)" }} />
                              <div>
                                <div style={{ fontWeight: 600 }}>{t.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                                  {t.fields.length} полей · {t.hasWorkers ? "с воркерами" : "без воркеров"}
                                </div>
                              </div>
                            </label>
                          ))}
                          <label style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                            border: `2px solid ${dealTemplateId === null ? "var(--accent)" : "var(--border)"}`,
                            borderRadius: "var(--radius)", cursor: "pointer",
                            background: dealTemplateId === null ? "var(--accent-light)" : "var(--bg-card)",
                          }}>
                            <input type="radio" name="tpl" value="" checked={dealTemplateId === null}
                              onChange={() => setDealTemplateId(null)} style={{ accentColor: "var(--accent)" }} />
                            <div>
                              <div style={{ fontWeight: 600 }}>Классическая форма</div>
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Банк, суммы, тип операции</div>
                            </div>
                          </label>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button className="btn btn-primary" onClick={() => setDealTemplateStep("form")}>
                            Продолжить →
                          </button>
                        </div>
                      </div>
                    ) : (

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

                      {/* Template-based fields OR classic amounts */}
                      {dealTemplateId && templates.find(t => t.id === dealTemplateId) ? (() => {
                        const tpl = templates.find(t => t.id === dealTemplateId)!;
                        const FIELD_TYPE_LABELS: Record<FieldType, string> = { TEXT: "Текст", NUMBER: "Число", SELECT: "Список", DATE: "Дата", PERCENT: "Процент", CHECKBOX: "Флаг" };
                        return (
                          <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                              <div className="form-label" style={{ margin: 0 }}>Данные [{tpl.name}]</div>
                              <button className="btn btn-secondary" onClick={() => setDealDataRows(p => [...p, { _id: crypto.randomUUID(), data: {} }])}>+ Добавить строку</button>
                            </div>
                            {dealDataRows.map((row, ri) => (
                              <div key={row._id} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Строка {ri + 1}</span>
                                  {dealDataRows.length > 1 && (
                                    <span style={{ cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }} onClick={() => setDealDataRows(p => p.filter(x => x._id !== row._id))}>×</span>
                                  )}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                                  {tpl.fields.map((f) => (
                                    <div key={f.key}>
                                      <div className="form-label" style={{ marginBottom: 3 }}>{f.label}{f.required ? " *" : ""}</div>
                                      {f.type === "SELECT" ? (
                                        <select className="form-input" value={row.data[f.key] ?? ""}
                                          onChange={(e) => setDealDataRows(p => p.map(x => x._id === row._id ? { ...x, data: { ...x.data, [f.key]: e.target.value } } : x))}>
                                          <option value="">— выберите —</option>
                                          {(f.options ?? "").split(",").map(o => o.trim()).filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      ) : f.type === "CHECKBOX" ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38 }}>
                                          <input type="checkbox" checked={row.data[f.key] === "true"}
                                            onChange={(e) => setDealDataRows(p => p.map(x => x._id === row._id ? { ...x, data: { ...x.data, [f.key]: e.target.checked ? "true" : "false" } } : x))}
                                            style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                                          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{f.label}</span>
                                        </div>
                                      ) : (
                                        <input
                                          className="form-input"
                                          type={f.type === "NUMBER" || f.type === "PERCENT" ? "number" : f.type === "DATE" ? "date" : "text"}
                                          min={f.type === "PERCENT" ? 0 : undefined}
                                          max={f.type === "PERCENT" ? 100 : undefined}
                                          value={row.data[f.key] ?? ""}
                                          onChange={(e) => setDealDataRows(p => p.map(x => x._id === row._id ? { ...x, data: { ...x.data, [f.key]: e.target.value } } : x))}
                                          style={{ fontFamily: f.type === "NUMBER" || f.type === "PERCENT" ? "'JetBrains Mono', monospace" : undefined }}
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })() : (
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
                      )}

                      {/* Participants */}
                      {(() => {
                        // Determine income base for payout preview
                        const activeTplForParts = dealTemplateId ? templates.find(t => t.id === dealTemplateId) : null;
                        let incomeBase = dealTotals.tAmountOut; // classic deal
                        let incomeLabel = "";
                        if (activeTplForParts?.incomeFieldKey) {
                          incomeBase = dealDataRows.reduce((s, row) => {
                            const val = row.data[activeTplForParts.incomeFieldKey!];
                            return s + (Number(val) || 0);
                          }, 0);
                          const incField = activeTplForParts.fields.find(f =>
                            (f.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_а-яё]/gi, "") || f.id) === activeTplForParts.incomeFieldKey
                          );
                          incomeLabel = incField ? incField.label : activeTplForParts.incomeFieldKey;
                        }
                        return (
                          <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                              <div>
                                <div className="form-label" style={{ margin: 0 }}>Участники (воркеры)</div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                                  {incomeBase > 0
                                    ? <span>База выплат: <strong style={{ color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace" }}>{incomeBase.toLocaleString()}</strong>{incomeLabel ? ` (${incomeLabel})` : ""}</span>
                                    : "Выплата = % × сумма сделки"}
                                </div>
                              </div>
                              <button className="btn btn-secondary" onClick={() => setDealParticipants((p) => [...p, { id: crypto.randomUUID(), userId: "", pct: "0" }])}>
                                + Добавить
                              </button>
                            </div>
                            <div style={{ display: "grid", gap: 6 }}>
                              {dealParticipants.map((p) => {
                                const pct = Number(p.pct) || 0;
                                const earn = Math.round(incomeBase * pct / 100 * 100) / 100;
                                const worker = dealWorkers.find(w => w.id === p.userId);
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
                                          {w.name || w.email}{w.position ? ` · ${w.position}` : ""}{w.organization ? ` [${w.organization.name}]` : ""}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      className="form-input"
                                      value={p.pct}
                                      onChange={(e) => setDealParticipants((pp) => pp.map((x) => x.id === p.id ? { ...x, pct: e.target.value } : x))}
                                      style={{ width: 70, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}
                                      placeholder="0"
                                    />
                                    <span style={{ color: "var(--text-secondary)" }}>%</span>
                                    <div style={{ minWidth: 110, textAlign: "right" }}>
                                      {incomeBase > 0 ? (
                                        <>
                                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--green)", fontSize: 14 }}>{earn.toLocaleString()}</div>
                                          {worker?.name && <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{worker.name}</div>}
                                        </>
                                      ) : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                                    </div>
                                    <span style={{ cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16, padding: "4px 8px" }} onClick={() => setDealParticipants((pp) => pp.filter((x) => x.id !== p.id))}>×</span>
                                  </div>
                                );
                              })}
                            </div>
                            {dealParticipants.length > 1 && incomeBase > 0 && (
                              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                  Итого %: <strong style={{ color: dealParticipants.reduce((s, p) => s + (Number(p.pct) || 0), 0) === 100 ? "var(--green)" : "var(--amber)" }}>
                                    {dealParticipants.reduce((s, p) => s + (Number(p.pct) || 0), 0)}%
                                  </strong>
                                </div>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                                  Распределено: {dealParticipants.reduce((s, p) => s + Math.round(incomeBase * (Number(p.pct) || 0) / 100 * 100) / 100, 0).toLocaleString()}
                                </div>
                              </div>
                            )}
                            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: pctStatus.color }}>{pctStatus.text}</div>
                          </div>
                        );
                      })()}

                      {/* Comment */}
                      <div>
                        <div className="form-label">Комментарий</div>
                        <textarea className="form-input" value={dealComment} onChange={(e) => setDealComment(e.target.value)} style={{ height: 72, paddingTop: 10 }} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        {!dealEditingId && templates.length > 0 && (
                          <button className="btn btn-secondary" onClick={() => setDealTemplateStep("pick")}>← Шаблон</button>
                        )}
                        <button className="btn btn-secondary" onClick={closeDealModal}>Отмена</button>
                        <button className="btn btn-primary" onClick={saveDeal}>
                          {dealEditingId ? "Сохранить" : "Создать сделку"}
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ===== CLIENTS ===== */}
          {tab === "clients" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="page-header">
                <div className="page-header-left">
                  <div className="page-header-title">Клиенты</div>
                  <div className="page-header-sub">База клиентов вашего офиса</div>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Добавить клиента</span>
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
                        <tr><td colSpan={3} style={{ padding: 24, color: "var(--text-secondary)" }}>Загрузка...</td></tr>
                      ) : clients.length === 0 ? (
                        <tr><td colSpan={3}>
                          <div className="empty-state">
                            <div className="empty-state-icon">
                              <svg width="22" height="22" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            </div>
                            <div className="empty-state-title">Нет клиентов</div>
                            <div className="empty-state-desc">Добавьте первого клиента используя форму выше</div>
                          </div>
                        </td></tr>
                      ) : (
                        clients.map((c) => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 500 }}>{c.name}</td>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--text-secondary)" }}>{c.phone}</td>
                            <td style={{ padding: "8px 16px 8px 8px" }}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button className="btn btn-secondary" style={{ height: 28, padding: "0 10px", fontSize: 12 }} onClick={() => openClientEdit(c)}>Изменить</button>
                                <button className="btn btn-ghost" style={{ height: 28, padding: "0 8px", fontSize: 12, color: "var(--red-text)" }} onClick={() => deleteClient(c.id)}>Удалить</button>
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
              <div className="page-header">
                <div className="page-header-left">
                  <div className="page-header-title">Расходы</div>
                  <div className="page-header-sub">Учёт расходов офиса: аренда, крипта, материалы</div>
                </div>
              </div>
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
                        <tr><td colSpan={3} style={{ padding: 24, color: "var(--text-secondary)" }}>Загрузка...</td></tr>
                      ) : expenses.length === 0 ? (
                        <tr><td colSpan={3}>
                          <div className="empty-state">
                            <div className="empty-state-icon">
                              <svg width="22" height="22" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                            </div>
                            <div className="empty-state-title">Нет расходов</div>
                            <div className="empty-state-desc">Добавьте первый расход используя форму выше</div>
                          </div>
                        </td></tr>
                      ) : (
                        expenses.map((e) => (
                          <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => { setExpenseEditing(e); setExpenseModalOpen(true); }}>
                            <td style={{ fontWeight: 500 }}>{e.title}</td>
                            <td>
                              <span className={`badge ${e.status === "APPROVED" ? "badge-green" : e.status === "SUBMITTED" ? "badge-blue" : e.status === "REJECTED" ? "badge-red" : "badge-amber"}`}>
                                {e.status === "APPROVED" ? "Одобрен" : e.status === "SUBMITTED" ? "На проверке" : e.status === "REJECTED" ? "Отклонён" : "Черновик"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{Number(e.amount).toLocaleString()} {e.currency}</td>
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
                        {isAdmin && expenseEditing.status === "SUBMITTED" ? (
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
              {/* ===== AI ANALYTICS CHAT ===== */}
              <div className="card" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>🤖</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>AI Аналитик</div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {aiConfigured === false
                        ? "Не настроен — добавьте OPENAI_API_KEY на сервере"
                        : "Задайте вопрос по сделкам, воркерам, статистике"}
                    </div>
                  </div>
                  {aiChatHistory.length > 0 && (
                    <button className="btn btn-secondary" style={{ marginLeft: "auto", fontSize: 12 }}
                      onClick={() => setAiChatHistory([])}>Очистить</button>
                  )}
                </div>

                {aiChatHistory.length === 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, marginBottom: 12 }}>
                    {[
                      "Кто топ воркер этого месяца?",
                      "Какой общий доход?",
                      "Проанализируй последние сделки",
                      "Сравни воркеров по выплатам",
                    ].map(q => (
                      <button key={q} className="btn btn-secondary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={() => sendAiMessage(q)}
                        disabled={aiChatLoading || aiConfigured === false}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {aiChatHistory.length > 0 && (
                  <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginTop: 14, marginBottom: 14, paddingRight: 4 }}>
                    {aiChatHistory.map((m, i) => (
                      <div key={i} style={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "80%",
                        padding: "10px 14px",
                        borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: m.role === "user" ? "var(--accent)" : "var(--bg-metric)",
                        color: m.role === "user" ? "#fff" : "var(--text-primary)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                      }}>
                        {m.content}
                      </div>
                    ))}
                    {aiChatLoading && (
                      <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "var(--bg-metric)", fontSize: 13, color: "var(--text-tertiary)" }}>
                        ⏳ Анализирую...
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    className="form-input"
                    value={aiChatInput}
                    onChange={e => setAiChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
                    placeholder={aiConfigured === false ? "AI не настроен..." : "Напишите вопрос..."}
                    disabled={aiChatLoading || aiConfigured === false}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary"
                    onClick={() => sendAiMessage()}
                    disabled={aiChatLoading || !aiChatInput.trim() || aiConfigured === false}
                    style={{ padding: "0 20px" }}>
                    {aiChatLoading ? "..." : "→"}
                  </button>
                </div>
              </div>

            </div>
          ) : null}

          {tab === "tasks" ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="page-header">
                <div className="page-header-left">
                  <div className="page-header-title">Задачи</div>
                  <div className="page-header-sub">Назначайте сроки, отслеживайте статусы. Исполнители получают письмо о новой задаче.</div>
                </div>
                {isManager && (
                  <div className="page-header-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => { setTaskModalOpen(true); void loadTaskUserOptions(); }}
                    >+ Новая задача</button>
                  </div>
                )}
              </div>
              <div className="filter-tabs" style={{ width: "fit-content" }}>
                {([
                  { id: "active" as const, label: "Активные" },
                  { id: "all" as const, label: "Все" },
                  { id: "done" as const, label: "Архив" },
                ]).map((f) => (
                  <button key={f.id} type="button" className={`filter-tab ${taskFilter === f.id ? "active" : ""}`} onClick={() => setTaskFilter(f.id)}>{f.label}</button>
                ))}
              </div>
              {tasksLoading ? (
                <div style={{ color: "var(--text-secondary)" }}>Загрузка…</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {tasks
                    .filter((t) => {
                      if (taskFilter === "active") return t.status === "PENDING" || t.status === "IN_PROGRESS";
                      if (taskFilter === "done") return t.status === "DONE" || t.status === "CANCELLED";
                      return true;
                    })
                    .map((t) => {
                      const isMine = user?.id === t.assignee.id;
                      const due = t.dueAt ? new Date(t.dueAt) : null;
                      const overdue = !!(due && due < new Date() && t.status !== "DONE" && t.status !== "CANCELLED");
                      const stLabel: Record<TaskStatus, string> = {
                        PENDING: "К выполнению", IN_PROGRESS: "В работе", DONE: "Выполнено", CANCELLED: "Отменена",
                      };
                      return (
                        <div
                          key={t.id}
                          className={`task-card${isMine && t.status !== "DONE" && t.status !== "CANCELLED" ? " task-card--mine" : ""}${overdue ? " task-card--due" : ""}${t.status === "DONE" ? " task-card--done" : ""}`}
                          style={{ cursor: "pointer" }}
                          onClick={() => void openTaskDetail(t)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <h3 style={{ margin: 0, flex: 1 }}>{t.title}</h3>
                            <span className={`badge ${t.status === "DONE" ? "badge-green" : t.status === "IN_PROGRESS" ? "badge-blue" : t.status === "CANCELLED" ? "badge-gray" : "badge-amber"}`}>
                              {stLabel[t.status]}
                            </span>
                          </div>
                          {t.description && <div className="task-card-desc">{t.description}</div>}
                          <div className="task-card-meta">
                            <span>👤 {t.assignee.name || t.assignee.email}</span>
                            <span>·</span>
                            <span>от {t.createdBy.name || t.createdBy.email}</span>
                            {t.dueAt && (
                              <>
                                <span>·</span>
                                <span className="mono" style={overdue ? { color: "var(--amber)" } : {}}>до {new Date(t.dueAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              </>
                            )}
                          </div>
                          <div className="task-card-actions" onClick={e => e.stopPropagation()}>
                            {isMine && t.status !== "DONE" && t.status !== "CANCELLED" && (
                              <>
                                {t.status === "PENDING" && (
                                  <button className="btn btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => void patchTask(t.id, { status: "IN_PROGRESS" })}>Взять в работу</button>
                                )}
                                <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} onClick={() => void patchTask(t.id, { status: "DONE" })}>Выполнено</button>
                              </>
                            )}
                            {isManager && (
                              <button className="btn btn-ghost" style={{ height: 30, fontSize: 12, color: "var(--red-text)" }} onClick={() => void deleteTaskById(t.id)}>Удалить</button>
                            )}
                            <button className="btn btn-ghost" style={{ height: 30, fontSize: 12, marginLeft: "auto" }}>Открыть →</button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {!tasksLoading && tasks.filter((t) => taskFilter === "active" ? t.status === "PENDING" || t.status === "IN_PROGRESS" : taskFilter === "done" ? t.status === "DONE" || t.status === "CANCELLED" : true).length === 0 && (
                <div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-state-icon">
                    <svg width="24" height="24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  </div>
                  <div className="empty-state-title">Нет задач</div>
                  <div className="empty-state-desc">{isManager ? "Создайте задачу для сотрудника — он получит письмо" : "Вам пока ничего не назначили"}</div>
                </div>
              )}
              {taskModalOpen && isManager && (
                <div
                  className="modal-backdrop"
                  style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60, backdropFilter: "blur(2px)" }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) setTaskModalOpen(false); }}
                >
                  <div className="card" style={{ width: 480, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="card-title">Новая задача</span>
                      <button className="btn btn-secondary" onClick={() => setTaskModalOpen(false)}>×</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 14 }}>
                      <div>
                        <div className="form-label">Название *</div>
                        <input className="form-input" value={taskFormTitle} onChange={(e) => setTaskFormTitle(e.target.value)} placeholder="Кратко, что сделать" />
                      </div>
                      <div>
                        <div className="form-label">Описание</div>
                        <textarea className="form-input" value={taskFormDesc} onChange={(e) => setTaskFormDesc(e.target.value)} rows={3} placeholder="Детали" />
                      </div>
                      <div>
                        <div className="form-label">Исполнитель *</div>
                        <select className="form-input" value={taskFormAssigneeId} onChange={(e) => setTaskFormAssigneeId(e.target.value)}>
                          <option value="">Выберите</option>
                          {taskUsersForSelect.map((u) => (
                            <option key={u.id} value={u.id}>{u.name || u.email} ({u.email})</option>
                          ))}
                        </select>
                      </div>
                      <div className="g2">
                        <div>
                          <div className="form-label">Начало</div>
                          <input className="form-input" type="datetime-local" value={taskFormStart} onChange={(e) => setTaskFormStart(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">Срок</div>
                          <input className="form-input" type="datetime-local" value={taskFormDue} onChange={(e) => setTaskFormDue(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => setTaskModalOpen(false)}>Отмена</button>
                        <button className="btn btn-primary" onClick={() => void createTaskFromModal()} disabled={!taskFormTitle.trim() || !taskFormAssigneeId}>Создать</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* ===== CHAT (DM) ===== */}
          {tab === "chat" ? (
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
                              {conv.lastMessage.sender.id === user?.id ? "Вы: " : ""}{conv.lastMessage.body}
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
                      <button className="chat-back-btn" onClick={() => setChatActiveUser(null)}>
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
                        const isMe = m.sender.id === user?.id;
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
          ) : null}

          {/* ===== AI ASSISTANT ===== */}
          {tab === "assistant" ? (
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
                    Создавайте сделки и расходы голосом или текстом — на любом языке
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
                      <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20 }}>Надиктуйте или напишите — я создам сделку, подсчитаю статистику или отвечу на вопрос</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600 }}>
                      {[
                        "Запиши сделку: вчера Ди и олх взяли 6838 от eurocom 75/25, закрыл Ант",
                        "Сколько заработал каждый воркер за этот месяц?",
                        "Запиши расход: аренда офиса 500$",
                        "Покажи статистику за неделю",
                        "Какой доход за апрель?",
                      ].map(q => (
                        <button key={q} className="btn btn-secondary" style={{ fontSize: 12, padding: "8px 14px", textAlign: "left", lineHeight: 1.4 }}
                          onClick={() => sendAgentMessage(q)} disabled={agentLoading}>
                          {q}
                        </button>
                      ))}
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
                  Можно вставить несколько строк из таблицы — AI создаст все сделки сразу
                </div>
              </div>

            </div>
          ) : null}

          {/* ===== STAFF ===== */}
          {tab === "staff" ? (
            <div style={{ display: "grid", gap: 16 }}>
              {!staffMember && (
                <div className="page-header">
                  <div className="page-header-left">
                    <div className="page-header-title">Сотрудники</div>
                    <div className="page-header-sub">Управляйте командой, офисами и статистикой сотрудников</div>
                  </div>
                </div>
              )}
              {staffLoading ? (
                <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
              ) : staffMember ? (
                // ---- Member detail view ----
                <div>
                  <button className="btn btn-secondary" style={{ marginBottom: 20 }}
                    onClick={() => setStaffMember(null)}>← Назад к списку</button>
                  {staffMemberLoading ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
                  ) : (
                    <div style={{ display: "grid", gap: 16, maxWidth: 760 }}>
                      {/* profile card */}
                      <div className="card" style={{ padding: "24px 28px" }}>
                        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{
                            width: 72, height: 72, borderRadius: "50%",
                            background: "var(--accent)", display: "flex", alignItems: "center",
                            justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700, flexShrink: 0
                          }}>
                            {(staffMember.name || staffMember.email)?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                              {staffMember.name || staffMember.email}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
                              {staffMember.email}
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                              {staffMember.position && (
                                <span style={{ padding: "3px 10px", borderRadius: 20, background: "var(--bg-hover)", fontSize: 12, color: "var(--text-secondary)" }}>
                                  {staffMember.position}
                                </span>
                              )}
                              <span style={{ padding: "3px 10px", borderRadius: 20, background: "var(--accent)22", fontSize: 12, color: "var(--accent)" }}>
                                {({ SUPER_ADMIN: "Супер Админ", ADMIN: "Админ", MANAGER: "Менеджер", WORKER: "Работник" } as Record<string,string>)[staffMember.role] ?? staffMember.role}
                              </span>
                              {staffMember.organization && (
                                <span style={{ padding: "3px 10px", borderRadius: 20, background: "var(--bg-hover)", fontSize: 12, color: "var(--text-secondary)" }}>
                                  {staffMember.organization.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* contacts */}
                        {(staffMember.phone || staffMember.telegram || staffMember.contacts) && (
                          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-color)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                            {staffMember.phone && (
                              <div><div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Телефон</div>
                                <div style={{ fontSize: 13 }}>{staffMember.phone}</div></div>
                            )}
                            {staffMember.telegram && (
                              <div><div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Telegram</div>
                                <div style={{ fontSize: 13 }}>{staffMember.telegram}</div></div>
                            )}
                            {staffMember.contacts && (
                              <div><div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Контакты</div>
                                <div style={{ fontSize: 13 }}>{staffMember.contacts}</div></div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* extra orgs (memberships) */}
                      {isAdmin && (
                        <div className="card" style={{ padding: "16px 20px" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Офисы сотрудника</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            {/* Primary org */}
                            <span style={{ padding: "4px 12px", borderRadius: 20, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600 }}>
                              {staffMember.organization?.name ?? "—"} (основной)
                            </span>
                            {/* Extra orgs */}
                            {(staffMember.extraMemberships ?? []).map((m: any) => (
                              <span key={m.id} style={{ padding: "4px 12px", borderRadius: 20, background: "var(--bg-hover)", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                {m.organization.name}
                                {isAdmin && (
                                  <span style={{ cursor: "pointer", color: "var(--text-tertiary)", fontWeight: 700 }}
                                    onClick={() => removeMembership(staffMember.id, m.organizationId)}>×</span>
                                )}
                              </span>
                            ))}
                            {/* Add to org dropdown */}
                            {isAdmin && (() => {
                              const existingOrgIds = new Set([
                                staffMember.organizationId,
                                ...(staffMember.extraMemberships ?? []).map((m: any) => m.organizationId),
                              ]);
                              const available = orgs.filter(o => !existingOrgIds.has(o.id));
                              return available.length > 0 ? (
                                <select className="form-input" style={{ width: "auto", fontSize: 12, height: 30, padding: "0 8px" }}
                                  value="" onChange={e => { if (e.target.value) addMembership(staffMember.id, e.target.value); }}>
                                  <option value="">+ Добавить в офис</option>
                                  {available.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                              ) : null;
                            })()}
                          </div>
                          {(staffMember.extraMemberships ?? []).length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                              Сотрудник участвует в сделках и получает выплаты в {1 + (staffMember.extraMemberships?.length ?? 0)} офисах
                            </div>
                          )}
                        </div>
                      )}

                      {/* stats */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                        {[
                          { label: "Сделок", value: staffMember.dealsCount },
                          { label: "Выплаты", value: `$${staffMember.totalPayout}` },
                          { label: "Зарплата", value: "—", badge: "скоро" },
                          { label: "Задачи", value: "—", badge: "скоро" },
                        ].map((s) => (
                          <div key={s.label} className="card" style={{ padding: "16px 18px" }}>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{s.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{s.value}</div>
                            {s.badge && <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 4 }}>{s.badge}</div>}
                          </div>
                        ))}
                      </div>

                      {/* recent deals */}
                      {staffMember.recentDeals?.length > 0 && (
                        <div className="card" style={{ padding: "20px 24px" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Последние сделки</div>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                                  {["Название", "Дата", "Статус", "Ставка %", "Выплата"].map(h => (
                                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 500, fontSize: 11 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {staffMember.recentDeals.map((d: any) => (
                                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                    <td style={{ padding: "8px 8px" }}>{d.title || d.templateName || "—"}</td>
                                    <td style={{ padding: "8px 8px", color: "var(--text-tertiary)" }}>{d.dealDate ? new Date(d.dealDate).toLocaleDateString("ru-RU") : "—"}</td>
                                    <td style={{ padding: "8px 8px" }}>
                                      <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: d.status === "DONE" ? "#22c55e22" : d.status === "CANCELLED" ? "#ef444422" : "#f59e0b22", color: d.status === "DONE" ? "#22c55e" : d.status === "CANCELLED" ? "#ef4444" : "#f59e0b" }}>
                                        {d.status === "DONE" ? "Закрыта" : d.status === "CANCELLED" ? "Отменена" : "В работе"}
                                      </span>
                                    </td>
                                    <td style={{ padding: "8px 8px", color: "var(--text-tertiary)" }}>{d.pct}%</td>
                                    <td style={{ padding: "8px 8px", fontWeight: 600, color: "var(--accent)" }}>${d.payout}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : isSuperAdmin ? (
                // ---- SUPER_ADMIN grouped view ----
                <div style={{ display: "grid", gap: 24 }}>
                  {(!staffData || staffData.length === 0) ? (
                    <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Нет данных</div>
                  ) : staffData.map((group: any) => (
                    <div key={group.org.id} className="card" style={{ padding: "20px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>
                          {group.org.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{group.org.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{group.members.length} сотр.</div>
                        </div>
                      </div>
                      <StaffTable members={group.members} onSelect={(id: string) => loadStaffMember(id)} />
                    </div>
                  ))}
                </div>
              ) : (
                // ---- ADMIN single office view ----
                <div className="card" style={{ padding: "20px 24px" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Сотрудники офиса</div>
                  {(!staffData || staffData.length === 0) ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Нет сотрудников</div>
                  ) : (
                    <StaffTable members={staffData} onSelect={(id: string) => loadStaffMember(id)} />
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* ===== SETTINGS ===== */}
          {tab === "settings" ? (
            <div style={{ display: "grid", gap: 16 }}>

              {/* Organisations block (SUPER_ADMIN only) */}
              {isSuperAdmin ? (
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

              {/* Deal Templates */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Шаблоны сделок</span>
                  <button className="btn btn-primary" onClick={() => openTemplateModal()}>+ Новый шаблон</button>
                </div>
                <div className="card-body" style={{ display: "grid", gap: 10 }}>
                  {templates.length === 0 ? (
                    <div style={{ color: "var(--text-secondary)", fontSize: 13, padding: "8px 0" }}>
                      Нет шаблонов. Создайте свой первый шаблон чтобы использовать кастомные поля в сделках.
                    </div>
                  ) : (
                    <div className="card" style={{ border: "1px solid var(--border-light)" }}>
                      <div className="table-scroll" style={{ padding: 0 }}>
                        <table className="data-table">
                          <thead><tr><th>Название</th><th>Полей</th><th>Воркеры</th><th style={{ width: 160 }}></th></tr></thead>
                          <tbody>
                            {templates.map((t) => (
                              <tr key={t.id}>
                                <td style={{ fontWeight: 600 }}>{t.name}</td>
                                <td style={{ color: "var(--text-secondary)" }}>{t.fields.length}</td>
                                <td>{t.hasWorkers ? <span className="badge badge-green">Да</span> : <span className="badge badge-amber">Нет</span>}</td>
                                <td>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openTemplateModal(t)}>Редактировать</button>
                                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => deleteTemplate(t.id, t.name)}>Удалить</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Пользователи</span>
                  <button className="btn btn-secondary" onClick={loadUsers}>Обновить</button>
                </div>
                <div className="card-body" style={{ display: "grid", gap: 16 }}>
                  {!isAdmin ? (
                    <div style={{ color: "var(--text-secondary)" }}>Доступно только для Админа и Супер Админа.</div>
                  ) : (
                    <>
                      {/* create form */}
                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                        <div>
                          <div className="form-label">Логин (email)</div>
                          <input className="form-input" value={newUserLogin} onChange={(e) => setNewUserLogin(e.target.value)} placeholder="email или username" />
                        </div>
                        <div>
                          <div className="form-label">Имя (отображается в CRM)</div>
                          <input className="form-input" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Иван Петров" />
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
                              <option value="WORKER">Работник</option>
                              <option value="MANAGER">Менеджер</option>
                              <option value="ADMIN">Админ офиса</option>
                              {isSuperAdmin && <option value="SUPER_ADMIN">Супер Админ</option>}
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
                                <th>Имя</th>
                                <th>Должность</th>
                                <th>Офис</th>
                                <th>Доступ</th>
                                <th style={{ width: 260 }}>Действия</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usersLoading ? (
                                <tr><td colSpan={6} style={{ padding: 16 }}>Загрузка...</td></tr>
                              ) : users.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: 16 }}>Пока пусто</td></tr>
                              ) : (
                                users.map((u) => (
                                  <tr key={u.id}>
                                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{u.email}</td>
                                    <td style={{ fontWeight: 600 }}>{u.name || <span style={{ color: "var(--text-tertiary)", fontStyle: "italic", fontWeight: 400 }}>не задано</span>}</td>
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
                                        <option value="WORKER">Работник</option>
                                        <option value="MANAGER">Менеджер</option>
                                        <option value="ADMIN">Админ офиса</option>
                                        {isSuperAdmin && <option value="SUPER_ADMIN">Супер Админ</option>}
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

          {/* ===== PROFILE ===== */}
          {tab === "profile" ? (
            <div style={{ display: "grid", gap: 16, maxWidth: 600 }}>

              {profileLoading ? (
                <div style={{ color: "var(--text-secondary)" }}>Загрузка...</div>
              ) : (
                <>
                  {/* Info card */}
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Личные данные</span>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 14 }}>

                      {/* Avatar placeholder */}
                      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 0 12px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: "50%",
                          background: "var(--accent-light)", border: "2px solid var(--accent)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 22, fontWeight: 700, color: "var(--accent)", flexShrink: 0,
                        }}>
                          {(profile?.name || profile?.email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{profile?.name || profile?.email}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                            {ROLE_LABELS[profile?.role as Role] ?? profile?.role} · {profile?.organization?.name}
                          </div>
                          {profile?.position && (
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{profile.position}</div>
                          )}
                        </div>
                      </div>

                      <div className="g2">
                        <div>
                          <div className="form-label">Имя</div>
                          <input className="form-input" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Иван Иванов" />
                        </div>
                        <div>
                          <div className="form-label">Email (логин)</div>
                          <input className="form-input" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} placeholder="email@example.com" />
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Контакты</div>
                        <div style={{ display: "grid", gap: 12 }}>
                          <div className="g2">
                            <div>
                              <div className="form-label">Телефон</div>
                              <input className="form-input" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+380 XX XXX XXXX" />
                            </div>
                            <div>
                              <div className="form-label">Telegram</div>
                              <input className="form-input" value={profileTelegram} onChange={(e) => setProfileTelegram(e.target.value)} placeholder="@username" />
                            </div>
                          </div>
                          <div>
                            <div className="form-label">Другие контакты</div>
                            <textarea className="form-input" value={profileContacts} onChange={(e) => setProfileContacts(e.target.value)}
                              placeholder="Viber, WhatsApp, другое..." style={{ height: 72 }} />
                          </div>
                        </div>
                      </div>

                      {profileError && (
                        <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13 }}>{profileError}</div>
                      )}
                      {profileSuccess && (
                        <div style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13 }}>{profileSuccess}</div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className="btn btn-primary" onClick={saveProfile} disabled={profileSaving}>
                          {profileSaving ? "Сохраняем..." : "Сохранить"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password change card */}
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Смена пароля</span>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 14 }}>
                      <div>
                        <div className="form-label">Текущий пароль</div>
                        <input className="form-input" type="password" value={pwdOld} onChange={(e) => setPwdOld(e.target.value)} autoComplete="current-password" />
                      </div>
                      <div className="g2">
                        <div>
                          <div className="form-label">Новый пароль</div>
                          <input className="form-input" type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} autoComplete="new-password" />
                        </div>
                        <div>
                          <div className="form-label">Повтор пароля</div>
                          <input className="form-input" type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} autoComplete="new-password" />
                        </div>
                      </div>

                      {pwdError && (
                        <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13 }}>{pwdError}</div>
                      )}
                      {pwdSuccess && (
                        <div style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13 }}>{pwdSuccess}</div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className="btn btn-primary" onClick={changePassword} disabled={pwdSaving}>
                          {pwdSaving ? "Меняем..." : "Изменить пароль"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

        </div>
      </div>

      {/* ===== TEMPLATE MODAL ===== */}
      {templateModalOpen ? (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setTemplateModalOpen(false); }}>
          <div className="card" style={{ width: 680, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <div className="card-header">
              <span className="card-title">{templateEditing ? "Редактировать шаблон" : "Новый шаблон сделки"}</span>
              <button className="btn btn-secondary" onClick={() => setTemplateModalOpen(false)}>Отмена</button>
            </div>
            <div className="card-body" style={{ display: "grid", gap: 18 }}>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setAiParseOpen(p => !p)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
                >
                  <span>🤖</span> {aiParseOpen ? "Скрыть AI" : "Создать шаблон с помощью AI"}
                </button>
              </div>

              {aiParseOpen && (
                <div style={{ border: "1px solid var(--accent)44", borderRadius: 12, padding: 16, background: "var(--accent)08" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--accent)" }}>🤖 AI-парсер шаблона</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                    Вставь 2–5 строк из твоей таблицы. AI определит колонки, типы полей и базу для расчёта выплат воркеров.
                  </div>
                  <textarea
                    className="form-input"
                    value={aiParseSample}
                    onChange={e => setAiParseSample(e.target.value)}
                    style={{ height: 100, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", paddingTop: 10 }}
                    placeholder={"21,04  Ди+олх(Н)  75/25  DP  eurocom  6838  lealnoshdf@gazeta.pl  )cvhLG8Nl8  Ант\n22.04  Ди+Вл+Бо  45/30/25  DP  eurocom  5809  kolakn@gazeta.pl  47qDV1)WS3  Раф"}
                  />
                  {aiParseError && <div style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}>{aiParseError}</div>}
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => { setAiParseOpen(false); setAiParseSample(""); setAiParseError(null); }}>Отмена</button>
                    <button className="btn btn-primary" onClick={aiParseTemplate} disabled={aiParsing || !aiParseSample.trim()}>
                      {aiParsing ? "Анализирую..." : "Анализировать →"}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="form-label">Название шаблона *</div>
                <input className="form-input" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Обменник, Крипто-схема, Партнёрка..." />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={tplHasWorkers} onChange={(e) => setTplHasWorkers(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Добавлять воркеров к сделкам по этому шаблону</span>
              </label>

              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div className="form-label" style={{ margin: 0 }}>Поля шаблона *</div>
                    {tplHasWorkers && (
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                        Отметьте 💰 у числового поля, от которого считаются % воркеров
                      </div>
                    )}
                  </div>
                  <button className="btn btn-secondary" onClick={addTplField}>+ Добавить поле</button>
                </div>

                {tplFields.length === 0 ? (
                  <div style={{ color: "var(--text-tertiary)", fontSize: 13, padding: "8px 0", textAlign: "center" }}>
                    Нажмите «+ Добавить поле» чтобы начать
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {tplFields.map((f, i) => {
                      const fieldKey = f.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_а-яё]/gi, "") || f._id;
                      const isIncomeField = tplIncomeFieldKey === fieldKey;
                      const canBeIncome = f.type === "NUMBER" || f.type === "PERCENT";
                      return (
                        <div key={f._id} style={{ background: isIncomeField ? "var(--accent)11" : "var(--bg-metric)", borderRadius: 8, padding: "10px 12px", border: isIncomeField ? "1px solid var(--accent)44" : "1px solid transparent" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 110px auto 28px", gap: 8, alignItems: "end" }}>
                            <div>
                              <div className="form-label" style={{ marginBottom: 3 }}>Название поля</div>
                              <input className="form-input" value={f.label} placeholder="Банк, Сумма, Тип..."
                                onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))} />
                            </div>
                            <div>
                              <div className="form-label" style={{ marginBottom: 3 }}>Тип</div>
                              <select className="form-input" value={f.type}
                                onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, type: e.target.value as FieldType } : x))}>
                                <option value="TEXT">Текст</option>
                                <option value="NUMBER">Число</option>
                                <option value="SELECT">Список</option>
                                <option value="DATE">Дата</option>
                                <option value="PERCENT">Процент</option>
                                <option value="CHECKBOX">Флаг</option>
                              </select>
                            </div>
                            <div>
                              <div className="form-label" style={{ marginBottom: 3 }}>&nbsp;</div>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, height: 38, cursor: "pointer" }}>
                                <input type="checkbox" checked={f.required}
                                  onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, required: e.target.checked } : x))}
                                  style={{ accentColor: "var(--accent)" }} />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>Обязательное</span>
                              </label>
                            </div>
                            {tplHasWorkers && canBeIncome ? (
                              <div>
                                <div className="form-label" style={{ marginBottom: 3 }}>&nbsp;</div>
                                <button
                                  title="База для расчёта выплат воркеров"
                                  style={{ height: 38, padding: "0 10px", borderRadius: 8, border: isIncomeField ? "2px solid var(--accent)" : "1px solid var(--border)", background: isIncomeField ? "var(--accent)" : "var(--bg-card)", cursor: "pointer", fontSize: 16, transition: "all 0.15s" }}
                                  onClick={() => setTplIncomeFieldKey(isIncomeField ? "" : fieldKey)}
                                >💰</button>
                              </div>
                            ) : <div />}
                            <div style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18 }}
                              onClick={() => { setTplFields(p => p.filter((_, xi) => xi !== i)); if (isIncomeField) setTplIncomeFieldKey(""); }}>×</div>
                          </div>
                          {isIncomeField && (
                            <div style={{ marginTop: 6, fontSize: 11, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}>
                              💰 База выплат — % воркеров считается от значения этого поля
                            </div>
                          )}
                          {f.type === "SELECT" && (
                            <div style={{ marginTop: 8 }}>
                              <div className="form-label" style={{ marginBottom: 3 }}>Варианты (через запятую)</div>
                              <input className="form-input" value={f.options} placeholder="Вариант 1, Вариант 2, Вариант 3"
                                onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, options: e.target.value } : x))} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {!tplHasWorkers && tplFields.some(f => f.type === "NUMBER" || f.type === "PERCENT") && (
                <div>
                  <div className="form-label">Поле для отчёта (доход)</div>
                  <select className="form-input" value={tplIncomeFieldKey} onChange={(e) => setTplIncomeFieldKey(e.target.value)}>
                    <option value="">— не используется —</option>
                    {tplFields.filter(f => f.type === "NUMBER" || f.type === "PERCENT").map(f => (
                      <option key={f._id} value={f.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_а-яё]/gi, "") || f._id}>{f.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>Поле-доход для Dashboard и Отчётов</div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setTemplateModalOpen(false)}>Отмена</button>
                <button className="btn btn-primary" onClick={saveTemplate}>
                  {templateEditing ? "Сохранить" : "Создать шаблон"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== TASK DETAIL DRAWER ===== */}
      {taskDetail && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 70, backdropFilter: "blur(2px)" }}
            onClick={() => setTaskDetail(null)}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "min(500px, 100vw)", zIndex: 71,
            background: "var(--bg-card)", boxShadow: "-8px 0 40px rgba(0,0,0,0.2)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {taskEditMode ? (
                  <input
                    className="form-input"
                    value={taskEditTitle}
                    onChange={e => setTaskEditTitle(e.target.value)}
                    style={{ fontWeight: 700, fontSize: 16 }}
                    autoFocus
                  />
                ) : (
                  <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{taskDetail.title}</div>
                )}
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>
                  от {taskDetail.createdBy.name || taskDetail.createdBy.email} · {new Date(taskDetail.createdAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
              {isManager && !taskEditMode && (
                <button className="btn btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => {
                  setTaskEditMode(true);
                  setTaskEditTitle(taskDetail.title);
                  setTaskEditDesc(taskDetail.description ?? "");
                  setTaskEditDue(taskDetail.dueAt ? taskDetail.dueAt.slice(0, 16) : "");
                  setTaskEditStart(taskDetail.startsAt ? taskDetail.startsAt.slice(0, 16) : "");
                  setTaskEditAssigneeId(taskDetail.assignee.id);
                  void loadTaskUserOptions();
                }}>Редактировать</button>
              )}
              {taskEditMode && (
                <>
                  <button className="btn btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => void saveTaskEdit()}>Сохранить</button>
                  <button className="btn btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => setTaskEditMode(false)}>Отмена</button>
                </>
              )}
              <button className="btn btn-ghost" style={{ height: 32, width: 32, padding: 0, fontSize: 18, flexShrink: 0 }} onClick={() => setTaskDetail(null)}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Status + badge */}
              {!taskEditMode && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {(() => {
                    const stLabel: Record<TaskStatus, string> = { PENDING: "К выполнению", IN_PROGRESS: "В работе", DONE: "Выполнено", CANCELLED: "Отменена" };
                    const stClass: Record<TaskStatus, string> = { PENDING: "badge-amber", IN_PROGRESS: "badge-blue", DONE: "badge-green", CANCELLED: "badge-gray" };
                    return <span className={`badge ${stClass[taskDetail.status]}`}>{stLabel[taskDetail.status]}</span>;
                  })()}
                  {taskDetail.dueAt && (
                    <span style={{ fontSize: 12, color: new Date(taskDetail.dueAt) < new Date() && taskDetail.status !== "DONE" ? "var(--amber)" : "var(--text-tertiary)" }}>
                      Срок: {new Date(taskDetail.dueAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {/* Quick status actions for assignee */}
                  {user?.id === taskDetail.assignee.id && taskDetail.status !== "DONE" && taskDetail.status !== "CANCELLED" && (
                    <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                      {taskDetail.status === "PENDING" && (
                        <button className="btn btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={() => void patchTask(taskDetail.id, { status: "IN_PROGRESS" }).then(() => setTaskDetail(prev => prev ? { ...prev, status: "IN_PROGRESS" } : null))}>Взять в работу</button>
                      )}
                      <button className="btn btn-primary" style={{ height: 28, fontSize: 11 }} onClick={() => void patchTask(taskDetail.id, { status: "DONE" }).then(() => { setTaskDetail(prev => prev ? { ...prev, status: "DONE" } : null); void loadTaskPendingCount(); })}>Выполнено ✓</button>
                    </div>
                  )}
                </div>
              )}

              {/* Edit form */}
              {taskEditMode && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div className="form-label">Описание</div>
                    <textarea className="form-input" rows={3} value={taskEditDesc} onChange={e => setTaskEditDesc(e.target.value)} placeholder="Детали задачи" />
                  </div>
                  <div>
                    <div className="form-label">Исполнитель</div>
                    <select className="form-input" value={taskEditAssigneeId} onChange={e => setTaskEditAssigneeId(e.target.value)}>
                      {taskUsersForSelect.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                    </select>
                  </div>
                  <div className="g2">
                    <div>
                      <div className="form-label">Начало</div>
                      <input className="form-input" type="datetime-local" value={taskEditStart} onChange={e => setTaskEditStart(e.target.value)} />
                    </div>
                    <div>
                      <div className="form-label">Срок</div>
                      <input className="form-input" type="datetime-local" value={taskEditDue} onChange={e => setTaskEditDue(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Description (view) */}
              {!taskEditMode && taskDetail.description && (
                <div>
                  <div className="form-label" style={{ marginBottom: 6 }}>Описание</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", background: "var(--bg-metric)", borderRadius: 10, padding: "12px 14px" }}>
                    {taskDetail.description}
                  </div>
                </div>
              )}

              {/* Info row */}
              {!taskEditMode && (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>👤 Исполнитель: <strong>{taskDetail.assignee.name || taskDetail.assignee.email}</strong></span>
                  {taskDetail.startsAt && <span>📅 Начало: {new Date(taskDetail.startsAt).toLocaleDateString("ru-RU")}</span>}
                </div>
              )}

              {/* Comments */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                  Комментарии {taskComments.length > 0 && <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>({taskComments.length})</span>}
                </div>
                {taskCommentsLoading ? (
                  <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка…</div>
                ) : taskComments.length === 0 ? (
                  <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Комментариев пока нет — напишите первым!</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {taskComments.map(c => (
                      <div key={c.id} style={{ display: "flex", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                          {(c.author.name || c.author.email)[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                            {c.author.name || c.author.email}
                            <span style={{ fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 8 }}>{new Date(c.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.5, background: "var(--bg-hover)", borderRadius: 10, padding: "8px 12px" }}>{c.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment input */}
            <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
              <textarea
                className="form-input"
                value={taskCommentInput}
                onChange={e => setTaskCommentInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitTaskComment(); } }}
                placeholder="Написать комментарий… (Enter — отправить)"
                rows={1}
                style={{ flex: 1, resize: "none", minHeight: 38, maxHeight: 100, overflowY: "auto" }}
              />
              <button
                className="btn btn-primary"
                style={{ height: 38, minWidth: 38, padding: "0 12px" }}
                disabled={!taskCommentInput.trim() || taskCommentSending}
                onClick={() => void submitTaskComment()}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
