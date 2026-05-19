"use client";

import React, { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  MEDIATOR_AI_PAYROLL as CALC_MEDIATOR_AI_PAYROLL,
  computeChain,
  computeMediatorAiPayroll,
  getPayrollBaseFromChain,
  parsePayrollPoolPct,
  type CalcStep,
  type CalcStepResult,
} from "@/lib/deal-payout";
import { MediatorFormModal } from "@/components/mediators/MediatorFormModal";
import { MediatorsTab, type MediatorListItem } from "@/components/mediators/MediatorsTab";
import { ExchangeRatesModal } from "@/components/modals/ExchangeRatesModal";
import { ExpensesTab } from "@/components/expenses/ExpensesTab";
import { fetchExpenses, type ExpenseRow } from "@/lib/expenses";
import { SalaryConfigModal } from "@/components/salary/SalaryConfigModal";
import { SalaryPaymentModal } from "@/components/salary/SalaryPaymentModal";
import { StaffTable } from "@/components/staff/StaffTable";
import {
  clientFormSectionStyle,
  fetchClients,
  type ClientFieldDef,
  type ClientListItem,
  type ClientPipelineStatus,
} from "@/lib/clients";
import { ClientsTab } from "@/components/clients/ClientsTab";
import { DashboardTab } from "@/components/dashboard/DashboardTab";
import { WorkerDashboard } from "@/components/dashboard/WorkerDashboard";
import {
  fetchDashboard,
  fetchGlobalDashboard,
  filterDealsByPeriod,
  type DashboardDealRow,
} from "@/lib/dashboard";
import { ReportsTab } from "@/components/reports/ReportsTab";
import { downloadAccountingExport, fetchWorkersReport, importAccountingXlsx, type WorkersReport } from "@/lib/reports";
import { OlxFormModal } from "@/components/olx/OlxFormModal";
import { OlxTab, type OlxListItem } from "@/components/olx/OlxTab";
import { DealFormModal } from "@/components/deals/DealFormModal";
import { DealsTab } from "@/components/deals/DealsTab";
import { DealTemplatesSettingsCard } from "@/components/deal-templates/DealTemplatesSettingsCard";
import { TemplateWizardModal } from "@/components/deal-templates/TemplateWizardModal";
import { deleteDealTemplate, fetchDealTemplates } from "@/lib/deal-templates";
import { FIELD_TYPE_LABELS, FIELD_TYPES_ALL, type FieldType } from "@/lib/field-types";
import {
  mediatorPctFieldKey,
  type Deal,
  type DealAmtRow,
  type DealParticipantRow,
  type DealStatus,
  type DealTemplate,
  type DealWorker,
} from "@/lib/deals";
import { CURRENCIES, CURRENCY_META } from "@/lib/currencies";
import { SALARY_PAYMENT_TYPES } from "@/lib/salary-constants";


type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "WORKER";

type User = {
  id: string;
  email: string;
  role: Role;
  activeOrganizationId: string;
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

type Tab = "dashboard" | "deals" | "clients" | "expenses" | "reports" | "settings" | "profile" | "staff" | "mediators" | "olx" | "tasks" | "assistant" | "chat" | "salary";
type OperationType = "PURCHASE" | "ATM" | "TRANSFER";

const OP_LABELS: Record<OperationType, string> = {
  PURCHASE: "Покупка",
  ATM: "Банкомат",
  TRANSFER: "Перевод",
};

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  // --- Clients ---
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientStatuses, setClientStatuses] = useState<ClientPipelineStatus[]>([]);
  const [clientFieldDefs, setClientFieldDefs] = useState<ClientFieldDef[]>([]);
  const [clientStatusFilter, setClientStatusFilter] = useState<string>("all");
  const [clientSearchQ, setClientSearchQ] = useState("");
  const [pendingClientCreate, setPendingClientCreate] = useState(false);
  const [newClientStatusSlug, setNewClientStatusSlug] = useState("");
  const [newClientStatusLabel, setNewClientStatusLabel] = useState("");
  const [newClientFieldKey, setNewClientFieldKey] = useState("");
  const [newClientFieldLabel, setNewClientFieldLabel] = useState("");
  const [newClientFieldType, setNewClientFieldType] = useState<FieldType>("TEXT");
  const [clientStatusDrafts, setClientStatusDrafts] = useState<Record<string, { label: string; sortOrder: string; color: string; isTerminal: boolean }>>({});
  const [clientFieldDrafts, setClientFieldDrafts] = useState<Record<string, { label: string; order: string; options: string; type: FieldType; required: boolean }>>({});

  // --- Expenses ---
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);

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

  // --- Exchange Rates ---
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 1, EUR: 0.92, UAH: 41.5, PLN: 4.0, CHF: 0.88,
  });
  const [ratesModalOpen, setRatesModalOpen] = useState(false);
  const [ratesSyncing, setRatesSyncing] = useState(false);
  const [ratesLastSync, setRatesLastSync] = useState<string | null>(null);

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
  const [legacyImportYear, setLegacyImportYear] = useState("2026");
  const [legacyImporting, setLegacyImporting] = useState(false);
  const legacyImportInputRef = useRef<HTMLInputElement>(null);
  const [dealDate, setDealDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dealStatus, setDealStatus] = useState<DealStatus>("NEW");
  const [dealClientSearch, setDealClientSearch] = useState("");
  const [dealClientId, setDealClientId] = useState<string | null>(null);
  const [dealClientSkip, setDealClientSkip] = useState(false);
  const [dealClients, setDealClients] = useState<ClientListItem[]>([]);
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

  // --- Dashboard ---
  const [dashFrom, setDashFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [dashTo, setDashTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);
  const [dash, setDash] = useState<any>(null);

  // --- Reports ---
  const [repFrom, setRepFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [repTo, setRepTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [repLoading, setRepLoading] = useState(false);
  const [accountingExporting, setAccountingExporting] = useState(false);
  const [accountingImporting, setAccountingImporting] = useState(false);
  const [olxList, setOlxList] = useState<any[]>([]);
  const [olxLoading, setOlxLoading] = useState(false);
  const [selectedOlx, setSelectedOlx] = useState<any | null>(null);
  const [olxDetail, setOlxDetail] = useState<any | null>(null);
  const [olxDetailLoading, setOlxDetailLoading] = useState(false);
  const [olxFormOpen, setOlxFormOpen] = useState(false);
  const [olxForm, setOlxForm] = useState({ name: "", phone: "", note: "", defaultPct: "" });
  const [olxEditingId, setOlxEditingId] = useState<string | null>(null);
  const [dealOlxId, setDealOlxId] = useState<string>("");
  const [dealOlxPct, setDealOlxPct] = useState<string>("");
  const [dealInfoPct, setDealInfoPct] = useState<string>("");
  const [repWorkers, setRepWorkers] = useState<WorkersReport | null>(null);

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
  // --- Staff ---
  const [staffData, setStaffData] = useState<any>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffMember, setStaffMember] = useState<any>(null);
  const [staffMemberLoading, setStaffMemberLoading] = useState(false);

  // --- Salary ---
  const [salaryData, setSalaryData] = useState<any[]>([]);
  const [salaryAiPartner, setSalaryAiPartner] = useState<any | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [mediators, setMediators] = useState<any[]>([]);
  const [mediatorsLoading, setMediatorsLoading] = useState(false);
  const [selectedMediator, setSelectedMediator] = useState<any | null>(null);
  const [mediatorDetail, setMediatorDetail] = useState<any | null>(null);
  const [mediatorDetailLoading, setMediatorDetailLoading] = useState(false);
  const [mediatorFormOpen, setMediatorFormOpen] = useState(false);
  const [mediatorForm, setMediatorForm] = useState({ name: "", phone: "", note: "", defaultPct: "" });
  const [mediatorEditingId, setMediatorEditingId] = useState<string | null>(null);
  const [dealMediatorId, setDealMediatorId] = useState<string>("");
  const [dealMediatorPct, setDealMediatorPct] = useState<string>("");
  const [salaryPeriod, setSalaryPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedSalaryEmp, setSelectedSalaryEmp] = useState<any | null>(null);
  const [salaryConfigModal, setSalaryConfigModal] = useState<{ userId: string; name: string; config: any } | null>(null);
  const [salaryPaymentModal, setSalaryPaymentModal] = useState<{ userId: string; name: string; orgId: string; currency: string } | null>(null);

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
  // Ref keeps the latest chatActiveUser for the polling interval (avoids stale closure)
  const chatActiveUserRef = useRef<ChatContact | null>(null);
  // AbortController for task comment loading — cancels previous request on rapid clicks
  const taskCommentAbortRef = useRef<AbortController | null>(null);

  // --- Sessions & Audit ---
  type SessionInfo = {
    id: string;
    createdAt: string;
    lastActiveAt: string;
    ip: string | null;
    userAgent: string | null;
    activeOrganizationId: string | null;
  };
  type AuditRow = {
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: string;
    user: { id: string; email: string; name: string | null };
  };
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionRevoking, setSessionRevoking] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditOffset, setAuditOffset] = useState(0);
  const AUDIT_LIMIT = 50;

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
    if (tab === "dashboard") return isWorker ? "Мой кабинет" : "Дашборд";
    if (tab === "deals") return "Сделки";
    if (tab === "clients") return "Клиенты";
    if (tab === "expenses") return "Расходы";
    if (tab === "reports") return "Отчёты";
    if (tab === "settings") return "Настройки";
    if (tab === "profile") return "Мой профиль";
    if (tab === "staff") return "Сотрудники";
    if (tab === "mediators") return "Посредники";
    if (tab === "olx") return "ОЛХ";
    if (tab === "tasks") return "Задачи";
    if (tab === "chat") return "Чат";
    if (tab === "assistant") return "AI Ассистент";
    if (tab === "salary") return "Зарплата";
    return "MyCRM";
  }, [tab, isWorker]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) { router.replace("/login"); return; }
      const j = await res.json();
      setUser(j.user);
      // Load orgs for all users (ADMIN sees all, MANAGER sees own)
      const orgRes = await fetch("/api/orgs", { credentials: "include" });
      if (orgRes.ok) setOrgs(await orgRes.json());
      void loadExchangeRates();
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
    if (tab === "clients") {
      void loadClients();
      void loadClientStatuses();
      void loadClientFieldDefinitions();
    }
    if (tab === "expenses") loadExpenses();
    if (tab === "deals") { loadDeals(); loadTemplates(); }
    if (tab === "dashboard" && user && user.role !== "WORKER") {
      void loadDashboard();
      void loadDeals();
      void loadExpenses();
    }
    if (tab === "reports") loadReportsWorkers();
    if (tab === "profile") { loadProfile(); void loadSessions(); }
    if (tab === "settings") {
      loadUsers(); loadOrgs(); loadTemplates();
      if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
        void loadAuditLog(0); void loadExchangeRates();
        void loadClientStatuses(); void loadClientFieldDefinitions();
      }
    }
    if (tab === "staff") loadStaff();
    if (tab === "mediators") { void loadMediators(); setSelectedMediator(null); setMediatorDetail(null); }
    if (tab === "olx") { void loadOlxList(); setSelectedOlx(null); setOlxDetail(null); }
    if (tab === "salary") loadSalary();
    if (tab === "tasks") { void loadTasks(); if (isManager) void loadTaskUserOptions(); }
    if (tab === "assistant") void loadClientStatuses();
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
  }, [tab, user?.role]);

  useEffect(() => {
    if (!isSuperAdmin && dashView === "global") setDashView("current");
  }, [isSuperAdmin, dashView]);

  // ---- loaders ----
  async function loadClients() {
    setClientsLoading(true);
    try {
      const list = await fetchClients(clientSearchQ);
      setClients(list);
    } catch (e) {
      if (e instanceof Error && e.message === "unauthorized") router.replace("/login");
    } finally {
      setClientsLoading(false);
    }
  }

  async function loadClientStatuses() {
    const res = await fetch("/api/client-statuses", { credentials: "include" });
    if (res.status === 401) { router.replace("/login"); return; }
    if (res.ok) setClientStatuses(await res.json());
  }

  async function loadClientFieldDefinitions() {
    const res = await fetch("/api/client-field-definitions", { credentials: "include" });
    if (res.status === 401) { router.replace("/login"); return; }
    if (res.ok) setClientFieldDefs(await res.json());
  }

  const dashDealsInPeriod = useMemo(
    () => filterDealsByPeriod(deals as DashboardDealRow[], dashFrom, dashTo),
    [deals, dashFrom, dashTo],
  );

  useEffect(() => {
    setClientStatusDrafts(
      Object.fromEntries(
        clientStatuses.map((s) => [
          s.id,
          { label: s.label, sortOrder: String(s.sortOrder), color: s.color ?? "", isTerminal: s.isTerminal },
        ]),
      ),
    );
  }, [clientStatuses]);

  useEffect(() => {
    setClientFieldDrafts(
      Object.fromEntries(
        clientFieldDefs.map((f) => [
          f.id,
          { label: f.label, order: String(f.order), options: f.options ?? "", type: f.type, required: f.required },
        ]),
      ),
    );
  }, [clientFieldDefs]);

  async function loadExpenses() {
    setExpensesLoading(true);
    try {
      const list = await fetchExpenses();
      setExpenses(list);
    } catch (e) {
      if (e instanceof Error && e.message === "unauthorized") router.replace("/login");
    } finally {
      setExpensesLoading(false);
    }
  }

  async function loadExchangeRates() {
    try {
      const [ratesRes, metaRes] = await Promise.all([
        fetch("/api/exchange-rates", { credentials: "include" }),
        fetch("/api/exchange-rates/meta", { credentials: "include" }),
      ]);
      if (ratesRes.ok) {
        const j: Array<{ code: string; rateToUsd: string | number }> = await ratesRes.json();
        const map: Record<string, number> = {};
        for (const r of j) map[r.code] = Number(r.rateToUsd);
        if (Object.keys(map).length > 0) setExchangeRates(map);
      }
      if (metaRes.ok) {
        const m = await metaRes.json();
        if (m.lastSyncedAt) setRatesLastSync(m.lastSyncedAt);
      }
    } catch { /* ignore */ }
  }

  async function syncRatesNow() {
    setRatesSyncing(true);
    try {
      const res = await fetch("/api/exchange-rates/sync", { method: "POST", credentials: "include" });
      if (res.ok) {
        setRatesLastSync(new Date().toISOString());
        await loadExchangeRates();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.message || "Не удалось обновить курсы");
      }
    } finally { setRatesSyncing(false); }
  }

  function toUsd(amount: number, currency: string): number {
    const rate = exchangeRates[currency] ?? 1;
    return rate > 0 ? amount / rate : amount;
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

  async function importLegacyDeals(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      alert("Нужен файл .xlsx");
      return;
    }
    setLegacyImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const y = Number(legacyImportYear) || 2026;
      const res = await fetch(`/api/deals/import-legacy?year=${encodeURIComponent(String(y))}&currency=PLN`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.message || "Ошибка импорта");
        return;
      }
      const withParts = Array.isArray(j.deals) ? j.deals.filter((d: { participantsAssigned?: boolean }) => d.participantsAssigned).length : 0;
      const msg = [`Создано сделок: ${j.created ?? 0}`, withParts ? `С воркерами (%): ${withParts}` : ""].filter(Boolean);
      if (j.errors?.length) msg.push(`Строки с замечаниями:\n${j.errors.slice(0, 8).join("\n")}`);
      if (j.templateId) msg.push(`Шаблон: «Легаси (импорт)»`);
      alert(msg.join("\n\n"));
      await loadDeals();
    } finally {
      setLegacyImporting(false);
      if (legacyImportInputRef.current) legacyImportInputRef.current.value = "";
    }
  }

  async function loadMediators() {
    setMediatorsLoading(true);
    try {
      const res = await fetch("/api/mediators", { credentials: "include" });
      if (res.ok) setMediators(await res.json());
    } finally { setMediatorsLoading(false); }
  }

  async function loadMediatorDetail(id: string, period?: string) {
    setMediatorDetailLoading(true);
    try {
      const p = period ?? salaryPeriod;
      const res = await fetch(`/api/mediators/${id}?period=${p}`, { credentials: "include" });
      if (res.ok) setMediatorDetail(await res.json());
    } finally { setMediatorDetailLoading(false); }
  }

  async function saveMediator() {
    if (!mediatorForm.name.trim()) return alert("Укажите имя");
    const body = {
      name: mediatorForm.name.trim(),
      phone: mediatorForm.phone.trim() || undefined,
      note: mediatorForm.note.trim() || undefined,
      defaultPct: mediatorForm.defaultPct ? Number(mediatorForm.defaultPct) : undefined,
    };
    const res = await fetch(mediatorEditingId ? `/api/mediators/${mediatorEditingId}` : "/api/mediators", {
      method: mediatorEditingId ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return alert("Не удалось сохранить");
    setMediatorFormOpen(false);
    setMediatorEditingId(null);
    await loadMediators();
    if (selectedMediator?.id === mediatorEditingId) void loadMediatorDetail(mediatorEditingId!);
  }

  function openMediatorForm(m?: MediatorListItem) {
    if (m) {
      setMediatorEditingId(m.id);
      setMediatorForm({
        name: m.name,
        phone: m.phone ?? "",
        note: m.note ?? "",
        defaultPct: m.defaultPct != null ? String(m.defaultPct) : "",
      });
    } else {
      setMediatorEditingId(null);
      setMediatorForm({ name: "", phone: "", note: "", defaultPct: "" });
    }
    setMediatorFormOpen(true);
  }

  async function deleteMediator(id: string) {
    if (!confirm("Удалить посредника? Если есть сделки — будет деактивирован.")) return;
    const res = await fetch(`/api/mediators/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return alert("Не удалось удалить");
    if (selectedMediator?.id === id) { setSelectedMediator(null); setMediatorDetail(null); }
    await loadMediators();
  }

  async function loadOlxList() {
    setOlxLoading(true);
    try {
      const res = await fetch("/api/olx", { credentials: "include" });
      if (res.ok) setOlxList(await res.json());
    } finally { setOlxLoading(false); }
  }

  async function loadOlxDetail(id: string, period?: string) {
    setOlxDetailLoading(true);
    try {
      const p = period ?? salaryPeriod;
      const res = await fetch(`/api/olx/${id}?period=${p}`, { credentials: "include" });
      if (res.ok) setOlxDetail(await res.json());
    } finally { setOlxDetailLoading(false); }
  }

  async function saveOlx() {
    if (!olxForm.name.trim()) return alert("Укажите имя");
    const body = {
      name: olxForm.name.trim(),
      phone: olxForm.phone.trim() || undefined,
      note: olxForm.note.trim() || undefined,
      defaultPct: olxForm.defaultPct ? Number(olxForm.defaultPct) : undefined,
    };
    const res = await fetch(olxEditingId ? `/api/olx/${olxEditingId}` : "/api/olx", {
      method: olxEditingId ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return alert("Не удалось сохранить");
    setOlxFormOpen(false);
    setOlxEditingId(null);
    await loadOlxList();
    if (selectedOlx?.id === olxEditingId) void loadOlxDetail(olxEditingId!);
  }

  function openOlxForm(m?: OlxListItem) {
    if (m) {
      setOlxEditingId(m.id);
      setOlxForm({
        name: m.name,
        phone: m.phone ?? "",
        note: m.note ?? "",
        defaultPct: m.defaultPct != null ? String(m.defaultPct) : "",
      });
    } else {
      setOlxEditingId(null);
      setOlxForm({ name: "", phone: "", note: "", defaultPct: "" });
    }
    setOlxFormOpen(true);
  }

  async function deleteOlx(id: string) {
    if (!confirm("Удалить ОЛХ? Если есть сделки — будет деактивирован.")) return;
    const res = await fetch(`/api/olx/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return alert("Не удалось удалить");
    if (selectedOlx?.id === id) { setSelectedOlx(null); setOlxDetail(null); }
    await loadOlxList();
  }

  async function loadStaff() {
    setStaffLoading(true);
    setStaffMember(null);
    try {
      const res = await fetch("/api/staff", { credentials: "include" });
      if (res.ok) setStaffData(await res.json());
    } finally { setStaffLoading(false); }
  }

  async function loadSalary(period?: string) {
    setSalaryLoading(true);
    try {
      const p = period ?? salaryPeriod;
      const orgId = user?.activeOrganizationId ?? "";
      const res = await fetch(`/api/salary/overview?organizationId=${orgId}&period=${p}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        const employees = Array.isArray(json) ? json : (json.employees ?? []);
        setSalaryData(employees);
        setSalaryAiPartner(Array.isArray(json) ? null : (json.aiPartner ?? null));
        setSelectedSalaryEmp((prev: any) =>
          prev ? employees.find((e: any) => e.userId === prev.userId) ?? (json.aiPartner?.userId === prev.userId ? json.aiPartner : prev) : null,
        );
      }
    } finally { setSalaryLoading(false); }
  }

  function openSalaryConfigModal(
    userId: string,
    name: string,
    config?: { baseAmount?: unknown; currency?: string; payDay?: number; note?: string | null } | null,
  ) {
    setSalaryConfigModal({ userId, name, config: config ?? null });
  }

  function openSalaryPaymentModal(userId: string, name: string, orgId: string, currency = "USD") {
    setSalaryPaymentModal({ userId, name, orgId, currency });
  }

  async function togglePaymentPaid(paymentId: string, isPaid: boolean) {
    await fetch(`/api/salary/payments/${paymentId}/paid`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid }),
    });
    loadSalary();
  }

  async function deleteSalaryPayment(paymentId: string) {
    if (!confirm("Удалить запись о выплате?")) return;
    await fetch(`/api/salary/payments/${paymentId}`, { method: "DELETE", credentials: "include" });
    loadSalary();
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
        if (isAdmin) void loadSalary();
        if (tasks.length === 0) loadTasks();
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

  async function patchTask(id: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json() as CrmTask;
      // Sync task list
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      // Sync open drawer if it's the same task
      setTaskDetail(prev => prev?.id === id ? updated : prev);
      void loadTaskPendingCount();
      return true;
    }
    const e = await res.json().catch(() => ({}));
    alert((e as { message?: string }).message ?? "Ошибка");
    return false;
  }

  async function deleteTaskById(id: string) {
    if (!confirm("Удалить задачу?")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) { if (taskDetail?.id === id) setTaskDetail(null); await loadTasks(); }
  }

  async function openTaskDetail(t: CrmTask) {
    // Cancel any in-flight comment request from a previous task
    taskCommentAbortRef.current?.abort();
    const controller = new AbortController();
    taskCommentAbortRef.current = controller;

    setTaskDetail(t);
    setTaskEditMode(false);
    setTaskComments([]);
    setTaskCommentInput("");
    setTaskCommentsLoading(true);
    try {
      const res = await fetch(`/api/tasks/${t.id}/comments`, {
        credentials: "include",
        signal: controller.signal,
      });
      if (res.ok) setTaskComments(await res.json());
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") throw e;
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
    const ok = await patchTask(taskDetail.id, {
      title: taskEditTitle.trim(),
      description: taskEditDesc.trim() || null,
      dueAt: taskEditDue || null,
      startsAt: taskEditStart || null,
      assigneeId: taskEditAssigneeId || undefined,
    });
    // patchTask already syncs taskDetail on success; only close edit mode if successful
    if (ok) setTaskEditMode(false);
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
    // Update ref immediately so the polling interval sees the new partner right away
    chatActiveUserRef.current = contact;
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
    // Read from ref — always current even inside a stale setInterval closure
    const active = chatActiveUserRef.current;
    if (!active) return;
    try {
      const res = await fetch(`/api/chat/messages?with=${active.id}&limit=20`, { credentials: "include" });
      if (res.ok) {
        const msgs: ChatMessage[] = await res.json();
        setChatMessages(prev => {
          if (prev.length === 0) return msgs;
          const existIds = new Set(prev.map(m => m.id));
          const newOnes = msgs.filter(m => !existIds.has(m.id));
          if (!newOnes.length) return prev;
          void fetch("/api/chat/read", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ otherUserId: active.id }),
          });
          return [...prev, ...newOnes];
        });
      }
    } catch { /* ignore */ }
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
      } else if (agentPending.type === "create_client") {
        const p = agentPending.params;
        const slug = typeof p.statusSlug === "string" ? p.statusSlug.trim().toLowerCase() : "";
        const status = slug ? clientStatuses.find((x) => x.slug.toLowerCase() === slug) : undefined;
        const res = await fetch("/api/clients", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(p.name ?? "").trim(),
            phone: String(p.phone ?? "").trim(),
            bank: p.bank != null && String(p.bank).trim() ? String(p.bank).trim() : null,
            assistantName: p.assistantName != null && String(p.assistantName).trim() ? String(p.assistantName).trim() : null,
            callSummary: p.callSummary != null && String(p.callSummary).trim() ? String(p.callSummary).trim() : null,
            callStartedAt: p.callStartedAt != null && String(p.callStartedAt).trim() ? String(p.callStartedAt).trim() : null,
            note: p.note != null && String(p.note).trim() ? String(p.note).trim() : null,
            statusId: status?.id ?? undefined,
          }),
        });
        if (res.ok) {
          const name = String(p.name ?? "").trim();
          void loadClients();
          setAgentHistory((h) => [
            ...h,
            { role: "assistant", content: `✅ Карточка клиента создана${name ? `: ${name}` : ""}.\nСписок во вкладке «Клиенты» обновлён; при необходимости откройте её или «Редактировать» в карточке.` },
          ]);
        } else {
          const err = await res.json().catch(() => ({}));
          setAgentHistory((h) => [
            ...h,
            { role: "assistant", content: `❌ Не удалось создать клиента: ${err.message ?? res.status}` },
          ]);
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

  async function loadTemplates() {
    setTemplates(await fetchDealTemplates());
  }

  function openTemplateModal(tpl?: DealTemplate) {
    setTemplateEditing(tpl ?? null);
    setTemplateModalOpen(true);
  }

  async function handleDeleteTemplate(id: string, name: string) {
    if (!confirm(`Удалить шаблон «${name}»? Это действие нельзя отменить.`)) return;
    await deleteDealTemplate(id);
    loadTemplates();
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

  // --- Sessions ---
  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/sessions", { credentials: "include" });
      if (!res.ok) return;
      setSessions(await res.json());
    } finally { setSessionsLoading(false); }
  }

  async function revokeSession(id: string) {
    setSessionRevoking(id);
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE", credentials: "include" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally { setSessionRevoking(null); }
  }

  async function revokeAllSessions() {
    if (!confirm("Завершить все другие сессии?")) return;
    await fetch("/api/sessions/revoke-all", { method: "POST", credentials: "include" });
    await loadSessions();
  }

  // --- Audit log ---
  async function loadAuditLog(offset = 0) {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/audit-log?limit=${AUDIT_LIMIT}&offset=${offset}`, { credentials: "include" });
      if (!res.ok) return;
      const j = await res.json();
      setAuditLog(j.rows);
      setAuditTotal(j.total);
      setAuditOffset(offset);
    } finally { setAuditLoading(false); }
  }

  async function loadDashboard(from?: string, to?: string) {
    setDashLoading(true);
    setDashError(null);
    const f = from ?? dashFrom;
    const t = to ?? dashTo;
    try {
      setDash(await fetchDashboard(f, t));
    } catch (e) {
      setDash(null);
      if (e instanceof Error && e.message === "unauthorized") {
        router.replace("/login");
        return;
      }
      setDashError(e instanceof Error ? e.message : "Ошибка сети при загрузке дашборда");
    } finally {
      setDashLoading(false);
    }
  }

  async function loadReportsWorkers() {
    setRepLoading(true);
    try {
      const data = await fetchWorkersReport(repFrom, repTo);
      if (data === null) { router.replace("/login"); return; }
      setRepWorkers(data);
    } finally { setRepLoading(false); }
  }

  async function handleAccountingExport() {
    setAccountingExporting(true);
    try {
      const result = await downloadAccountingExport(repFrom, repTo);
      if (!result.ok) {
        if (result.unauthorized) { router.replace("/login"); return; }
        alert(result.message);
      }
    } finally {
      setAccountingExporting(false);
    }
  }

  async function handleAccountingImport(file: File) {
    if (!confirm("Удалить сделку? Это действие нельзя отменить.")) return;
    setAccountingImporting(true);
    try {
      const result = await importAccountingXlsx(file);
      if (!result.ok) {
        if (result.unauthorized) { router.replace("/login"); return; }
        alert(result.message);
        return;
      }
      const { created, skipped, errors } = result.result;
      const errText = errors.length ? `\n\nОшибки:\n${errors.slice(0, 8).join("\n")}` : "";
      alert("Не удалось удалить сделку");
      if (created > 0) { void loadDeals(); void loadDashboard(); }
    } finally {
      setAccountingImporting(false);
    }
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
    if (!confirm("Удалить сделку? Это действие нельзя отменить.")) return;
    const res = await fetch(`/api/orgs/${orgId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.message ?? "Не удалось удалить офис");
      return;
    }
    await loadOrgs();
  }

  async function loadGlobalDash(from?: string, to?: string) {
    setGlobalDashLoading(true);
    const f = from ?? dashFrom;
    const t = to ?? dashTo;
    try {
      setGlobalDash(await fetchGlobalDashboard(f, t));
    } catch (e) {
      if (e instanceof Error && e.message === "unauthorized") router.replace("/login");
    } finally {
      setGlobalDashLoading(false);
    }
  }

  // ---- clients ----
  async function deleteClientStatusRow(id: string) {
    if (!confirm("Удалить статус?")) return;
    const res = await fetch(`/api/client-statuses/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return alert(j.message ?? "Нельзя удалить");
    }
    await loadClientStatuses();
  }

  async function addClientStatusRow() {
    const slug = newClientStatusSlug.trim().toLowerCase();
    const label = newClientStatusLabel.trim();
    if (!slug || !label) return alert("Slug и название обязательны (slug: латиница, например follow_up)");
    const res = await fetch("/api/client-statuses", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, label }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return alert(j.message ?? "Ошибка");
    }
    setNewClientStatusSlug(""); setNewClientStatusLabel("");
    await loadClientStatuses();
  }

  async function deleteClientFieldRow(id: string) {
    if (!confirm("Удалить поле? Значения в карточках останутся в JSON, но поле скроется.")) return;
    const res = await fetch(`/api/client-field-definitions/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return alert("Ошибка");
    await loadClientFieldDefinitions();
  }

  async function addClientFieldRow() {
    const key = newClientFieldKey.trim().toLowerCase();
    const label = newClientFieldLabel.trim();
    if (!key || !label) return alert("Ключ и подпись обязательны");
    const res = await fetch("/api/client-field-definitions", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, label, type: newClientFieldType }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return alert(j.message ?? "Ошибка");
    }
    setNewClientFieldKey(""); setNewClientFieldLabel(""); setNewClientFieldType("TEXT");
    await loadClientFieldDefinitions();
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

  async function changeUserRole(userId: string, role: Role) {
    const res = await fetch("/api/users/role", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) return alert("Не удалось сменить роль");
    await loadUsers();
  }

  async function resetUserPassword(userId: string) {
    const pwd = userPwdValue.trim();
    if (!pwd) return alert("Введите пароль");
    if (pwd.length < 6) return alert("Пароль должен быть минимум 6 символов");
    const res = await fetch("/api/users/password", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password: pwd }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      const msg = j?.message;
      return alert(Array.isArray(msg) ? msg.join("\n") : (msg ?? "Не удалось сбросить пароль"));
    }
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

  /** Синхронизирует % посредника в блоке выбора и в данных строки шаблона (от этого считается выплата). */
  function applyDealMediatorPct(pct: string, tplId?: string | null) {
    setDealMediatorPct(pct);
    const tpl = templates.find((t) => t.id === (tplId ?? dealTemplateId));
    const mk = mediatorPctFieldKey(tpl);
    if (!mk) return;
    setDealDataRows((prev) => {
      if (prev.length === 0) return [{ _id: crypto.randomUUID(), data: { [mk]: pct } }];
      return prev.map((row, i) =>
        i === 0 ? { ...row, data: { ...row.data, [mk]: pct } } : row,
      );
    });
  }

  function setDealMediatorSelection(mediatorId: string) {
    setDealMediatorId(mediatorId);
    if (!mediatorId) {
      applyDealMediatorPct("");
      return;
    }
    const m = mediators.find((x: { id: string; defaultPct?: number | string | null }) => x.id === mediatorId);
    const pct =
      m?.defaultPct != null && m.defaultPct !== ""
        ? String(m.defaultPct)
        : dealMediatorPct;
    applyDealMediatorPct(pct);
  }

  function setDealOlxSelection(olxId: string) {
    setDealOlxId(olxId);
    if (!olxId) {
      setDealOlxPct("");
      return;
    }
    const o = olxList.find((x: { id: string; defaultPct?: number | string | null }) => x.id === olxId);
    if (o?.defaultPct != null && o.defaultPct !== "") setDealOlxPct(String(o.defaultPct));
  }

  async function openDealModal() {
    const tRes = await fetch("/api/deal-templates", { credentials: "include" });
    if (!tRes.ok) {
      alert("Не удалось загрузить шаблоны");
      return;
    }
    const list: DealTemplate[] = await tRes.json();
    setTemplates(list);
    if (list.length === 0) {
      alert("Не удалось удалить сделку");
      return;
    }
    setDealModalOpen(true);
    setDealEditingId(null);
    setDealDate(new Date().toISOString().slice(0, 10));
    setDealStatus("NEW");
    setDealClientSearch("");
    setDealClientId(null);
    setDealClientSkip(false);
    setDealComment("");
    setDealAmounts([newAmtRow()]);
    setDealParticipants([{ id: crypto.randomUUID(), userId: "", pct: "100" }]);
    if (list.length === 1) {
      setDealTemplateId(list[0].id);
      setDealTemplateStep("form");
    } else {
      setDealTemplateId(list[0].id);
      setDealTemplateStep("pick");
    }
    setDealDataRows([{ _id: crypto.randomUUID(), data: {} }]);
    setDealMediatorId("");
    setDealMediatorPct("");
    setDealOlxId("");
    setDealOlxPct("");
    setDealInfoPct("");
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
    const linkPct = deal.mediatorLink ? String(deal.mediatorLink.pct) : "";
    const mk = deal.template?.calcMediatorPctKey ?? null;
    setDealDataRows(
      (deal.dataRows ?? []).length > 0
        ? deal.dataRows!.map((r, i) => {
            const data = Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, String(v ?? "")]));
            if (i === 0 && mk && linkPct && !data[mk]) data[mk] = linkPct;
            return { _id: r.id, data };
          })
        : [{ _id: crypto.randomUUID(), data: mk && linkPct ? { [mk]: linkPct } : {} }],
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
    setDealMediatorId(deal.mediatorLink?.mediatorId ?? "");
    setDealMediatorPct(linkPct);
    setDealOlxId(deal.olxLink?.olxId ?? "");
    setDealOlxPct(deal.olxLink ? String(deal.olxLink.pct) : "");
    setDealInfoPct(deal.infoPct != null && deal.infoPct !== "" ? String(deal.infoPct) : "");
    fetchDealDropdowns();
  }

  function fetchDealDropdowns() {
    Promise.all([
      fetch("/api/clients", { credentials: "include" }),
      fetch("/api/users/public", { credentials: "include" }),
      fetch("/api/mediators", { credentials: "include" }),
      fetch("/api/olx", { credentials: "include" }),
    ]).then(async ([cRes, wRes, mRes, oRes]) => {
      if (cRes.ok) setDealClients(await cRes.json());
      if (wRes.ok) setDealWorkers(await wRes.json());
      if (mRes.ok) setMediators(await mRes.json());
      if (oRes.ok) setOlxList(await oRes.json());
    });
  }

  function closeDealModal() { setDealModalOpen(false); }

  async function saveDeal() {
    const activeTpl = dealTemplateId ? templates.find((t) => t.id === dealTemplateId) : null;
    if (!dealEditingId && !activeTpl) {
      alert("Выберите шаблон сделки");
      return;
    }
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
      const mk = mediatorPctFieldKey(activeTpl);
      const rowsPayload = dealDataRows.map((r, i) => {
        const data = { ...r.data };
        if (i === 0 && mk && dealMediatorPct !== "") data[mk] = dealMediatorPct;
        return { data, order: i };
      });
      const mediatorPayload = {
        mediatorId: dealMediatorId || null,
        mediatorPct: dealMediatorPct ? Number(dealMediatorPct) : null,
        olxId: dealOlxId || null,
        olxPct: dealOlxPct ? Number(dealOlxPct) : null,
        infoPct: dealInfoPct !== "" ? Number(dealInfoPct) : null,
      };
      const payload = { ...basePayload, templateId: activeTpl.id, dataRows: rowsPayload, ...mediatorPayload };

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
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">M</div>
          <div>
            <span>MyCRM</span>
            <div className="sidebar-logo-sub">Business Platform</div>
          </div>
        </div>

        {/* Org switcher */}
        <div style={{ padding: "8px 12px 6px", position: "relative" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.06)", borderRadius: 9, padding: "9px 12px",
              cursor: isSuperAdmin ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 9,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            onClick={() => isSuperAdmin && setOrgSwitchOpen((v) => !v)}
          >
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", flexShrink: 0, boxShadow: "0 0 6px var(--green)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", lineHeight: 1, textTransform: "uppercase", letterSpacing: "0.5px" }}>Офис</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                {orgs.find((o) => o.id === user?.activeOrganizationId)?.name ?? "тАж"}
              </div>
            </div>
            {isSuperAdmin && <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6,9 12,15 18,9"/></svg>}
          </div>

          {orgSwitchOpen && isSuperAdmin ? (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 12, right: 12, zIndex: 200,
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)", overflow: "hidden",
            }}>
              {orgs.map((o) => (
                <div key={o.id} onClick={() => switchOrg(o.id)} style={{
                  padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                  background: o.id === user?.activeOrganizationId ? "var(--accent-light)" : "transparent",
                  color: o.id === user?.activeOrganizationId ? "var(--accent)" : "var(--text-primary)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  {o.id === user?.activeOrganizationId && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{o.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{o._count.users} польз. · {o._count.deals} сделок</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="sidebar-nav">
          {(() => {
            const NAV_LABELS: Record<string, string> = {
              dashboard: isWorker ? "Мой кабинет" : "Дашборд",
              deals: "Сделки", clients: "Клиенты",
              expenses: "Расходы", reports: "Отчёты",
              staff: "Сотрудники", mediators: "Посредники", olx: "ОЛХ", salary: "Зарплата", tasks: "Задачи", chat: "Чат",
              assistant: "AI Ассистент", settings: "Настройки", profile: "Профиль"
            };
            const NAV_SVG: Record<string, ReactElement> = {
              dashboard: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
              deals: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
              clients: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              expenses: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
              reports: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
              staff: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              mediators: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-2-2m0 0l-2 2m2-2v6"/></svg>,
              olx: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h6"/></svg>,
              tasks: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
              chat: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
              assistant: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2z"/></svg>,
              settings: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
              salary: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
              profile: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
            };

            const renderItem = (t: Tab) => (
              <a key={t} className={`nav-item ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); setOrgSwitchOpen(false); setSidebarOpen(false); }}>
                {NAV_SVG[t]}
                <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  {NAV_LABELS[t]}
                  {t === "tasks" && taskPendingCount > 0 && (
                    <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "18px", textAlign: "center", marginLeft: "auto" }}>{taskPendingCount > 9 ? "9+" : taskPendingCount}</span>
                  )}
                  {t === "chat" && chatUnread > 0 && (
                    <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "18px", textAlign: "center", marginLeft: "auto" }}>{chatUnread > 9 ? "9+" : chatUnread}</span>
                  )}
                </span>
              </a>
            );

            if (isWorker) {
              return (<>
                {renderItem("dashboard")}
                <div className="nav-divider" />
                <div className="nav-section">Клиенты</div>
                {renderItem("clients")}
                {renderItem("assistant")}
                <div className="nav-divider" />
                <div className="nav-section">Задачи и чат</div>
                {renderItem("tasks")}
                {renderItem("chat")}
                <div className="nav-divider" />
                <div className="nav-section">Аккаунт</div>
                {renderItem("profile")}
              </>);
            }

            return (<>
              {renderItem("dashboard")}
              <div className="nav-divider" />
              <div className="nav-section">Продажи</div>
              {renderItem("deals")}
              {renderItem("clients")}
              <div className="nav-divider" />
              <div className="nav-section">Финансы</div>
              {renderItem("expenses")}
              {isAdmin && renderItem("reports")}
              {isAdmin && renderItem("salary")}
              <div className="nav-divider" />
              <div className="nav-section">Команда</div>
              {isAdmin && renderItem("staff")}
              {isManager && renderItem("mediators")}
              {isManager && renderItem("olx")}
              {renderItem("tasks")}
              {renderItem("chat")}
              <div className="nav-divider" />
              <div className="nav-section">Система</div>
              {renderItem("assistant")}
              {isAdmin && renderItem("settings")}
              {renderItem("profile")}
            </>);
          })()}
        </nav>

        <div className="sidebar-footer">
          {/* User info */}
          <div className="sidebar-user" onClick={() => { setTab("profile"); setSidebarOpen(false); }}>
            <div className="sidebar-user-avatar">{(user?.email ?? "?")[0].toUpperCase()}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.email ?? "тАж"}</div>
              <div className="sidebar-user-role">{user ? (ROLE_LABELS[user.role] ?? user.role) : "тАж"}</div>
            </div>
          </div>
          {/* Theme + logout row */}
          <div style={{ display: "flex", gap: 4 }}>
            <button className="theme-toggle" style={{ flex: 1 }} onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ opacity: 0.6, display: "flex" }}>
                  {theme === "dark"
                    ? <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                    : <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  }
                </span>
                <span>{theme === "dark" ? "Светлая" : "Тёмная"}</span>
              </span>
              <span className={`theme-toggle-pill${theme === "dark" ? " is-dark" : ""}`} />
            </button>
            <a className="nav-item" style={{ padding: "7px 10px", flexShrink: 0 }} onClick={logout} title="Выйти">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </a>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div>
              <h1 className="header-title">{title}</h1>
              {orgs.find((o) => o.id === user?.activeOrganizationId) && (
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>
                  {orgs.find((o) => o.id === user?.activeOrganizationId)!.name}
                </div>
              )}
            </div>
          </div>
          <div className="header-right">
            {/* Date display */}
            <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span style={{ display: "none" }} className="sm:inline">{new Date().toLocaleDateString("ru", { day: "numeric", month: "short" })}</span>
            </div>
            {/* User avatar */}
            <div
              className="header-avatar"
              onClick={() => setTab("profile")}
              title={user?.email}
            >
              {(user?.email ?? "?")[0].toUpperCase()}
            </div>
          </div>
        </header>

        <div className="content">
          {/* ===== WORKER CABINET ===== */}
          {tab === "dashboard" && !user ? (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
              Загрузка…
            </div>
          ) : null}

          {tab === "dashboard" && user && isWorker ? (
            <WorkerDashboard />
          ) : null}
          {/* ===== DASHBOARD ===== */}
          {tab === "dashboard" && user && !isWorker ? (
            <DashboardTab
              dashFrom={dashFrom}
              dashTo={dashTo}
              onDashFromChange={setDashFrom}
              onDashToChange={setDashTo}
              dashView={dashView}
              onDashViewChange={setDashView}
              isSuperAdmin={isSuperAdmin}
              dash={dash}
              dashLoading={dashLoading}
              dashError={dashError}
              onRefreshDashboard={loadDashboard}
              globalDash={globalDash}
              globalDashLoading={globalDashLoading}
              onRefreshGlobalDash={loadGlobalDash}
              deals={deals as DashboardDealRow[]}
              dealsInPeriod={dashDealsInPeriod}
              expenses={expenses}
              onNavigateToDeals={() => setTab("deals")}
              onNavigateToDealsNew={() => { setTab("deals"); setTimeout(openDealModal, 50); }}
              onNavigateToClientsNew={() => { setTab("clients"); setPendingClientCreate(true); }}
              onNavigateToExpenses={() => setTab("expenses")}
              onOpenDealEdit={(d) => { setTab("deals"); setTimeout(() => openDealEditModal(d as Deal), 50); }}
              onOpenMediator={(mediatorId) => {
                setTab("mediators");
                void loadMediators().then(() => {
                  const m = mediators.find((x: MediatorListItem) => x.id === mediatorId);
                  if (m) { setSelectedMediator(m); void loadMediatorDetail(m.id); }
                });
              }}
              onSwitchOrg={switchOrg}
            />
          ) : null}

          {/* ===== REPORTS ===== */}
          {tab === "reports" ? (
            <ReportsTab
              repFrom={repFrom}
              repTo={repTo}
              onRepFromChange={setRepFrom}
              onRepToChange={setRepTo}
              repLoading={repLoading}
              repWorkers={repWorkers}
              accountingExporting={accountingExporting}
              showAccountingExport={isManager}
              onRefresh={loadReportsWorkers}
              onExportAccounting={() => void handleAccountingExport()}
              accountingImporting={accountingImporting}
              onImportAccounting={(f) => void handleAccountingImport(f)}
            />
          ) : null}

          {/* ===== DEALS ===== */}
          {tab === "deals" ? (
            <DealsTab
              isAdmin={isAdmin}
              isManager={isManager}
              deals={deals}
              loading={dealsLoading}
              filter={dealFilter}
              onFilterChange={setDealFilter}
              legacyImportYear={legacyImportYear}
              onLegacyImportYearChange={setLegacyImportYear}
              legacyImporting={legacyImporting}
              onLegacyImport={(f) => void importLegacyDeals(f)}
              onOpenNew={() => void openDealModal()}
              onOpenEdit={openDealEditModal}
              onDelete={(id) => void deleteDeal(id)}
              modal={
                <DealFormModal
                  open={dealModalOpen}
                  editingId={dealEditingId}
                  templates={templates}
                  templateId={dealTemplateId}
                  templateStep={dealTemplateStep}
                  onTemplateIdChange={setDealTemplateId}
                  onTemplateStepChange={setDealTemplateStep}
                  dealDate={dealDate}
                  onDealDateChange={setDealDate}
                  dealStatus={dealStatus}
                  onDealStatusChange={setDealStatus}
                  dealClientSearch={dealClientSearch}
                  onDealClientSearchChange={setDealClientSearch}
                  dealClientId={dealClientId}
                  onDealClientIdChange={setDealClientId}
                  dealClientSkip={dealClientSkip}
                  onDealClientSkipChange={setDealClientSkip}
                  dealClients={dealClients}
                  dealComment={dealComment}
                  onDealCommentChange={setDealComment}
                  dealDataRows={dealDataRows}
                  onDealDataRowsChange={setDealDataRows}
                  dealAmounts={dealAmounts}
                  onDealAmountsChange={setDealAmounts}
                  dealParticipants={dealParticipants}
                  onDealParticipantsChange={setDealParticipants}
                  dealWorkers={dealWorkers}
                  dealMediatorId={dealMediatorId}
                  dealMediatorPct={dealMediatorPct}
                  dealOlxId={dealOlxId}
                  dealOlxPct={dealOlxPct}
                  onDealOlxPctChange={setDealOlxPct}
                  dealInfoPct={dealInfoPct}
                  onDealInfoPctChange={setDealInfoPct}
                  mediators={mediators}
                  olxList={olxList}
                  onClose={closeDealModal}
                  onSave={() => void saveDeal()}
                  onMediatorSelect={setDealMediatorSelection}
                  onMediatorPctChange={applyDealMediatorPct}
                  onOlxSelect={setDealOlxSelection}
                  newAmtRow={newAmtRow}
                />
              }
            />
          ) : null}

          {tab === "clients" ? (
            <ClientsTab
              clients={clients}
              loading={clientsLoading}
              statuses={clientStatuses}
              fieldDefs={clientFieldDefs}
              searchQ={clientSearchQ}
              statusFilter={clientStatusFilter}
              onSearchQChange={setClientSearchQ}
              onStatusFilterChange={setClientStatusFilter}
              onRefresh={loadClients}
              pendingCreateOpen={pendingClientCreate}
              onPendingCreateHandled={() => setPendingClientCreate(false)}
            />
          ) : null}

          {/* ===== EXPENSES ===== */}
          {tab === "expenses" ? (
            <ExpensesTab
              isAdmin={isAdmin}
              exchangeRates={exchangeRates}
              expenses={expenses}
              loading={expensesLoading}
              onRefresh={loadExpenses}
              onExpensesChange={setExpenses}
            />
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
                      <button className="chat-back-btn" onClick={() => { chatActiveUserRef.current = null; setChatActiveUser(null); }}>
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
                      {(() => {
                        const empSalary = salaryData.find((s: any) => s.userId === staffMember.id);
                        const empTasks = tasks.filter((t: any) => t.assignee?.id === staffMember.id);
                        const activeTasks = empTasks.filter((t: any) => t.status !== "DONE" && t.status !== "CANCELLED");
                        return (
                          <>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                              {[
                                { label: "Сделок", value: staffMember.dealsCount },
                                { label: "Выплаты (сделки)", value: `$${staffMember.totalPayout}` },
                                { label: "Начислено (ЗП)", value: empSalary ? `$${empSalary.totalAccrued}` : salaryLoading ? "…" : "—" },
                                { label: "Задачи (актив.)", value: tasksLoading ? "…" : activeTasks.length },
                              ].map((s) => (
                                <div key={s.label} className="card" style={{ padding: "16px 18px" }}>
                                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{s.label}</div>
                                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{s.value}</div>
                                </div>
                              ))}
                            </div>

                            {/* Salary block */}
                            <div className="card" style={{ padding: "20px 24px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Зарплата ({salaryPeriod})</div>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: 12, padding: "4px 12px" }}
                                    onClick={() => openSalaryConfigModal(
                                      staffMember.id,
                                      staffMember.name || staffMember.email,
                                      empSalary?.salaryConfig ?? null,
                                    )}
                                  >
                                    {empSalary?.salaryConfig ? "Изменить ставку" : "Настроить"}
                                  </button>
                                )}
                              </div>
                              {salaryLoading ? (
                                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка…</div>
                              ) : empSalary ? (
                                <>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                                    {[
                                      { label: "Начислено", val: `$${empSalary.totalAccrued}`, color: "var(--text-primary)" },
                                      { label: "Выплачено", val: `$${empSalary.paidUsd}`, color: "#22c55e" },
                                      { label: "Баланс", val: `$${empSalary.balance}`, color: empSalary.balance < 0 ? "#ef4444" : "var(--text-primary)" },
                                    ].map(m => (
                                      <div key={m.label} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "10px 14px" }}>
                                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{m.label}</div>
                                        <div style={{ fontSize: 17, fontWeight: 700, color: m.color }}>{m.val}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {empSalary.salaryConfig && (
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                                      <span>Ставка: <b>{empSalary.salaryConfig.baseAmount} {empSalary.salaryConfig.currency}</b></span>
                                      <span>День выплаты: <b>{empSalary.salaryConfig.payDay}</b></span>
                                      <span>Бонусы по сделкам: <b>${empSalary.dealEarningsUsd}</b></span>
                                    </div>
                                  )}
                                  {empSalary.payments?.length > 0 && (
                                    <div style={{ marginTop: 14 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Выплаты</div>
                                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {empSalary.payments.slice(0, 5).map((p: any) => (
                                          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 10px", background: "var(--bg-hover)", borderRadius: 6 }}>
                                            <span style={{ color: "var(--text-secondary)" }}>{({ BASE: "Ставка", DEAL_BONUS: "Бонус", ADVANCE: "Аванс", MANUAL: "Вручную" } as Record<string,string>)[p.type] ?? p.type}</span>
                                            <span style={{ fontWeight: 600 }}>{p.amount} {p.currency}</span>
                                            <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, background: p.isPaid ? "#22c55e22" : "#f59e0b22", color: p.isPaid ? "#22c55e" : "#f59e0b" }}>
                                              {p.isPaid ? "Выплачено" : "Ожидает"}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Зарплата не настроена. {isAdmin ? "Нажмите «Настроить» чтобы задать ставку." : ""}</div>
                              )}
                            </div>

                            {/* Tasks block */}
                            <div className="card" style={{ padding: "20px 24px" }}>
                              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Задачи</div>
                              {tasksLoading ? (
                                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка…</div>
                              ) : empTasks.length === 0 ? (
                                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Нет задач</div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {empTasks.slice(0, 10).map((t: any) => (
                                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-hover)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
                                      onClick={() => { setTab("tasks"); setTaskDetail(t); }}>
                                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                                      <span style={{ marginLeft: 12, padding: "2px 8px", borderRadius: 10, fontSize: 11, flexShrink: 0,
                                        background: t.status === "DONE" ? "#22c55e22" : t.status === "CANCELLED" ? "#ef444422" : t.status === "IN_PROGRESS" ? "#3b82f622" : "#f59e0b22",
                                        color: t.status === "DONE" ? "#22c55e" : t.status === "CANCELLED" ? "#ef4444" : t.status === "IN_PROGRESS" ? "#3b82f6" : "#f59e0b" }}>
                                        {({ TODO: "К выполнению", IN_PROGRESS: "В работе", DONE: "Готово", CANCELLED: "Отменена" } as Record<string,string>)[t.status] ?? t.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}

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

          {/* ===== MEDIATORS ===== */}
          {tab === "olx" ? (
            <OlxTab
              olxList={olxList}
              olxLoading={olxLoading}
              selectedOlx={selectedOlx}
              olxDetail={olxDetail}
              olxDetailLoading={olxDetailLoading}
              salaryPeriod={salaryPeriod}
              onPeriodChange={(p) => {
                setSalaryPeriod(p);
                if (selectedOlx) void loadOlxDetail(selectedOlx.id, p);
              }}
              onAdd={() => openOlxForm()}
              onOpenReport={(m) => { setSelectedOlx(m); void loadOlxDetail(m.id); }}
              onEdit={(m) => openOlxForm(m)}
              onDelete={(id) => void deleteOlx(id)}
              onBack={() => { setSelectedOlx(null); setOlxDetail(null); }}
            />
          ) : null}

          {tab === "mediators" ? (
            <MediatorsTab
              mediators={mediators}
              mediatorsLoading={mediatorsLoading}
              selectedMediator={selectedMediator}
              mediatorDetail={mediatorDetail}
              mediatorDetailLoading={mediatorDetailLoading}
              salaryPeriod={salaryPeriod}
              onPeriodChange={(p) => {
                setSalaryPeriod(p);
                if (selectedMediator) void loadMediatorDetail(selectedMediator.id, p);
              }}
              onAdd={() => openMediatorForm()}
              onOpenReport={(m) => { setSelectedMediator(m); void loadMediatorDetail(m.id); }}
              onEdit={(m) => openMediatorForm(m)}
              onDelete={(id) => void deleteMediator(id)}
              onBack={() => { setSelectedMediator(null); setMediatorDetail(null); }}
            />
          ) : null}

          {/* ===== SALARY ===== */}
          {tab === "salary" ? (() => {
            const ROLE_LABELS_S: Record<string, string> = { ADMIN: "Администратор", MANAGER: "Менеджер", WORKER: "Воркер", SUPER_ADMIN: "Супер-админ" };
            const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
            const fmtDec = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

            const totalFund = salaryData.reduce((s, e) => s + (e.totalAccrued ?? 0), 0) + (salaryAiPartner?.totalAccrued ?? 0);
            const totalDebt = salaryData.reduce((s, e) => s + Math.max(0, e.balance ?? 0), 0) + Math.max(0, salaryAiPartner?.balance ?? 0);
            const totalPaid = salaryData.reduce((s, e) => s + (e.paidUsd ?? 0), 0) + (salaryAiPartner?.paidUsd ?? 0);

            // ── CABINET VIEW ──────────────────────────────────────────────
            if (selectedSalaryEmp) {
              const emp = selectedSalaryEmp;
              const isAi = !!emp.isAiPartner;
              const cfg = emp.salaryConfig;
              const debt = emp.balance ?? 0;
              const isInDebt = debt > 0;
              const avatarColor = ["#6366F1","#059669","#D97706","#DC2626","#8B5CF6"][(emp.email || emp.name || "a").charCodeAt(0) % 5];

              return (
                <div style={{ display: "grid", gap: 16 }}>
                  {/* Back header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button className="btn btn-ghost" onClick={() => setSelectedSalaryEmp(null)} style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                      Все сотрудники
                    </button>
                    <div style={{ width: 1, height: 24, background: "var(--border)" }} />
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor + "22", color: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>
                      {(emp.name || emp.email)?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{emp.name || emp.email}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{isAi ? "Партнёр ИИ офиса" : (ROLE_LABELS_S[emp.role] ?? emp.role)}{emp.position ? ` · ${emp.position}` : ""}</div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="month" value={salaryPeriod} onChange={e => { setSalaryPeriod(e.target.value); loadSalary(e.target.value); }}
                        style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
                    </div>
                  </div>

                  {/* Metric cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {(isAi ? [
                      { label: "Начислено", value: `$${fmt(emp.totalAccrued ?? 0)}`, sub: `Доля ИИ по сделкам офиса: $${fmtDec(emp.dealEarningsUsd ?? 0)}`, color: "#8B5CF6" },
                      { label: "Выплачено", value: `$${fmt(emp.paidUsd ?? 0)}`, sub: `${emp.payments.filter((p: any) => p.isPaid).length} подтв. выплат`, color: "#059669" },
                      { label: isInDebt ? "К выплате" : "Баланс", value: `${isInDebt ? "−" : "+"}$${fmt(Math.abs(debt))}`, sub: "Счёт ИИ привязан к офису", color: isInDebt ? "#DC2626" : "#059669" },
                    ] : [
                      { label: "Начислено", value: `$${fmt(emp.totalAccrued ?? 0)}`, sub: (() => {
                          const baseFull = emp.baseUsd ?? 0;
                          const basePart = emp.baseAccruedUsd ?? 0;
                          const pending = Math.max(0, baseFull - basePart);
                          const dealPart = emp.dealEarningsUsd ?? 0;
                          if (cfg && pending > 0 && salaryPeriod === new Date().toISOString().slice(0, 7)) {
                            return "MyCRM";
                          }
                          return "MyCRM";
                        })(), color: "#6366F1" },
                      { label: "Выплачено", value: `$${fmt(emp.paidUsd ?? 0)}`, sub: `${emp.payments.filter((p: any) => p.isPaid).length} подтв. выплат за ${salaryPeriod}`, color: "#059669" },
                      { label: isInDebt ? "Долг (не выплачено)" : "Баланс", value: `${isInDebt ? "−" : "+"}$${fmt(Math.abs(debt))}`, sub: isInDebt ? ((debt > Math.max(0, (emp.totalAccrued ?? 0) - (emp.paidUsd ?? 0)) + 0.01) ? "С учётом прошлых месяцев" : "Требует выплаты") : "Переплата или ровно", color: isInDebt ? "#DC2626" : "#059669" },
                    ]).map(m => (
                      <div key={m.label} style={{ background: "var(--bg-card)", borderRadius: 14, padding: "18px 20px", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>{m.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Main grid: settings + history */}
                  <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>

                    {/* Left: Salary settings / AI info */}
                    <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{isAi ? "ИИ офиса" : "Настройки зарплаты"}</div>
                        {!isAi && (
                        <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                          onClick={() => openSalaryConfigModal(emp.userId, emp.name || emp.email, cfg)}>
                          {cfg ? "Изменить ставку" : "Настроить"}
                        </button>
                        )}
                      </div>
                      <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
                        {isAi ? (
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                            У каждого офиса один счёт В«ИИВ». Начисление — доля из шаблона сделок за месяц; прошлые периоды пересчитываются по данным сделок.
                          </div>
                        ) : cfg ? (
                          <>
                            <div>
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Ставка в месяц</div>
                              <div style={{ fontSize: 22, fontWeight: 700 }}>{Number(cfg.baseAmount).toLocaleString()} <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{cfg.currency}</span></div>
                              {cfg.currency !== "USD" && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>≈ ${fmt(emp.baseUsd ?? 0)} USD</div>}
                            </div>
                            <div style={{ display: "flex", gap: 20 }}>
                              <div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>День выплаты</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{cfg.payDay}-е</div>
                                {salaryPeriod === new Date().toISOString().slice(0, 7) && !(emp.baseAccrued || (emp.baseAccruedUsd ?? 0) > 0) && (
                                  <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>Ставка войдёт в начисление {cfg.payDay}-го числа</div>
                                )}
                              </div>
                              <div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>Валюта</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{cfg.currency}</div>
                              </div>
                            </div>
                            {cfg.note && (
                              <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-input)", fontSize: 12, color: "var(--text-secondary)" }}>
                                {cfg.note}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ padding: "24px 0", textAlign: "center" }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
                            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 14 }}>Ставка не настроена</div>
                            <button type="button" className="btn btn-primary" style={{ fontSize: 12 }}
                              onClick={() => openSalaryConfigModal(emp.userId, emp.name || emp.email, null)}>
                              Установить ставку
                            </button>
                          </div>
                        )}

                        {/* Deal earnings breakdown */}
                        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Сделки за {salaryPeriod}</div>
                          {emp.dealEarningsUsd > 0 ? (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Заработок по сделкам</span>
                              <span style={{ fontWeight: 700, color: "#059669", fontSize: 15 }}>${fmtDec(emp.dealEarningsUsd)}</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>Нет сделок за период</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Payment history */}
                    <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>История выплат — {salaryPeriod}</div>
                        <button type="button" className="btn btn-primary" style={{ fontSize: 12 }}
                          onClick={() => openSalaryPaymentModal(emp.userId, emp.name || emp.email, user?.activeOrganizationId ?? "", cfg?.currency ?? "USD")}>
                          + Добавить выплату
                        </button>
                      </div>

                      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
                        {emp.payments.length === 0 ? (
                          <div style={{ padding: "40px 0", textAlign: "center" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Выплат за этот период нет</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>Нажмите «+ Добавить выплату», чтобы зафиксировать</div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {emp.payments.map((p: any) => (
                              <div key={p.id} style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "12px 14px", borderRadius: 10,
                                background: p.isPaid ? "rgba(5,150,105,0.05)" : "rgba(99,102,241,0.04)",
                                border: `1px solid ${p.isPaid ? "rgba(5,150,105,0.18)" : "rgba(99,102,241,0.15)"}`,
                              }}>
                                {/* Status dot */}
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.isPaid ? "#059669" : "#94A3B8", flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.amount.toLocaleString()} {p.currency}</span>
                                    {p.currency !== "USD" && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>≈ ${fmt(p.amountUsd)}</span>}
                                    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "var(--accent-light)", color: "var(--accent)", fontWeight: 500 }}>{SALARY_PAYMENT_TYPES[p.type] ?? p.type}</span>
                                    {p.isPaid && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "rgba(5,150,105,0.12)", color: "#059669", fontWeight: 600 }}>✓ Выплачено</span>}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                                    {p.note && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.note}</span>}
                                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{new Date(p.createdAt).toLocaleDateString("ru-RU")}</span>
                                    {p.isPaid && p.paidAt && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>· выплачено {new Date(p.paidAt).toLocaleDateString("ru-RU")}</span>}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                  <button onClick={() => togglePaymentPaid(p.id, !p.isPaid)}
                                    style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                                      background: p.isPaid ? "rgba(220,38,38,0.1)" : "rgba(5,150,105,0.12)",
                                      color: p.isPaid ? "#DC2626" : "#059669" }}>
                                    {p.isPaid ? "Отменить" : "Выплатить"}
                                  </button>
                                  <button onClick={() => deleteSalaryPayment(p.id)}
                                    style={{ padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(220,38,38,0.08)", color: "#DC2626", fontSize: 13 }}>
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              );
            }

            // ── LIST VIEW ─────────────────────────────────────────────────
            return (
              <div style={{ display: "grid", gap: 16 }}>
                <div className="page-header">
                  <div className="page-header-left">
                    <div className="page-header-title">Зарплата</div>
                    <div className="page-header-sub">Учёт зарплатного фонда, долгов и выплат сотрудникам</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="month" value={salaryPeriod}
                      onChange={e => { setSalaryPeriod(e.target.value); loadSalary(e.target.value); }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
                    <button className="btn btn-secondary" onClick={() => loadSalary()}>Обновить</button>
                  </div>
                </div>

                {/* Summary strip */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  {[
                    { label: "Фонд ЗП за период", value: `$${fmt(totalFund)}`, sub: "Ставки + заработок по сделкам", color: "#6366F1", bg: "rgba(99,102,241,0.07)" },
                    { label: "Долг сотрудникам", value: `$${fmt(totalDebt)}`, sub: totalDebt > 0 ? `У ${salaryData.filter((e: any) => (e.balance ?? 0) > 0).length} сотрудников есть долг` : "Все долги погашены", color: totalDebt > 0 ? "#DC2626" : "#059669", bg: totalDebt > 0 ? "rgba(220,38,38,0.06)" : "rgba(5,150,105,0.06)" },
                    { label: "Фонд ЗП за период", value: `$${fmt(totalFund)}`, sub: "Ставки + заработок по сделкам", color: "#6366F1", bg: "rgba(99,102,241,0.07)" },
                  ].map(m => (
                    <div key={m.label} style={{ padding: "18px 22px", borderRadius: 14, background: m.bg, border: `1px solid ${m.color}22` }}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>{m.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>{m.sub}</div>
                    </div>
                  ))}
                </div>

                {salaryAiPartner && (
                  <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid rgba(139,92,246,0.35)", overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", fontWeight: 600, fontSize: 14 }}>🤖 ИИ офиса</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 110px 110px 110px 110px auto", padding: "12px 20px", gap: 8, alignItems: "center", cursor: "pointer" }}
                      onClick={() => setSelectedSalaryEmp(salaryAiPartner)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(139,92,246,0.15)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>🤖</div>
                        <div><div style={{ fontWeight: 600 }}>{salaryAiPartner.name}</div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Доля по сделкам</div></div>
                      </div>
                      <div style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: 12 }}>—</div>
                      <div style={{ textAlign: "right", fontWeight: 600, color: "#8B5CF6" }}>${fmtDec(salaryAiPartner.dealEarningsUsd ?? 0)}</div>
                      <div style={{ textAlign: "right", fontWeight: 700, color: "#8B5CF6" }}>${fmt(salaryAiPartner.totalAccrued ?? 0)}</div>
                      <div style={{ textAlign: "right", color: "#059669" }}>${fmt(salaryAiPartner.paidUsd ?? 0)}</div>
                      <div style={{ textAlign: "right", fontWeight: 700, color: (salaryAiPartner.balance ?? 0) > 0 ? "#DC2626" : "#059669" }}>
                        {(salaryAiPartner.balance ?? 0) > 0 ? "−" : "+"}${fmt(Math.abs(salaryAiPartner.balance ?? 0))}
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setSelectedSalaryEmp(salaryAiPartner); }}>Кабинет</button>
                    </div>
                  </div>
                )}

                {/* Employee table */}
                <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", fontWeight: 600, fontSize: 14 }}>
                    Сотрудники ({salaryData.length})
                  </div>
                  {salaryLoading ? (
                    <div style={{ padding: "50px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
                  ) : salaryData.length === 0 ? (
                    <div style={{ padding: "50px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Нет сотрудников в офисе</div>
                  ) : (
                    <>
                      {/* Table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 110px 110px 110px 110px auto", padding: "8px 20px", borderBottom: "1px solid var(--border-light)", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", gap: 8 }}>
                        <span>Сотрудник</span>
                        <span style={{ textAlign: "right" }}>Ставка</span>
                        <span style={{ textAlign: "right" }}>Сделки</span>
                        <span style={{ textAlign: "right" }}>Начислено</span>
                        <span style={{ textAlign: "right" }}>Выплачено</span>
                        <span style={{ textAlign: "right" }}>Баланс</span>
                        <span />
                      </div>
                      {salaryData.map((emp: any) => {
                        const cfg = emp.salaryConfig;
                        const debt = emp.balance ?? 0;
                        const isInDebt = debt > 0;
                        const avatarColor = ["#6366F1","#059669","#D97706","#DC2626","#0EA5E9"][emp.email.charCodeAt(0) % 5];

                        return (
                          <div key={emp.userId} style={{
                            display: "grid", gridTemplateColumns: "1fr 120px 110px 110px 110px 110px auto",
                            padding: "12px 20px", gap: 8, alignItems: "center",
                            borderBottom: "1px solid var(--border-light)",
                            cursor: "pointer", transition: "background 0.12s",
                          }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}
                            onClick={() => setSelectedSalaryEmp(emp)}>

                            {/* Name */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor + "22", color: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                                {(emp.name || emp.email)?.[0]?.toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.name || emp.email}</div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{ROLE_LABELS_S[emp.role] ?? emp.role}{emp.position ? ` · ${emp.position}` : ""}</div>
                              </div>
                              {cfg && <div style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--bg-input)", color: "var(--text-tertiary)" }}>ЗП {cfg.payDay}-е</div>}
                            </div>

                            {/* Base salary */}
                            <div style={{ textAlign: "right" }}>
                              {cfg ? (
                                <span style={{ fontSize: 13, fontWeight: 600 }}>${fmt(emp.baseUsd ?? 0)}</span>
                              ) : (
                                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>—</span>
                              )}
                            </div>

                            {/* Deal earnings */}
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: emp.dealEarningsUsd > 0 ? "#059669" : "var(--text-tertiary)" }}>
                                ${fmtDec(emp.dealEarningsUsd ?? 0)}
                              </span>
                            </div>

                            {/* Total accrued */}
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#6366F1" }}>${fmt(emp.totalAccrued ?? 0)}</span>
                            </div>

                            {/* Paid */}
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>${fmt(emp.paidUsd ?? 0)}</span>
                            </div>

                            {/* Balance */}
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: isInDebt ? "#DC2626" : "#059669" }}>
                                {isInDebt ? "−" : "+"}${fmt(Math.abs(debt))}
                              </span>
                              {isInDebt && <div style={{ fontSize: 10, color: "#DC2626" }}>долг</div>}
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                              <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                                onClick={() => setSelectedSalaryEmp(emp)}>
                                Кабинет →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

              </div>
            );
          })() : null}

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

              {/* Exchange Rates */}
              {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <span className="card-title">Курсы валют</span>
                      {ratesLastSync && (
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                          Обновлено: {new Date(ratesLastSync).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {user?.role === "SUPER_ADMIN" && (
                        <button className="btn btn-secondary" onClick={syncRatesNow} disabled={ratesSyncing}
                          style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                            style={{ animation: ratesSyncing ? "spin 1s linear infinite" : "none" }}>
                            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                          </svg>
                          {ratesSyncing ? "Обновление…" : "Авто-обновить"}
                        </button>
                      )}
                      <button type="button" className="btn btn-secondary" onClick={() => setRatesModalOpen(true)}>Изменить вручную</button>
                    </div>
                  </div>
                  <div className="card-body" style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {CURRENCIES.map(c => (
                        <div key={c} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: "8px 14px", minWidth: 90, textAlign: "center" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700 }}>{CURRENCY_META[c]?.symbol}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{c}</div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>1 {c} = {(1 / (exchangeRates[c] ?? 1)).toFixed(4)} USD</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>
                      Курсы обновляются автоматически каждый день в 06:00 и при запуске сервера. 1 USD — базовая валюта.
                    </div>
                  </div>
                </div>
              )}

              <DealTemplatesSettingsCard
                templates={templates}
                onCreate={() => openTemplateModal()}
                onEdit={(t) => openTemplateModal(t)}
                onDelete={handleDeleteTemplate}
              />
              {isAdmin ? (
                <>
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <span className="card-title">Клиенты — статусы воронки</span>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, maxWidth: 720, lineHeight: 1.5 }}>
                          <strong>Код</strong> — латиница для системы (не меняется). <strong>Название</strong> — как видят сотрудники в CRM.
                          <strong> Порядок</strong> — сортировка в списках. <strong>Цвет</strong> — hex, например <code style={{ fontSize: 11 }}>#3b82f6</code>.
                          <strong> Конец воронки</strong> — отметка «финальный» статус (например закрыт).
                        </div>
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={() => void loadClientStatuses()}>Обновить</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 18 }}>
                      <div style={clientFormSectionStyle(true)}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Добавить статус</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                          <div style={{ minWidth: 160 }}>
                            <div className="form-label">Код (латиница)</div>
                            <input className="form-input" value={newClientStatusSlug} onChange={(e) => setNewClientStatusSlug(e.target.value)} placeholder="naprimer_ozhidaet" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div className="form-label">Название в интерфейсе</div>
                            <input className="form-input" value={newClientStatusLabel} onChange={(e) => setNewClientStatusLabel(e.target.value)} placeholder="Например: Ожидает ответа" />
                          </div>
                          <button type="button" className="btn btn-primary" onClick={() => void addClientStatusRow()}>Добавить статус</button>
                        </div>
                      </div>
                      <div className="table-scroll" style={{ border: "1px solid var(--border-light)", borderRadius: 12, overflow: "auto" }}>
                        <table className="data-table">
                          <thead style={{ background: "var(--bg-metric)" }}>
                            <tr>
                              <th><span style={{ display: "block" }}>Код</span><span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>системный</span></th>
                              <th>Как в CRM</th>
                              <th style={{ width: 100 }}>Порядок</th>
                              <th style={{ width: 120 }}>Цвет (HEX)</th>
                              <th style={{ width: 110 }}><span style={{ display: "block" }}>Конец</span><span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>воронки</span></th>
                              <th style={{ width: 180 }}>Действия</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientStatuses.map((s) => {
                              const d = clientStatusDrafts[s.id];
                              return (
                                <tr key={s.id}>
                                  <td><code style={{ fontSize: 12 }}>{s.slug}</code></td>
                                  <td>
                                    <input className="form-input" style={{ height: 32 }} value={d?.label ?? s.label} onChange={(e) => setClientStatusDrafts((prev) => ({ ...prev, [s.id]: { ...(prev[s.id] ?? { label: s.label, sortOrder: String(s.sortOrder), color: s.color ?? "", isTerminal: s.isTerminal }), label: e.target.value } }))} />
                                  </td>
                                  <td style={{ width: 90 }}>
                                    <input className="form-input" style={{ height: 32 }} type="number" value={d?.sortOrder ?? String(s.sortOrder)} onChange={(e) => setClientStatusDrafts((prev) => ({ ...prev, [s.id]: { ...(prev[s.id] ?? { label: s.label, sortOrder: String(s.sortOrder), color: s.color ?? "", isTerminal: s.isTerminal }), sortOrder: e.target.value } }))} />
                                  </td>
                                  <td style={{ width: 110 }}>
                                    <input className="form-input" style={{ height: 32 }} value={d?.color ?? s.color ?? ""} onChange={(e) => setClientStatusDrafts((prev) => ({ ...prev, [s.id]: { ...(prev[s.id] ?? { label: s.label, sortOrder: String(s.sortOrder), color: s.color ?? "", isTerminal: s.isTerminal }), color: e.target.value } }))} />
                                  </td>
                                  <td>
                                    <input type="checkbox" checked={d?.isTerminal ?? s.isTerminal} onChange={(e) => setClientStatusDrafts((prev) => ({ ...prev, [s.id]: { ...(prev[s.id] ?? { label: s.label, sortOrder: String(s.sortOrder), color: s.color ?? "", isTerminal: s.isTerminal }), isTerminal: e.target.checked } }))} />
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button type="button" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={async () => {
                                        const dr = clientStatusDrafts[s.id];
                                        if (!dr) return;
                                        const res = await fetch(`/api/client-statuses/${s.id}`, {
                                          method: "PATCH", credentials: "include",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            label: dr.label,
                                            sortOrder: Number(dr.sortOrder) || 0,
                                            color: dr.color.trim() || null,
                                            isTerminal: dr.isTerminal,
                                          }),
                                        });
                                        if (!res.ok) {
                                          const j = await res.json().catch(() => ({}));
                                          return alert(j.message ?? "Ошибка");
                                        }
                                        await loadClientStatuses();
                                      }}>Сохранить</button>
                                      <button type="button" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => void deleteClientStatusRow(s.id)}>Удалить</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <span className="card-title">Клиенты — дополнительные поля</span>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, maxWidth: 720, lineHeight: 1.5 }}>
                          Поля появляются в форме клиента под стандартными блоками. Банк, ассистент и итог звонка уже есть отдельно.
                          Для типа «Список» в колонке вариантов укажите значения через запятую или с новой строки.
                        </div>
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={() => void loadClientFieldDefinitions()}>Обновить</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 18 }}>
                      <div style={clientFormSectionStyle(true)}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Новое поле</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                          <div style={{ minWidth: 140 }}>
                            <div className="form-label">Код поля (латиница)</div>
                            <input className="form-input" value={newClientFieldKey} onChange={(e) => setNewClientFieldKey(e.target.value)} placeholder="istochnik" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <div className="form-label">Подпись в форме</div>
                            <input className="form-input" value={newClientFieldLabel} onChange={(e) => setNewClientFieldLabel(e.target.value)} placeholder="Источник лида" />
                          </div>
                          <div style={{ width: 200 }}>
                            <div className="form-label">Тип данных</div>
                            <select className="form-input" value={newClientFieldType} onChange={(e) => setNewClientFieldType(e.target.value as FieldType)}>
                              {FIELD_TYPES_ALL.map((t) => (
                                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                              ))}
                            </select>
                          </div>
                          <button type="button" className="btn btn-primary" onClick={() => void addClientFieldRow()}>Добавить поле</button>
                        </div>
                      </div>
                      <div className="table-scroll" style={{ border: "1px solid var(--border-light)", borderRadius: 12, overflow: "auto" }}>
                        <table className="data-table">
                          <thead style={{ background: "var(--bg-metric)" }}>
                            <tr>
                              <th><span style={{ display: "block" }}>Код</span><span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>не меняется</span></th>
                              <th>Подпись</th>
                              <th style={{ width: 160 }}>Тип</th>
                              <th style={{ width: 90 }}>Порядок</th>
                              <th style={{ width: 80 }}>Обяз.</th>
                              <th style={{ minWidth: 160 }}><span style={{ display: "block" }}>Варианты</span><span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>для списка</span></th>
                              <th style={{ width: 180 }}>Действия</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientFieldDefs.map((f) => {
                              const d = clientFieldDrafts[f.id];
                              return (
                                <tr key={f.id}>
                                  <td><code style={{ fontSize: 12 }}>{f.key}</code></td>
                                  <td>
                                    <input className="form-input" style={{ height: 32 }} value={d?.label ?? f.label} onChange={(e) => setClientFieldDrafts((prev) => ({ ...prev, [f.id]: { ...(prev[f.id] ?? { label: f.label, order: String(f.order), options: f.options ?? "", type: f.type, required: f.required }), label: e.target.value } }))} />
                                  </td>
                                  <td style={{ width: 180 }}>
                                    <select className="form-input" style={{ height: 36 }} value={d?.type ?? f.type} onChange={(e) => setClientFieldDrafts((prev) => ({ ...prev, [f.id]: { ...(prev[f.id] ?? { label: f.label, order: String(f.order), options: f.options ?? "", type: f.type, required: f.required }), type: e.target.value as FieldType } }))}>
                                      {FIELD_TYPES_ALL.map((t) => (
                                        <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td style={{ width: 80 }}>
                                    <input className="form-input" style={{ height: 32 }} type="number" value={d?.order ?? String(f.order)} onChange={(e) => setClientFieldDrafts((prev) => ({ ...prev, [f.id]: { ...(prev[f.id] ?? { label: f.label, order: String(f.order), options: f.options ?? "", type: f.type, required: f.required }), order: e.target.value } }))} />
                                  </td>
                                  <td>
                                    <input type="checkbox" checked={d?.required ?? f.required} onChange={(e) => setClientFieldDrafts((prev) => ({ ...prev, [f.id]: { ...(prev[f.id] ?? { label: f.label, order: String(f.order), options: f.options ?? "", type: f.type, required: f.required }), required: e.target.checked } }))} />
                                  </td>
                                  <td style={{ minWidth: 160 }}>
                                    <input className="form-input" style={{ height: 32 }} value={d?.options ?? f.options ?? ""} onChange={(e) => setClientFieldDrafts((prev) => ({ ...prev, [f.id]: { ...(prev[f.id] ?? { label: f.label, order: String(f.order), options: f.options ?? "", type: f.type, required: f.required }), options: e.target.value } }))} />
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button type="button" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={async () => {
                                        const dr = clientFieldDrafts[f.id];
                                        if (!dr) return;
                                        const res = await fetch(`/api/client-field-definitions/${f.id}`, {
                                          method: "PATCH", credentials: "include",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            label: dr.label,
                                            type: dr.type,
                                            required: dr.required,
                                            order: Number(dr.order) || 0,
                                            options: dr.options.trim() || null,
                                          }),
                                        });
                                        if (!res.ok) {
                                          const j = await res.json().catch(() => ({}));
                                          return alert(j.message ?? "Ошибка");
                                        }
                                        await loadClientFieldDefinitions();
                                      }}>Сохранить</button>
                                      <button type="button" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => void deleteClientFieldRow(f.id)}>Удалить</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

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

              {/* Audit log — admin only */}
              {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Журнал действий</span>
                    <button className="btn btn-secondary" onClick={() => loadAuditLog(0)} style={{ fontSize: 12 }}>Обновить</button>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {auditLoading ? (
                      <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>Загрузка...</div>
                    ) : auditLog.length === 0 ? (
                      <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>Нет записей</div>
                    ) : (
                      <>
                        <div className="table-scroll">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Время</th>
                                <th>Сотрудник</th>
                                <th>Действие</th>
                                <th>Объект</th>
                                <th>IP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditLog.map((row) => (
                                <tr key={row.id}>
                                  <td style={{ whiteSpace: "nowrap", fontSize: 11, color: "var(--text-secondary)" }}>
                                    {new Date(row.createdAt).toLocaleString("ru")}
                                  </td>
                                  <td style={{ fontSize: 12 }}>
                                    <div style={{ fontWeight: 600 }}>{row.user.name || row.user.email}</div>
                                    {row.user.name && <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{row.user.email}</div>}
                                  </td>
                                  <td>
                                    <span style={{
                                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                                      background: row.action.startsWith("DELETE") ? "var(--red-bg)" : row.action.startsWith("CREATE") ? "var(--green-bg)" : row.action === "LOGIN" ? "#dbeafe" : row.action === "LOGIN_FAILED" ? "var(--red-bg)" : "var(--bg-secondary)",
                                      color: row.action.startsWith("DELETE") ? "var(--red-text)" : row.action.startsWith("CREATE") ? "var(--green-text)" : row.action === "LOGIN" ? "#1d4ed8" : row.action === "LOGIN_FAILED" ? "var(--red-text)" : "var(--text-secondary)",
                                    }}>
                                      {row.action}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                    {row.entityType ? `${row.entityType}${row.entityId ? ` #${row.entityId.slice(0, 8)}` : ""}` : "—"}
                                  </td>
                                  <td style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                                    {row.ip ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Pagination */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border-light)", fontSize: 12, color: "var(--text-secondary)" }}>
                          <span>{auditTotal} записей</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-secondary" style={{ fontSize: 11 }} disabled={auditOffset === 0} onClick={() => loadAuditLog(Math.max(0, auditOffset - AUDIT_LIMIT))}>← Назад</button>
                            <span style={{ lineHeight: "28px" }}>{Math.floor(auditOffset / AUDIT_LIMIT) + 1} / {Math.ceil(auditTotal / AUDIT_LIMIT) || 1}</span>
                            <button className="btn btn-secondary" style={{ fontSize: 11 }} disabled={auditOffset + AUDIT_LIMIT >= auditTotal} onClick={() => loadAuditLog(auditOffset + AUDIT_LIMIT)}>Вперёд →</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
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

                  {/* Active sessions card */}
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Активные сессии</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={loadSessions} style={{ fontSize: 12 }}>Обновить</button>
                        <button className="btn btn-secondary" onClick={revokeAllSessions} style={{ fontSize: 12, color: "var(--red)" }}>Завершить все другие</button>
                      </div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      {sessionsLoading ? (
                        <div style={{ padding: "16px", color: "var(--text-secondary)", fontSize: 13 }}>Загрузка...</div>
                      ) : sessions.length === 0 ? (
                        <div style={{ padding: "16px", color: "var(--text-secondary)", fontSize: 13 }}>Нет активных сессий</div>
                      ) : (
                        <div style={{ display: "grid" }}>
                          {sessions.map((s, i) => {
                            const ua = s.userAgent ?? "";
                            const isMobile = /mobile|android|iphone|ipad/i.test(ua);
                            const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)[/ ]([\d.]+)/)?.[0] ?? "Браузер неизвестен";
                            const isFirst = i === 0;
                            return (
                              <div key={s.id} style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "12px 16px",
                                borderTop: i > 0 ? "1px solid var(--border-light)" : undefined,
                                background: isFirst ? "var(--accent)06" : undefined,
                              }}>
                                <div style={{ fontSize: 22, flexShrink: 0 }}>{isMobile ? "📱" : "💻"}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    {browser}
                                    {isFirst && (
                                      <span style={{ marginLeft: 8, fontSize: 10, background: "var(--accent-light)", color: "var(--accent)", borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>текущая</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                                    IP: {s.ip ?? "—"} · Последняя активность: {new Date(s.lastActiveAt).toLocaleString("ru")}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                    Создана: {new Date(s.createdAt).toLocaleString("ru")}
                                  </div>
                                </div>
                                {!isFirst && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 12, flexShrink: 0, color: "var(--red)" }}
                                    onClick={() => revokeSession(s.id)}
                                    disabled={sessionRevoking === s.id}
                                  >
                                    {sessionRevoking === s.id ? "..." : "Завершить"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

        </div>
      </div>

      <OlxFormModal
        open={olxFormOpen}
        editingId={olxEditingId}
        form={olxForm}
        setForm={setOlxForm}
        onClose={() => { setOlxFormOpen(false); setOlxEditingId(null); }}
        onSave={() => void saveOlx()}
      />

      <MediatorFormModal
        open={mediatorFormOpen}
        editingId={mediatorEditingId}
        form={mediatorForm}
        setForm={setMediatorForm}
        onClose={() => setMediatorFormOpen(false)}
        onSave={saveMediator}
      />

      <SalaryConfigModal
        open={!!salaryConfigModal}
        userId={salaryConfigModal?.userId ?? null}
        employeeName={salaryConfigModal?.name ?? ""}
        initialConfig={salaryConfigModal?.config ?? null}
        onClose={() => setSalaryConfigModal(null)}
        onSaved={() => loadSalary()}
      />
      <SalaryPaymentModal
        open={!!salaryPaymentModal}
        userId={salaryPaymentModal?.userId ?? null}
        employeeName={salaryPaymentModal?.name ?? ""}
        orgId={salaryPaymentModal?.orgId ?? ""}
        period={salaryPeriod}
        defaultCurrency={salaryPaymentModal?.currency ?? "USD"}
        onClose={() => setSalaryPaymentModal(null)}
        onSaved={() => loadSalary()}
      />

      <ExchangeRatesModal
        open={ratesModalOpen}
        exchangeRates={exchangeRates}
        onClose={() => setRatesModalOpen(false)}
        onSaved={() => loadExchangeRates()}
      />

      <TemplateWizardModal
        open={templateModalOpen}
        editing={templateEditing}
        onClose={() => {
          setTemplateModalOpen(false);
          setTemplateEditing(null);
        }}
        onSaved={() => {
          setTemplateModalOpen(false);
          setTemplateEditing(null);
          loadTemplates();
        }}
      />

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
                placeholder="%"
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
