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

type Tab = "dashboard" | "deals" | "clients" | "expenses" | "reports" | "settings" | "profile" | "staff" | "mediators" | "olx" | "tasks" | "assistant" | "chat" | "salary";
type DealStatus = "NEW" | "IN_PROGRESS" | "CLOSED";
type OperationType = "PURCHASE" | "ATM" | "TRANSFER";
type FieldType = "TEXT" | "NUMBER" | "SELECT" | "DATE" | "PERCENT" | "CHECKBOX" | "CURRENCY";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "РўРµРєСЃС‚",
  NUMBER: "Р§РёСЃР»Рѕ",
  SELECT: "РЎРїРёСЃРѕРє",
  DATE: "Р”Р°С‚Р°",
  PERCENT: "РџСЂРѕС†РµРЅС‚",
  CHECKBOX: "Р”Р° / РЅРµС‚",
  CURRENCY: "РЎСѓРјРјР°",
};

const FIELD_TYPES_ALL: FieldType[] = ["TEXT", "NUMBER", "SELECT", "DATE", "PERCENT", "CHECKBOX", "CURRENCY"];

type TemplateField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  order: number;
  options?: string | null;
};

function slugifyFieldKey(label: string, i: number): string {
  return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_Р°-СЏС‘]/gi, "") || `field_${i}`;
}

// в”Ђв”Ђв”Ђ Template type в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
type DealTemplate = {
  id: string;
  name: string;
  hasWorkers: boolean;
  incomeFieldKey?: string | null;
  fields: TemplateField[];
  calcPreset?: string | null;
  payrollPoolPct?: string | number | null;
  calcGrossFieldKey?: string | null;
  calcMediatorPctKey?: string | null;
  calcAiPctKey?: string | null;
  calcSteps?: CalcStep[] | null;
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
  client?: { id: string; name: string; phone: string; status?: ClientPipelineStatus | null } | null;
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
  mediatorLink?: { mediatorId: string; pct: string | number; mediator: { id: string; name: string } } | null;
  olxLink?: { olxId: string; pct: string | number; olx: { id: string; name: string } } | null;
  infoPct?: number | string | null;
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
  PURCHASE: "РџРѕРєСѓРїРєР°",
  ATM: "Р‘Р°РЅРєРѕРјР°С‚",
  TRANSFER: "РџРµСЂРµРІРѕРґ",
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
  const [tplName, setTplName] = useState("");
  const [tplHasWorkers, setTplHasWorkers] = useState(true);
  const [tplIncomeFieldKey, setTplIncomeFieldKey] = useState("");
  const [tplFields, setTplFields] = useState<Array<{ _id: string; key?: string; label: string; type: FieldType; required: boolean; options: string }>>([]);
  const [tplCalcPreset, setTplCalcPreset] = useState<"" | typeof CALC_MEDIATOR_AI_PAYROLL>("");
  const [tplPayrollPoolPct, setTplPayrollPoolPct] = useState("20");
  const [tplCalcGrossKey, setTplCalcGrossKey] = useState("");
  const [tplCalcMediatorKey, setTplCalcMediatorKey] = useState("");
  const [tplCalcAiKey, setTplCalcAiKey] = useState("");
  const [tplWizardStep, setTplWizardStep] = useState<"type" | "fields">("type");
  const [tplCalcSteps, setTplCalcSteps] = useState<CalcStep[]>([]);

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
  // AbortController for task comment loading вЂ” cancels previous request on rapid clicks
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
    SUPER_ADMIN: "РЎСѓРїРµСЂ РђРґРјРёРЅ",
    ADMIN: "РђРґРјРёРЅ РѕС„РёСЃР°",
    MANAGER: "РњРµРЅРµРґР¶РµСЂ",
    WORKER: "Р Р°Р±РѕС‚РЅРёРє",
  };

  const title = useMemo(() => {
    if (tab === "dashboard") return isWorker ? "РњРѕР№ РєР°Р±РёРЅРµС‚" : "Р”Р°С€Р±РѕСЂРґ";
    if (tab === "deals") return "РЎРґРµР»РєРё";
    if (tab === "clients") return "РљР»РёРµРЅС‚С‹";
    if (tab === "expenses") return "Р Р°СЃС…РѕРґС‹";
    if (tab === "reports") return "РћС‚С‡С‘С‚С‹";
    if (tab === "settings") return "РќР°СЃС‚СЂРѕР№РєРё";
    if (tab === "profile") return "РњРѕР№ РїСЂРѕС„РёР»СЊ";
    if (tab === "staff") return "РЎРѕС‚СЂСѓРґРЅРёРєРё";
    if (tab === "mediators") return "РџРѕСЃСЂРµРґРЅРёРєРё";
    if (tab === "olx") return "РћР›РҐ";
    if (tab === "tasks") return "Р—Р°РґР°С‡Рё";
    if (tab === "chat") return "Р§Р°С‚";
    if (tab === "assistant") return "AI РђСЃСЃРёСЃС‚РµРЅС‚";
    if (tab === "salary") return "Р—Р°СЂРїР»Р°С‚Р°";
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
        alert(j.message || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РєСѓСЂСЃС‹");
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
    if (!confirm("РЈРґР°Р»РёС‚СЊ СЃРґРµР»РєСѓ? Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ РЅРµР»СЊР·СЏ РѕС‚РјРµРЅРёС‚СЊ.")) return;
    const res = await fetch(`/api/deals/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok || res.status === 204) {
      setDeals(ds => ds.filter(d => d.id !== id));
    } else {
      alert("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ СЃРґРµР»РєСѓ");
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
      alert("РќСѓР¶РµРЅ С„Р°Р№Р» .xlsx");
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
        alert(j.message || "РћС€РёР±РєР° РёРјРїРѕСЂС‚Р°");
        return;
      }
      const withParts = Array.isArray(j.deals) ? j.deals.filter((d: { participantsAssigned?: boolean }) => d.participantsAssigned).length : 0;
      const msg = [`РЎРѕР·РґР°РЅРѕ СЃРґРµР»РѕРє: ${j.created ?? 0}`, withParts ? `РЎ РІРѕСЂРєРµСЂР°РјРё (%): ${withParts}` : ""].filter(Boolean);
      if (j.errors?.length) msg.push(`РЎС‚СЂРѕРєРё СЃ Р·Р°РјРµС‡Р°РЅРёСЏРјРё:\n${j.errors.slice(0, 8).join("\n")}`);
      if (j.templateId) msg.push(`РЁР°Р±Р»РѕРЅ: В«Р›РµРіР°СЃРё (РёРјРїРѕСЂС‚)В»`);
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
    if (!mediatorForm.name.trim()) return alert("РЈРєР°Р¶РёС‚Рµ РёРјСЏ");
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
    if (!res.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ");
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
    if (!confirm("РЈРґР°Р»РёС‚СЊ РїРѕСЃСЂРµРґРЅРёРєР°? Р•СЃР»Рё РµСЃС‚СЊ СЃРґРµР»РєРё вЂ” Р±СѓРґРµС‚ РґРµР°РєС‚РёРІРёСЂРѕРІР°РЅ.")) return;
    const res = await fetch(`/api/mediators/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ");
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
    if (!olxForm.name.trim()) return alert("РЈРєР°Р¶РёС‚Рµ РёРјСЏ");
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
    if (!res.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ");
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
    if (!confirm("РЈРґР°Р»РёС‚СЊ РћР›РҐ? Р•СЃР»Рё РµСЃС‚СЊ СЃРґРµР»РєРё вЂ” Р±СѓРґРµС‚ РґРµР°РєС‚РёРІРёСЂРѕРІР°РЅ.")) return;
    const res = await fetch(`/api/olx/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ");
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
    if (!confirm("РЈРґР°Р»РёС‚СЊ Р·Р°РїРёСЃСЊ Рѕ РІС‹РїР»Р°С‚Рµ?")) return;
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
    // MANAGER РЅРµС‚ РґРѕСЃС‚СѓРїР° Рє GET /api/users вЂ” РёСЃРїРѕР»СЊР·СѓРµРј public (С‚РѕС‚ Р¶Рµ org, С‡С‚Рѕ РІ activeOrganization)
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
      return alert((e as { message?: string }).message ?? "РћС€РёР±РєР°");
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
    alert((e as { message?: string }).message ?? "РћС€РёР±РєР°");
    return false;
  }

  async function deleteTaskById(id: string) {
    if (!confirm("РЈРґР°Р»РёС‚СЊ Р·Р°РґР°С‡Сѓ?")) return;
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
    // Read from ref вЂ” always current even inside a stale setInterval closure
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
    else { const e = await res.json().catch(() => ({})); alert(e.message ?? "РћС€РёР±РєР°"); }
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
        setAgentHistory(h => [...h, { role: "assistant", content: `вќЊ РћС€РёР±РєР° СЃРµСЂРІРµСЂР° (${res.status}): ${errText.slice(0, 200)}` }]);
        return;
      }
      const j = await res.json();
      const content = j.text || j.answer || j.message || j.error || "РќРµС‚ РѕС‚РІРµС‚Р° РѕС‚ AI";
      const assistantMsg = { role: "assistant" as const, content, pendingAction: j.pendingAction };
      setAgentHistory(h => [...h, assistantMsg]);
      if (j.pendingAction) setAgentPending(j.pendingAction);
    } catch (e: any) {
      setAgentHistory(h => [...h, { role: "assistant", content: `вќЊ РћС€РёР±РєР° СЃРµС‚Рё: ${e.message}` }]);
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
          setAgentHistory(h => [...h, { role: "assistant", content: `вќЊ РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ СЃРґРµР»РєРё: ${err.message ?? res.status}` }]);
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
        setAgentHistory(h => [...h, { role: "assistant", content: `вњ… РЎРґРµР»РєР° СЃРѕР·РґР°РЅР°!\n${partsText ? `рџ‘Ґ ${partsText}` : ""}\nРћС‚РєСЂРѕР№С‚Рµ РІРєР»Р°РґРєСѓ В«РЎРґРµР»РєРёВ» С‡С‚РѕР±С‹ РїРѕСЃРјРѕС‚СЂРµС‚СЊ.` }]);
      } else if (agentPending.type === "create_expense") {
        const p = agentPending.params;
        const res = await fetch("/api/expenses", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: p.title || p.description || "Р Р°СЃС…РѕРґ",
            amount: p.amount,
            currency: p.currency ?? "USD",
            payMethod: p.payMethod ?? "РќР°Р»РёС‡РЅС‹Рµ",
          }),
        });
        if (res.ok) {
          setAgentHistory(h => [...h, { role: "assistant", content: "вњ… Р Р°СЃС…РѕРґ Р·Р°РїРёСЃР°РЅ!" }]);
        } else {
          const err = await res.json().catch(() => ({}));
          setAgentHistory(h => [...h, { role: "assistant", content: `вќЊ РћС€РёР±РєР° Р·Р°РїРёСЃРё СЂР°СЃС…РѕРґР°: ${err.message ?? res.status}` }]);
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
            { role: "assistant", content: `вњ… РљР°СЂС‚РѕС‡РєР° РєР»РёРµРЅС‚Р° СЃРѕР·РґР°РЅР°${name ? `: ${name}` : ""}.\nРЎРїРёСЃРѕРє РІРѕ РІРєР»Р°РґРєРµ В«РљР»РёРµРЅС‚С‹В» РѕР±РЅРѕРІР»С‘РЅ; РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё РѕС‚РєСЂРѕР№С‚Рµ РµС‘ РёР»Рё В«Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊВ» РІ РєР°СЂС‚РѕС‡РєРµ.` },
          ]);
        } else {
          const err = await res.json().catch(() => ({}));
          setAgentHistory((h) => [
            ...h,
            { role: "assistant", content: `вќЊ РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РєР»РёРµРЅС‚Р°: ${err.message ?? res.status}` },
          ]);
        }
      }
    } catch (e: any) {
      setAgentHistory(h => [...h, { role: "assistant", content: `вќЊ ${e.message}` }]);
    }
  }

  function startVoice() {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Р‘СЂР°СѓР·РµСЂ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ РіРѕР»РѕСЃРѕРІРѕР№ РІРІРѕРґ. РСЃРїРѕР»СЊР·СѓР№С‚Рµ Chrome РёР»Рё Edge."); return; }
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
        label: f.label ?? `РџРѕР»Рµ ${i + 1}`,
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
      if (!res.ok) { setProfileError(j?.message ?? "РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ"); return; }
      setProfile(j);
      setProfileSuccess("РџСЂРѕС„РёР»СЊ СЃРѕС…СЂР°РЅС‘РЅ");
      setTimeout(() => setProfileSuccess(null), 3000);
    } finally { setProfileSaving(false); }
  }

  async function changePassword() {
    setPwdError(null); setPwdSuccess(null);
    if (!pwdOld) return setPwdError("Р’РІРµРґРёС‚Рµ С‚РµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ");
    if (!pwdNew) return setPwdError("Р’РІРµРґРёС‚Рµ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ");
    if (pwdNew.length < 6) return setPwdError("РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ РјРёРЅРёРјСѓРј 6 СЃРёРјРІРѕР»РѕРІ");
    if (pwdNew !== pwdConfirm) return setPwdError("РџР°СЂРѕР»Рё РЅРµ СЃРѕРІРїР°РґР°СЋС‚");
    setPwdSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: pwdOld, newPassword: pwdNew }),
      });
      const j = await res.json();
      if (!res.ok) { setPwdError(j?.message ?? "РћС€РёР±РєР°"); return; }
      setPwdSuccess("РџР°СЂРѕР»СЊ РёР·РјРµРЅС‘РЅ");
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
    if (!confirm("Р—Р°РІРµСЂС€РёС‚СЊ РІСЃРµ РґСЂСѓРіРёРµ СЃРµСЃСЃРёРё?")) return;
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

  function openTemplateModal(tpl?: DealTemplate) {
    setTemplateEditing(tpl ?? null);
    setTplName(tpl?.name ?? "");
    setTplHasWorkers(tpl?.hasWorkers ?? true);
    setTplIncomeFieldKey(tpl?.incomeFieldKey ?? "");
    const preset = tpl?.calcPreset === CALC_MEDIATOR_AI_PAYROLL ? CALC_MEDIATOR_AI_PAYROLL : ("" as const);
    setTplCalcPreset(preset);
    setTplPayrollPoolPct(
      tpl?.calcPreset === CALC_MEDIATOR_AI_PAYROLL && tpl.payrollPoolPct != null
        ? String(Number(tpl.payrollPoolPct as number))
        : "20",
    );
    setTplCalcGrossKey(tpl?.calcGrossFieldKey ?? "");
    setTplCalcMediatorKey(tpl?.calcMediatorPctKey ?? "");
    setTplCalcAiKey(tpl?.calcAiPctKey ?? "");
    setTplFields(
      tpl?.fields.map((f) => ({
        _id: f.id,
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.options ?? "",
      })) ?? []
    );
    setTplCalcSteps(Array.isArray(tpl?.calcSteps) ? (tpl!.calcSteps as CalcStep[]) : []);
    setTplWizardStep(tpl ? "fields" : "type");
    setTemplateModalOpen(true);
  }

  /** РРЅРёС†РёР°Р»РёР·РёСЂСѓРµС‚ РїРѕР»СЏ Рё С†РµРїРѕС‡РєСѓ РґР»СЏ СЃС…РµРјС‹ РїРѕСЃСЂРµРґРЅРёРє в†’ AI в†’ Р—Рџ С„РѕРЅРґ */
  function applyMediatorAiPresetFields() {
    const fixed: Array<{ _id: string; key: string; label: string; type: FieldType; required: boolean; options: string }> = [
      { _id: "fixed_gross",    key: "СЃСѓРјРјР°_Р·Р°РІРѕРґР°",       label: "РЎСѓРјРјР° Р·Р°РІРѕРґР°",          type: "NUMBER",  required: true,  options: "" },
      { _id: "fixed_mediator", key: "РїСЂРѕС†РµРЅС‚_РїРѕСЃСЂРµРґРЅРёРєР°", label: "% РїРѕСЃСЂРµРґРЅРёРєР°",          type: "PERCENT", required: true,  options: "" },
      { _id: "fixed_ai",       key: "РїСЂРѕС†РµРЅС‚_Р°Рё",         label: "% AI",                  type: "PERCENT", required: true,  options: "" },
      { _id: "fixed_payroll",  key: "РїСЂРѕС†РµРЅС‚_Р·Рї_С„РѕРЅРґР°",   label: "% Р·Р°СЂРїР»Р°С‚РЅРѕРіРѕ С„РѕРЅРґР°",   type: "PERCENT", required: true,  options: "" },
    ];
    const presetSteps: CalcStep[] = [
      {
        id: "step_mediator",
        label: "Р’С‹РїР»Р°С‚Р° РїРѕСЃСЂРµРґРЅРёРєР°",
        sourceType: "field",
        sourceId: "СЃСѓРјРјР°_Р·Р°РІРѕРґР°",
        deductType: "percent",
        deductFieldKey: "РїСЂРѕС†РµРЅС‚_РїРѕСЃСЂРµРґРЅРёРєР°",
        resultLabel: "РџРѕСЃР»Рµ РїРѕСЃСЂРµРґРЅРёРєР° (R1)",
        isMediatorShare: true,
        isPayrollPool: false,
      },
      {
        id: "step_ai",
        label: "Р”РѕР»СЏ AI",
        sourceType: "step",
        sourceId: "step_mediator",
        deductType: "percent",
        deductFieldKey: "РїСЂРѕС†РµРЅС‚_Р°Рё",
        resultLabel: "РџРѕСЃР»Рµ AI (R2)",
        isAiShare: true,
        isPayrollPool: false,
      },
      {
        id: "step_payroll",
        label: "Р—Р°СЂРїР»Р°С‚РЅС‹Р№ С„РѕРЅРґ",
        sourceType: "step",
        sourceId: "step_ai",
        deductType: "percent",
        deductFieldKey: "РїСЂРѕС†РµРЅС‚_Р·Рї_С„РѕРЅРґР°",
        resultLabel: "РџСЂРёР±С‹Р»СЊ РѕС„РёСЃР°",
        isPayrollPool: true,
      },
    ];
    setTplCalcPreset(CALC_MEDIATOR_AI_PAYROLL);
    setTplCalcSteps(presetSteps);
    setTplHasWorkers(true);
    setTplCalcGrossKey("СЃСѓРјРјР°_Р·Р°РІРѕРґР°");
    setTplCalcMediatorKey("РїСЂРѕС†РµРЅС‚_РїРѕСЃСЂРµРґРЅРёРєР°");
    setTplCalcAiKey("РїСЂРѕС†РµРЅС‚_Р°Рё");
    setTplIncomeFieldKey("СЃСѓРјРјР°_Р·Р°РІРѕРґР°");
    setTplFields((prev) => {
      const existing = prev.filter((f) => !["fixed_gross","fixed_mediator","fixed_ai","fixed_payroll"].includes(f._id));
      return [...fixed, ...existing];
    });
  }

  function addTplField() {
    setTplFields((prev) => [...prev, { _id: crypto.randomUUID(), label: "", type: "TEXT", required: false, options: "" }]);
  }

  async function saveTemplate() {
    if (!tplName.trim()) return alert("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ С€Р°Р±Р»РѕРЅР°");
    if (tplFields.length === 0) return alert("Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ РїРѕР»Рµ");
    for (const f of tplFields) {
      if (!f.label.trim()) return alert("РЈ РІСЃРµС… РїРѕР»РµР№ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РЅР°Р·РІР°РЅРёРµ");
    }

    // Validate calc chain if configured
    if (tplCalcSteps.length > 0) {
      const fields2 = tplFields.map((f, i) => ({ key: f.key || slugifyFieldKey(f.label, i), label: f.label }));
      const fieldKeys = new Set(fields2.map(x => x.key));
      for (const step of tplCalcSteps) {
        if (!step.label.trim()) return alert("РЈ РєР°Р¶РґРѕРіРѕ С€Р°РіР° С†РµРїРѕС‡РєРё РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РЅР°Р·РІР°РЅРёРµ");
        if (!step.deductFieldKey) return alert(`РЁР°Рі В«${step.label}В»: СѓРєР°Р¶РёС‚Рµ РїРѕР»Рµ РґР»СЏ РІС‹С‡РёС‚Р°РЅРёСЏ`);
        if (!fieldKeys.has(step.deductFieldKey)) return alert(`РЁР°Рі В«${step.label}В»: РїРѕР»Рµ В«${step.deductFieldKey}В» РЅРµ РЅР°Р№РґРµРЅРѕ РІ РїРѕР»СЏС… С€Р°Р±Р»РѕРЅР°`);
        if (step.sourceType === "field" && step.sourceId && !fieldKeys.has(step.sourceId))
          return alert(`РЁР°Рі В«${step.label}В»: РїРѕР»Рµ-РёСЃС‚РѕС‡РЅРёРє В«${step.sourceId}В» РЅРµ РЅР°Р№РґРµРЅРѕ`);
      }
    }

    // Legacy validation for old preset (when no calcSteps)
    if (tplCalcPreset === CALC_MEDIATOR_AI_PAYROLL && tplCalcSteps.length === 0) {
      if (!tplCalcGrossKey || !tplCalcMediatorKey || !tplCalcAiKey) {
        return alert("Р”Р»СЏ С†РµРїРѕС‡РєРё В«РџРѕСЃСЂРµРґРЅРёРє в†’ РР в†’ С„РѕРЅРґВ» СѓРєР°Р¶РёС‚Рµ РїРѕР»СЏ: СЃСѓРјРјР° Р·Р°РІРѕРґР°, % РїРѕСЃСЂРµРґРЅРёРєР°, % РР");
      }
    }

    const fields = tplFields.map((f, i) => ({
      key: f.key || slugifyFieldKey(f.label, i),
      label: f.label,
      type: f.type,
      required: f.required,
      order: i,
      options: f.options.trim() || null,
    }));

    const hasChain = tplCalcSteps.length > 0;
    const payload: Record<string, unknown> = {
      name: tplName,
      hasWorkers: (hasChain || tplCalcPreset === CALC_MEDIATOR_AI_PAYROLL) ? true : tplHasWorkers,
      incomeFieldKey: tplIncomeFieldKey || null,
      fields,
      calcSteps: hasChain ? tplCalcSteps : null,
    };

    if (!hasChain && tplCalcPreset === CALC_MEDIATOR_AI_PAYROLL) {
      payload.calcPreset = CALC_MEDIATOR_AI_PAYROLL;
      payload.calcGrossFieldKey = tplCalcGrossKey;
      payload.calcMediatorPctKey = tplCalcMediatorKey;
      payload.calcAiPctKey = tplCalcAiKey;
    } else {
      payload.calcPreset = hasChain ? null : null;
    }

    if (templateEditing) {
      const res = await fetch(`/api/deal-templates/${templateEditing.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const detail = j?.message ?? j?.error ?? `HTTP ${res.status}`;
        return alert(`РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ С€Р°Р±Р»РѕРЅР°:\n${Array.isArray(detail) ? detail.join("\n") : detail}`);
      }
    } else {
      const res = await fetch("/api/deal-templates", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const detail = j?.message ?? j?.error ?? `HTTP ${res.status}`;
        return alert(`РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ С€Р°Р±Р»РѕРЅР°:\n${Array.isArray(detail) ? detail.join("\n") : detail}`);
      }
    }
    setTemplateModalOpen(false);
    loadTemplates();
  }

  async function deleteTemplate(id: string, name: string) {
    if (!confirm(`РЈРґР°Р»РёС‚СЊ С€Р°Р±Р»РѕРЅ "${name}"? РЎСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ СЃРґРµР»РєРё РЅРµ Р±СѓРґСѓС‚ Р·Р°С‚СЂРѕРЅСѓС‚С‹.`)) return;
    await fetch(`/api/deal-templates/${id}`, { method: "DELETE", credentials: "include" });
    loadTemplates();
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
    if (!confirm("РРјРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ СЃРґРµР»РєРё РёР· Excel? РЎСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ СЃС‚СЂРѕРєРё РЅРµ СѓРґР°Р»СЏСЋС‚СЃСЏ.")) return;
    setAccountingImporting(true);
    try {
      const result = await importAccountingXlsx(file);
      if (!result.ok) {
        if (result.unauthorized) { router.replace("/login"); return; }
        alert(result.message);
        return;
      }
      const { created, skipped, errors } = result.result;
      const errText = errors.length ? `\n\nРћС€РёР±РєРё:\n${errors.slice(0, 8).join("\n")}` : "";
      alert(`РРјРїРѕСЂС‚ Р·Р°РІРµСЂС€С‘РЅ.\nРЎРѕР·РґР°РЅРѕ: ${created}\nРџСЂРѕРїСѓС‰РµРЅРѕ: ${skipped}${errText}`);
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
    if (!res.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РѕС„РёСЃ");
    setNewOrgName("");
    await loadOrgs();
  }

  async function switchOrg(orgId: string) {
    const res = await fetch("/api/orgs/switch", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId }),
    });
    if (!res.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ РїРµСЂРµРєР»СЋС‡РёС‚СЊСЃСЏ");
    setOrgSwitchOpen(false);
    // Reload user to get new activeOrganizationId, then reload current tab
    const meRes = await fetch("/api/auth/me", { credentials: "include" });
    if (meRes.ok) { const j = await meRes.json(); setUser(j.user); }
    loadDeals(); loadClients(); loadExpenses(); loadDashboard();
  }

  async function deleteOrg(orgId: string, orgName: string) {
    if (!confirm(`РЈРґР°Р»РёС‚СЊ РѕС„РёСЃ "${orgName}"?\n\nР’РќРРњРђРќРР•: СѓРґР°Р»СЏС‚СЃСЏ РІСЃРµ СЃРґРµР»РєРё, РєР»РёРµРЅС‚С‹, СЂР°СЃС…РѕРґС‹ Рё РїРѕР»СЊР·РѕРІР°С‚РµР»Рё СЌС‚РѕРіРѕ РѕС„РёСЃР°!`)) return;
    const res = await fetch(`/api/orgs/${orgId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.message ?? "РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РѕС„РёСЃ");
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
    if (!confirm("РЈРґР°Р»РёС‚СЊ СЃС‚Р°С‚СѓСЃ?")) return;
    const res = await fetch(`/api/client-statuses/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return alert(j.message ?? "РќРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ");
    }
    await loadClientStatuses();
  }

  async function addClientStatusRow() {
    const slug = newClientStatusSlug.trim().toLowerCase();
    const label = newClientStatusLabel.trim();
    if (!slug || !label) return alert("Slug Рё РЅР°Р·РІР°РЅРёРµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹ (slug: Р»Р°С‚РёРЅРёС†Р°, РЅР°РїСЂРёРјРµСЂ follow_up)");
    const res = await fetch("/api/client-statuses", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, label }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return alert(j.message ?? "РћС€РёР±РєР°");
    }
    setNewClientStatusSlug(""); setNewClientStatusLabel("");
    await loadClientStatuses();
  }

  async function deleteClientFieldRow(id: string) {
    if (!confirm("РЈРґР°Р»РёС‚СЊ РїРѕР»Рµ? Р—РЅР°С‡РµРЅРёСЏ РІ РєР°СЂС‚РѕС‡РєР°С… РѕСЃС‚Р°РЅСѓС‚СЃСЏ РІ JSON, РЅРѕ РїРѕР»Рµ СЃРєСЂРѕРµС‚СЃСЏ.")) return;
    const res = await fetch(`/api/client-field-definitions/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return alert("РћС€РёР±РєР°");
    await loadClientFieldDefinitions();
  }

  async function addClientFieldRow() {
    const key = newClientFieldKey.trim().toLowerCase();
    const label = newClientFieldLabel.trim();
    if (!key || !label) return alert("РљР»СЋС‡ Рё РїРѕРґРїРёСЃСЊ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹");
    const res = await fetch("/api/client-field-definitions", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, label, type: newClientFieldType }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return alert(j.message ?? "РћС€РёР±РєР°");
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
      return alert(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ:\n${Array.isArray(msg) ? msg.join("\n") : msg}`);
    }
    setNewUserLogin(""); setNewUserName(""); setNewUserPassword(""); setNewUserPosition(""); setNewUserTargetOrgId("");
    await loadUsers();
    await loadOrgs();
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`РЈРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ "${email}"?`)) return;
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return alert(j?.message ?? "РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ");
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
    if (!res.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РґРѕР»Р¶РЅРѕСЃС‚СЊ");
    setUserPositionId(null); setUserPositionValue("");
    await loadUsers();
  }

  async function changeUserRole(userId: string, role: "ADMIN" | "MANAGER") {
    const res = await fetch("/api/users/role", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРјРµРЅРёС‚СЊ СЂРѕР»СЊ");
    await loadUsers();
  }

  async function resetUserPassword(userId: string) {
    if (!userPwdValue.trim()) return alert("Р’РІРµРґРёС‚Рµ РїР°СЂРѕР»СЊ");
    const res = await fetch("/api/users/password", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password: userPwdValue }),
    });
    if (!res.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ СЃР±СЂРѕСЃРёС‚СЊ РїР°СЂРѕР»СЊ");
    setUserPwdId(null); setUserPwdValue("");
    alert("РџР°СЂРѕР»СЊ РѕР±РЅРѕРІР»С‘РЅ");
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

  /** РљР»СЋС‡ РїРѕР»СЏ В«% РїРѕСЃСЂРµРґРЅРёРєР°В» РІ РґР°РЅРЅС‹С… С€Р°Р±Р»РѕРЅР° (РґР»СЏ СЂР°СЃС‡С‘С‚Р°). */
  function mediatorPctFieldKey(tpl: DealTemplate | null | undefined): string | null {
    if (!tpl) return null;
    if (tpl.calcMediatorPctKey) return tpl.calcMediatorPctKey;
    if (tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL) {
      const f = tpl.fields.find(
        (field) =>
          field.type === "PERCENT" &&
          (field.key.includes("РїРѕСЃСЂРµРґРЅРёРє") || field.label.toLowerCase().includes("РїРѕСЃСЂРµРґРЅРёРє")),
      );
      return f?.key ?? null;
    }
    const steps = tpl.calcSteps as CalcStep[] | null | undefined;
    if (steps?.length) {
      const step = steps.find(
        (s) =>
          s.label.toLowerCase().includes("РїРѕСЃСЂРµРґРЅРёРє") ||
          (s.deductFieldKey && s.deductFieldKey.includes("РїРѕСЃСЂРµРґРЅРёРє")),
      );
      return step?.deductFieldKey ?? null;
    }
    return null;
  }

  /** РЎРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚ % РїРѕСЃСЂРµРґРЅРёРєР° РІ Р±Р»РѕРєРµ РІС‹Р±РѕСЂР° Рё РІ РґР°РЅРЅС‹С… СЃС‚СЂРѕРєРё С€Р°Р±Р»РѕРЅР° (РѕС‚ СЌС‚РѕРіРѕ СЃС‡РёС‚Р°РµС‚СЃСЏ РІС‹РїР»Р°С‚Р°). */
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
      alert("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С€Р°Р±Р»РѕРЅС‹");
      return;
    }
    const list: DealTemplate[] = await tRes.json();
    setTemplates(list);
    if (list.length === 0) {
      alert("РЎРѕР·РґР°Р№С‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ С€Р°Р±Р»РѕРЅ СЃРґРµР»РєРё: РќР°СЃС‚СЂРѕР№РєРё в†’ Р±Р»РѕРє В«РЁР°Р±Р»РѕРЅС‹ СЃРґРµР»РѕРєВ».");
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
    if (total === 100) return { ok: true, text: "вњ“ РС‚РѕРіРѕ: 100%", color: "var(--green)" };
    if (total > 100) return { ok: false, text: `вљ  РС‚РѕРіРѕ: ${total}% вЂ” РїСЂРµРІС‹С€Р°РµС‚ 100%`, color: "var(--red)" };
    return { ok: false, text: `вљ  РС‚РѕРіРѕ: ${total}% вЂ” РЅРµ С…РІР°С‚Р°РµС‚ ${100 - total}%`, color: "var(--amber)" };
  }, [dealParticipants]);

  const participantIncomeInfo = useMemo(() => {
    const activeTpl = dealTemplateId ? templates.find((t) => t.id === dealTemplateId) : null;
    if (!activeTpl) {
      return { base: dealTotals.tAmountOut, label: "СЃСѓРјРјР° В«РїРѕР»СѓС‡РёР»РёВ»" };
    }
    // New: universal calc chain
    if (activeTpl.calcSteps && activeTpl.calcSteps.length > 0 && dealDataRows[0]) {
      const chain = computeChain(dealDataRows[0].data, activeTpl.calcSteps);
      const payrollStep = chain.find((c) => c.step.isPayrollPool);
      const base = payrollStep
        ? Math.max(0, payrollStep.deductAmt)
        : chain.length > 0 ? Math.max(0, chain[chain.length - 1].result) : 0;
      const label = payrollStep
        ? `Р—Р°СЂРїР»Р°С‚РЅС‹Р№ С„РѕРЅРґ (${payrollStep.step.label})`
        : chain.length > 0 ? chain[chain.length - 1].step.resultLabel : "Р РµР·СѓР»СЊС‚Р°С‚ СЂР°СЃС‡С‘С‚Р°";
      return { base, label };
    }
    // Legacy: MEDIATOR_AI_PAYROLL
    if (activeTpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && dealDataRows[0]) {
      const c = computeMediatorAiPayroll(dealDataRows[0].data, activeTpl);
      if (c) return { base: c.F, label: "Р·Р°СЂРїР»Р°С‚РЅС‹Р№ С„РѕРЅРґ (F), РїРѕСЃР»Рµ AI/Р°РІС‚РѕРјР°С‚РёРєРё" };
    }
    if (activeTpl.incomeFieldKey) {
      const sum = dealDataRows.reduce((s, row) => s + (Number(row.data[activeTpl.incomeFieldKey!]) || 0), 0);
      const incField = activeTpl.fields.find((f) => f.key === activeTpl.incomeFieldKey);
      return { base: sum, label: incField?.label || activeTpl.incomeFieldKey || "" };
    }
    return { base: 0, label: "" };
  }, [dealTemplateId, templates, dealDataRows, dealTotals.tAmountOut]);

  async function saveDeal() {
    const activeTpl = dealTemplateId ? templates.find((t) => t.id === dealTemplateId) : null;
    if (!dealEditingId && !activeTpl) {
      alert("Р’С‹Р±РµСЂРёС‚Рµ С€Р°Р±Р»РѕРЅ СЃРґРµР»РєРё");
      return;
    }
    const needWorkers = activeTpl ? activeTpl.hasWorkers : true;

    const parts = dealParticipants.filter((p) => p.userId).map((p) => ({ userId: p.userId, pct: Number(p.pct) || 0 }));
    if (needWorkers && parts.length > 0) {
      const totalPct = parts.reduce((s, p) => s + p.pct, 0);
      if (totalPct !== 100) return alert("РџСЂРѕС†РµРЅС‚С‹ СѓС‡Р°СЃС‚РЅРёРєРѕРІ РґРѕР»Р¶РЅС‹ СЃСѓРјРјР°СЂРЅРѕ Р±С‹С‚СЊ 100%");
    }

    const selectedClient = dealClientId ? dealClients.find((c) => c.id === dealClientId) : null;
    const tplName2 = activeTpl ? ` [${activeTpl.name}]` : "";
    const titleText = selectedClient ? `РЎРґРµР»РєР° вЂ” ${selectedClient.name}${tplName2}` : `РЎРґРµР»РєР°${tplName2}`;

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
        if (!dRes.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ СЃРґРµР»РєСѓ");
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
        if (!upd.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃРґРµР»РєСѓ");
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
        if (totalPct !== 100) return alert("РџСЂРѕС†РµРЅС‚С‹ СѓС‡Р°СЃС‚РЅРёРєРѕРІ РґРѕР»Р¶РЅС‹ СЃСѓРјРјР°СЂРЅРѕ Р±С‹С‚СЊ 100%");
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
        if (!dRes.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ СЃРґРµР»РєСѓ");
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
        if (!upd.ok) return alert("РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃРґРµР»РєСѓ");
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
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", lineHeight: 1, textTransform: "uppercase", letterSpacing: "0.5px" }}>РћС„РёСЃ</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                {orgs.find((o) => o.id === user?.activeOrganizationId)?.name ?? "вЂ¦"}
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
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{o._count.users} РїРѕР»СЊР·. В· {o._count.deals} СЃРґРµР»РѕРє</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="sidebar-nav">
          {(() => {
            const NAV_LABELS: Record<string, string> = {
              dashboard: isWorker ? "РњРѕР№ РєР°Р±РёРЅРµС‚" : "Р”Р°С€Р±РѕСЂРґ",
              deals: "РЎРґРµР»РєРё", clients: "РљР»РёРµРЅС‚С‹",
              expenses: "Р Р°СЃС…РѕРґС‹", reports: "РћС‚С‡С‘С‚С‹",
              staff: "РЎРѕС‚СЂСѓРґРЅРёРєРё", mediators: "РџРѕСЃСЂРµРґРЅРёРєРё", olx: "РћР›РҐ", salary: "Р—Р°СЂРїР»Р°С‚Р°", tasks: "Р—Р°РґР°С‡Рё", chat: "Р§Р°С‚",
              assistant: "AI РђСЃСЃРёСЃС‚РµРЅС‚", settings: "РќР°СЃС‚СЂРѕР№РєРё", profile: "РџСЂРѕС„РёР»СЊ"
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
                <div className="nav-section">РљР»РёРµРЅС‚С‹</div>
                {renderItem("clients")}
                {renderItem("assistant")}
                <div className="nav-divider" />
                <div className="nav-section">Р—Р°РґР°С‡Рё Рё С‡Р°С‚</div>
                {renderItem("tasks")}
                {renderItem("chat")}
                <div className="nav-divider" />
                <div className="nav-section">РђРєРєР°СѓРЅС‚</div>
                {renderItem("profile")}
              </>);
            }

            return (<>
              {renderItem("dashboard")}
              <div className="nav-divider" />
              <div className="nav-section">РџСЂРѕРґР°Р¶Рё</div>
              {renderItem("deals")}
              {renderItem("clients")}
              <div className="nav-divider" />
              <div className="nav-section">Р¤РёРЅР°РЅСЃС‹</div>
              {renderItem("expenses")}
              {isAdmin && renderItem("reports")}
              {isAdmin && renderItem("salary")}
              <div className="nav-divider" />
              <div className="nav-section">РљРѕРјР°РЅРґР°</div>
              {isAdmin && renderItem("staff")}
              {isManager && renderItem("mediators")}
              {isManager && renderItem("olx")}
              {renderItem("tasks")}
              {renderItem("chat")}
              <div className="nav-divider" />
              <div className="nav-section">РЎРёСЃС‚РµРјР°</div>
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
              <div className="sidebar-user-name">{user?.email ?? "вЂ¦"}</div>
              <div className="sidebar-user-role">{user ? (ROLE_LABELS[user.role] ?? user.role) : "вЂ¦"}</div>
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
                <span>{theme === "dark" ? "РЎРІРµС‚Р»Р°СЏ" : "РўС‘РјРЅР°СЏ"}</span>
              </span>
              <span className={`theme-toggle-pill${theme === "dark" ? " is-dark" : ""}`} />
            </button>
            <a className="nav-item" style={{ padding: "7px 10px", flexShrink: 0 }} onClick={logout} title="Р’С‹Р№С‚Рё">
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
              Р—Р°РіСЂСѓР·РєР°вЂ¦
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

          {/* ===== DEALS ===== */}          {/* ===== DEALS ===== */}
          {tab === "deals" ? (
            <div style={{ display: "grid", gap: 16 }}>
              {/* Page header */}
              <div className="page-header">
                <div className="page-header-left">
                  <div className="page-header-title">РЎРґРµР»РєРё</div>
                  <div className="page-header-sub">РЈРїСЂР°РІР»СЏР№С‚Рµ СЃРґРµР»РєР°РјРё, СѓС‡Р°СЃС‚РЅРёРєР°РјРё Рё РІС‹РїР»Р°С‚Р°РјРё</div>
                </div>
                <div className="page-header-actions">
                  <div className="filter-tabs">
                    {([{ id: "ALL", label: "Р’СЃРµ" }, { id: "NEW", label: "РќРѕРІС‹Рµ" }, { id: "IN_PROGRESS", label: "Р’ СЂР°Р±РѕС‚Рµ" }, { id: "CLOSED", label: "Р—Р°РєСЂС‹С‚С‹Рµ" }] as const).map((f) => (
                      <button key={f.id} className={`filter-tab ${dealFilter === f.id ? "active" : ""}`} onClick={() => setDealFilter(f.id as any)}>{f.label}</button>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={openDealModal}>+ РќРѕРІР°СЏ СЃРґРµР»РєР°</button>
                  {isManager && (
                    <>
                      <input
                        className="form-input"
                        style={{ width: 72 }}
                        title="Р“РѕРґ РґР»СЏ РґР°С‚ В«23.04В» (Р±РµР· РіРѕРґР° РІ СЏС‡РµР№РєРµ)"
                        value={legacyImportYear}
                        onChange={(e) => setLegacyImportYear(e.target.value)}
                      />
                      <input
                        ref={legacyImportInputRef}
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void importLegacyDeals(f);
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={legacyImporting}
                        onClick={() => legacyImportInputRef.current?.click()}
                      >
                        {legacyImporting ? "РРјРїРѕСЂС‚вЂ¦" : "РРјРїРѕСЂС‚ Excel"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-body table-scroll" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Р”Р°С‚Р°</th><th>РљР»РёРµРЅС‚</th><th>Р’РѕСЂРєРµСЂС‹</th><th>РЎС‚Р°С‚СѓСЃ</th>
                        <th style={{ textAlign: "right" }}>Р’С‹С…РѕРґ</th>
                        {isAdmin && <th style={{ width: 40 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {dealsLoading ? (
                        <tr><td colSpan={6} style={{ padding: 24, color: "var(--text-secondary)" }}>Р—Р°РіСЂСѓР·РєР°...</td></tr>
                      ) : deals.filter((d) => dealFilter === "ALL" || d.status === dealFilter).length === 0 ? (
                        <tr><td colSpan={6}>
                          <div className="empty-state">
                            <div className="empty-state-icon">
                              <svg width="22" height="22" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                            </div>
                            <div className="empty-state-title">РќРµС‚ СЃРґРµР»РѕРє</div>
                            <div className="empty-state-desc">РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІСѓСЋ СЃРґРµР»РєСѓ С‡С‚РѕР±С‹ РЅР°С‡Р°С‚СЊ РІРµСЃС‚Рё СѓС‡С‘С‚</div>
                            <button className="btn btn-primary" onClick={openDealModal}>+ РќРѕРІР°СЏ СЃРґРµР»РєР°</button>
                          </div>
                        </td></tr>
                      ) : (
                        deals
                          .filter((d) => dealFilter === "ALL" || d.status === dealFilter)
                          .map((d) => {
                            let totalOut = d.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
                            let dealCurrencyLabel = d.amounts[0]?.currencyOut ?? "";
                            if (totalOut === 0 && d.template && d.dataRows && d.dataRows.length > 0) {
                              const rowData = (d.dataRows[0] as any).data as Record<string, string>;
                              const tpl = d.template as DealTemplate;
                              // find currency field
                              const currField = tpl.fields?.find((f: any) => f.type === "CURRENCY");
                              if (currField) dealCurrencyLabel = rowData[currField.key] ?? "";
                              if (Array.isArray(tpl.calcSteps) && tpl.calcSteps.length > 0) {
                                const chain = computeChain(rowData, tpl.calcSteps as CalcStep[]);
                                if (chain.length > 0) totalOut = chain[0].source;
                              } else if (tpl.incomeFieldKey) {
                                totalOut = Number(rowData[tpl.incomeFieldKey]) || 0;
                              } else if (tpl.calcGrossFieldKey) {
                                totalOut = Number(rowData[tpl.calcGrossFieldKey]) || 0;
                              }
                            }
                            const workerParts = d.participants.map((p) => {
                              const label = p.user.name || p.user.email.split("@")[0];
                              return `${label} ${p.pct}%`;
                            }).join(" В· ");
                            return (
                              <tr key={d.id} style={{ cursor: "pointer" }}>
                                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} onClick={() => openDealEditModal(d)}>
                                  {d.dealDate ? new Date(d.dealDate).toLocaleDateString("ru-RU") : "вЂ”"}
                                </td>
                                <td onClick={() => openDealEditModal(d)}>{d.client ? d.client.name : <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Р‘РµР· РєР»РёРµРЅС‚Р°</span>}</td>
                                <td style={{ fontSize: 12, color: "var(--text-secondary)" }} onClick={() => openDealEditModal(d)}>{workerParts || "вЂ”"}</td>
                                <td onClick={() => openDealEditModal(d)}>
                                  <span className={`badge ${d.status === "CLOSED" ? "badge-green" : d.status === "IN_PROGRESS" ? "badge-amber" : "badge-blue"}`}>
                                    {d.status === "NEW" ? "РќРѕРІР°СЏ" : d.status === "IN_PROGRESS" ? "Р’ СЂР°Р±РѕС‚Рµ" : "Р—Р°РєСЂС‹С‚Р°"}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }} onClick={() => openDealEditModal(d)}>
                                  {totalOut > 0 ? `${totalOut.toLocaleString("ru-RU")}${dealCurrencyLabel ? " " + dealCurrencyLabel : ""}` : "вЂ”"}
                                </td>
                                {isAdmin && (
                                  <td style={{ width: 40, padding: "0 8px 0 0" }}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteDeal(d.id); }}
                                      className="btn btn-ghost"
                                      style={{ width: 28, height: 28, padding: 0, color: "var(--text-tertiary)" }}
                                      title="РЈРґР°Р»РёС‚СЊ СЃРґРµР»РєСѓ"
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
                        <span className="card-title">{dealEditingId ? "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ СЃРґРµР»РєСѓ" : "РќРѕРІР°СЏ СЃРґРµР»РєР°"}</span>
                        {dealTemplateStep === "form" && dealTemplateId && (
                          <span style={{ fontSize: 11, background: "var(--accent-light)", color: "var(--accent)", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                            {templates.find(t => t.id === dealTemplateId)?.name}
                          </span>
                        )}
                      </div>
                      <button className="btn btn-secondary" onClick={closeDealModal}>РћС‚РјРµРЅР°</button>
                    </div>

                    {/* Template picker step */}
                    {!dealEditingId && dealTemplateStep === "pick" ? (
                      <div className="card-body" style={{ display: "grid", gap: 14 }}>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Р’С‹Р±РµСЂРёС‚Рµ С€Р°Р±Р»РѕРЅ СЃРґРµР»РєРё:</div>
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
                                  {t.fields.length} РїРѕР»РµР№ В· {t.hasWorkers ? "СЃ РІРѕСЂРєРµСЂР°РјРё" : "Р±РµР· РІРѕСЂРєРµСЂРѕРІ"}
                                  {t.calcPreset === CALC_MEDIATOR_AI_PAYROLL ? " В· СЂР°СЃС‡С‘С‚ РїРѕСЃСЂРµРґРЅРёРє/РР/С„РѕРЅРґ" : ""}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              if (!dealTemplateId) {
                                alert("Р’С‹Р±РµСЂРёС‚Рµ С€Р°Р±Р»РѕРЅ");
                                return;
                              }
                              setDealTemplateStep("form");
                            }}
                          >
                            РџСЂРѕРґРѕР»Р¶РёС‚СЊ в†’
                          </button>
                        </div>
                      </div>
                    ) : (

                    <div className="card-body" style={{ display: "grid", gap: 18 }}>

                      {/* Date + Client */}
                      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 14 }}>
                        <div>
                          <div className="form-label">Р”Р°С‚Р° *</div>
                          <input className="form-input" type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">РљР»РёРµРЅС‚</div>
                          {!dealClientSkip && !dealClientId ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <input className="form-input" placeholder="РџРѕРёСЃРє..." value={dealClientSearch} onChange={(e) => setDealClientSearch(e.target.value)} />
                                <button className="btn btn-secondary" onClick={() => setDealClientSkip(true)}>Р‘РµР· РєР»РёРµРЅС‚Р°</button>
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
                              <span style={{ flex: 1, fontWeight: 600, color: "var(--green-text)" }}>{dealClients.find((c) => c.id === dealClientId)?.name ?? "РљР»РёРµРЅС‚"}</span>
                              <button className="btn btn-secondary" onClick={() => setDealClientId(null)}>Г—</button>
                            </div>
                          ) : (
                            <div style={{ background: "var(--bg-metric)", borderRadius: 10, padding: "8px 12px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                              Р‘РµР· РєР»РёРµРЅС‚Р°{" "}
                              <span style={{ color: "var(--accent)", cursor: "pointer", fontStyle: "normal", marginLeft: 8 }} onClick={() => setDealClientSkip(false)}>РР·РјРµРЅРёС‚СЊ</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{ width: 240 }}>
                        <div className="form-label">РЎС‚Р°С‚СѓСЃ</div>
                        <select className="form-input" value={dealStatus} onChange={(e) => setDealStatus(e.target.value as DealStatus)}>
                          <option value="NEW">РќРѕРІР°СЏ</option>
                          <option value="IN_PROGRESS">Р’ СЂР°Р±РѕС‚Рµ</option>
                          <option value="CLOSED">Р—Р°РєСЂС‹С‚Р°</option>
                        </select>
                      </div>

                      {dealTemplateId && (() => {
                        const tplM = templates.find((t) => t.id === dealTemplateId);
                        const showMediator = tplM?.calcPreset === CALC_MEDIATOR_AI_PAYROLL || (tplM?.calcSteps && (tplM.calcSteps as CalcStep[]).length > 0);
                        if (!showMediator) return null;
                        const mediatorFieldKey = mediatorPctFieldKey(tplM);
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, padding: "12px 14px", background: "var(--bg-metric)", borderRadius: 10, border: "1px solid var(--border-light)" }}>
                            <div>
                              <div className="form-label">РџРѕСЃСЂРµРґРЅРёРє</div>
                              <select className="form-input" value={dealMediatorId} onChange={(e) => setDealMediatorSelection(e.target.value)}>
                                <option value="">вЂ” РЅРµ РІС‹Р±СЂР°РЅ вЂ”</option>
                                {mediators.filter((m: any) => m.isActive !== false).map((m: any) => (
                                  <option key={m.id} value={m.id}>{m.name}{m.defaultPct != null ? ` (${m.defaultPct}%)` : ""}</option>
                                ))}
                              </select>
                              {mediatorFieldKey && (
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                                  % РёР· СЃРїСЂР°РІРѕС‡РЅРёРєР° РїРѕРґСЃС‚Р°РІР»СЏРµС‚СЃСЏ РІ СЂР°СЃС‡С‘С‚{dealMediatorPct ? ` (СЃРµР№С‡Р°СЃ ${dealMediatorPct}%)` : ""}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="form-label">% РїРѕ СЃРґРµР»РєРµ</div>
                              <input
                                className="form-input"
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                placeholder="%"
                                value={dealMediatorPct}
                                onChange={(e) => applyDealMediatorPct(e.target.value)}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {dealTemplateId && (() => {
                        const tplM = templates.find((t) => t.id === dealTemplateId);
                        const show = tplM?.calcPreset === CALC_MEDIATOR_AI_PAYROLL || (tplM?.calcSteps && (tplM.calcSteps as CalcStep[]).length > 0);
                        if (!show) return null;
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, padding: "12px 14px", background: "var(--bg-metric)", borderRadius: 10, border: "1px solid var(--border-light)" }}>
                            <div>
                              <div className="form-label">РћР›РҐ</div>
                              <select className="form-input" value={dealOlxId} onChange={(e) => setDealOlxSelection(e.target.value)}>
                                <option value="">вЂ” РЅРµ РІС‹Р±СЂР°РЅ вЂ”</option>
                                {olxList.filter((o: any) => o.isActive !== false).map((o: any) => (
                                  <option key={o.id} value={o.id}>{o.name}{o.defaultPct != null ? ` (${o.defaultPct}%)` : ""}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div className="form-label">% РїРѕ СЃРґРµР»РєРµ</div>
                              <input className="form-input" type="number" min={0} max={100} step="0.01" placeholder="%" value={dealOlxPct} onChange={(e) => setDealOlxPct(e.target.value)} />
                            </div>
                          </div>
                        );
                      })()}

                      {dealTemplateId && (() => {
                        const tplM = templates.find((t) => t.id === dealTemplateId);
                        const showPartner =
                          tplM?.calcPreset === CALC_MEDIATOR_AI_PAYROLL ||
                          (tplM?.calcSteps && (tplM.calcSteps as CalcStep[]).length > 0);
                        if (!showPartner) return null;
                        return (
                          <div
                            style={{
                              padding: "12px 14px",
                              background: "rgba(100,116,139,0.08)",
                              borderRadius: 10,
                              border: "1px solid var(--border-light)",
                            }}
                          >
                            <div className="form-label" style={{ fontWeight: 600 }}>РРЅС„Рѕ</div>
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                              РџСЂРѕС†РµРЅС‚ РѕС‚ <b>Р·Р°СЂРїР»Р°С‚РЅРѕРіРѕ С„РѕРЅРґР°</b> СЌС‚РѕР№ СЃРґРµР»РєРё (РїРѕСЃР»Рµ РїРѕСЃСЂРµРґРЅРёРєР°, РћР›РҐ Рё РР). РЈ РєР°Р¶РґРѕР№ СЃРґРµР»РєРё СЃРІРѕР№ %.
                            </div>
                            <div style={{ maxWidth: 200 }}>
                              <div className="form-label">% РРЅС„Рѕ</div>
                              <input className="form-input" type="number" min={0} max={100} step="0.01" placeholder="РЅР°РїСЂРёРјРµСЂ 5" value={dealInfoPct} onChange={(e) => setDealInfoPct(e.target.value)} />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Template-based fields OR classic amounts */}
                      {dealTemplateId && templates.find(t => t.id === dealTemplateId) ? (() => {
                        const tpl = templates.find(t => t.id === dealTemplateId)!;
                        return (
                          <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                              <div className="form-label" style={{ margin: 0 }}>Р”Р°РЅРЅС‹Рµ [{tpl.name}]</div>
                              {tpl.calcPreset !== CALC_MEDIATOR_AI_PAYROLL && (
                                <button className="btn btn-secondary" onClick={() => setDealDataRows(p => [...p, { _id: crypto.randomUUID(), data: {} }])}>+ Р”РѕР±Р°РІРёС‚СЊ СЃС‚СЂРѕРєСѓ</button>
                              )}
                            </div>
                            {tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && (
                              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>РћРґРЅР° СЃС‚СЂРѕРєР° РЅР° СЃРґРµР»РєСѓ. Р Р°СЃС‡С‘С‚ РїРѕ РїРѕР»СЏРј: СЃСѓРјРјР° Р·Р°РІРѕРґР°, % РїРѕСЃСЂРµРґРЅРёРєР°, % РР (РѕС‚ РѕСЃС‚Р°С‚РєР° РїРѕСЃР»Рµ РїРѕСЃСЂРµРґРЅРёРєР°), Р·Р°С‚РµРј {parsePayrollPoolPct(tpl)}% РІ Р·Р°СЂРїР»Р°С‚РЅС‹Р№ С„РѕРЅРґ.</div>
                            )}
                            {dealDataRows.map((row, ri) => (
                              <div key={row._id} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>РЎС‚СЂРѕРєР° {ri + 1}</span>
                                  {dealDataRows.length > 1 && (
                                    <span style={{ cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }} onClick={() => setDealDataRows(p => p.filter(x => x._id !== row._id))}>Г—</span>
                                  )}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                                  {tpl.fields.map((f) => {
                                    if (
                                      (tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL ||
                                        (tpl.calcSteps && (tpl.calcSteps as CalcStep[]).length > 0)) &&
                                      mediatorPctFieldKey(tpl) === f.key
                                    ) {
                                      return null;
                                    }
                                    const isGross = tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && f.key === tpl.calcGrossFieldKey;
                                    const isMediator = tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && f.key === tpl.calcMediatorPctKey;
                                    const isAi = tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && f.key === tpl.calcAiPctKey;
                                    const calcBadge = isGross ? { icon: "рџ’°", color: "var(--accent)", tip: "Р‘Р°Р·Р° СЂР°СЃС‡С‘С‚Р°" }
                                      : isMediator ? { icon: "рџЏ¦", color: "var(--amber)", tip: "% РїРѕСЃСЂРµРґРЅРёРєР°" }
                                      : isAi ? { icon: "рџ¤–", color: "var(--text-secondary)", tip: "% AI" }
                                      : null;
                                    return (
                                    <div key={f.key} style={calcBadge ? { background: `${calcBadge.color}0d`, borderRadius: 8, padding: "6px 8px", border: `1.5px solid ${calcBadge.color}44` } : {}}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                                        {calcBadge && <span title={calcBadge.tip} style={{ fontSize: 13 }}>{calcBadge.icon}</span>}
                                        <span className="form-label" style={{ margin: 0 }}>{f.label}{f.required ? " *" : ""}</span>
                                      </div>
                                      {f.type === "CURRENCY" ? (
                                        <select className="form-input" value={row.data[f.key] ?? ""}
                                          onChange={(e) => setDealDataRows(p => p.map(x => x._id === row._id ? { ...x, data: { ...x.data, [f.key]: e.target.value } } : x))}
                                          style={{ borderColor: calcBadge ? `${calcBadge.color}66` : undefined }}>
                                          <option value="">вЂ” РІР°Р»СЋС‚Р° вЂ”</option>
                                          {CURRENCIES.map(c => (
                                            <option key={c} value={c}>{CURRENCY_META[c]?.symbol} {c} вЂ” {CURRENCY_META[c]?.name}</option>
                                          ))}
                                        </select>
                                      ) : f.type === "SELECT" ? (
                                        <select className="form-input" value={row.data[f.key] ?? ""}
                                          onChange={(e) => setDealDataRows(p => p.map(x => x._id === row._id ? { ...x, data: { ...x.data, [f.key]: e.target.value } } : x))}>
                                          <option value="">вЂ” РІС‹Р±РµСЂРёС‚Рµ вЂ”</option>
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
                                          style={{ fontFamily: f.type === "NUMBER" || f.type === "PERCENT" ? "'JetBrains Mono', monospace" : undefined, borderColor: calcBadge ? `${calcBadge.color}66` : undefined }}
                                        />
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {/* === Universal Calc Chain block === */}
                            {(tpl.calcSteps && tpl.calcSteps.length > 0) && (() => {
                              const data = dealDataRows[0]?.data ?? {};
                              const chain = computeChain(data, tpl.calcSteps!);
                              const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
                              const hasValues = chain.some(c => c.source > 0);
                              return (
                                <div style={{ marginTop: 8, padding: 14, background: "var(--accent)08", borderRadius: 10, border: "2px solid var(--accent)33" }}>
                                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                    рџ“Љ Р Р°СЃС‡С‘С‚ СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ
                                    {!hasValues && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>вЂ” Р·Р°РїРѕР»РЅРёС‚Рµ С‡РёСЃР»РѕРІС‹Рµ РїРѕР»СЏ РІС‹С€Рµ</span>}
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3px 16px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                                    {chain.map((cr, ci) => {
                                      const isPayroll = cr.step.isPayrollPool;
                                      const isLast = ci === chain.length - 1;
                                      const deductField = tpl.fields.find(f => f.key === cr.step.deductFieldKey);
                                      const deductLabel = deductField?.label ?? cr.step.deductFieldKey;
                                      return (
                                        <React.Fragment key={cr.step.id}>
                                          {ci === 0 && (
                                            <>
                                              <span style={{ color: "var(--text-secondary)" }}>
                                                {cr.step.sourceType === "field"
                                                  ? (tpl.fields.find(f => f.key === cr.step.sourceId)?.label ?? cr.step.sourceId)
                                                  : cr.step.sourceId}
                                              </span>
                                              <span style={{ textAlign: "right", fontWeight: 700 }}>{fmt(cr.source)}</span>
                                            </>
                                          )}
                                          <span style={{ color: isPayroll ? "var(--amber)" : "var(--text-tertiary)", paddingLeft: 8 }}>
                                            {isPayroll ? "рџ‘Ґ" : "в€’"} {cr.step.label} ({deductLabel})
                                          </span>
                                          <span style={{ textAlign: "right", color: isPayroll ? "var(--amber)" : "var(--text-tertiary)", fontWeight: isPayroll ? 700 : 400 }}>
                                            в€’ {fmt(cr.deductAmt)}
                                          </span>
                                          <span style={{
                                            color: isLast ? "var(--green)" : "var(--text-secondary)",
                                            fontWeight: isLast ? 700 : 400,
                                            borderTop: "1px dashed var(--border)", paddingTop: 3,
                                          }}>
                                            {isLast ? "рџЏў " : ""}{cr.step.resultLabel}
                                          </span>
                                          <span style={{
                                            textAlign: "right", fontWeight: isLast ? 700 : 400,
                                            color: isLast ? "var(--green)" : undefined,
                                            borderTop: "1px dashed var(--border)", paddingTop: 3,
                                          }}>
                                            {fmt(cr.result)}
                                          </span>
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                            {/* === Legacy MEDIATOR_AI_PAYROLL block (for old templates) === */}
                            {(!tpl.calcSteps || tpl.calcSteps.length === 0) && tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && (() => {
                              const c = dealDataRows[0] ? computeMediatorAiPayroll(dealDataRows[0].data, tpl) : null;
                              const fmt = (n: number) => n > 0 ? n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : "0";
                              const grossField = tpl.fields.find(f => f.key === tpl.calcGrossFieldKey);
                              return (
                                <div style={{ marginTop: 8, padding: 14, background: "var(--accent)08", borderRadius: 10, border: "2px solid var(--accent)33" }}>
                                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                    рџ“Љ Р Р°СЃС‡С‘С‚ СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ
                                    {(!c || c.G === 0) && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 4 }}>вЂ” Р·Р°РїРѕР»РЅРёС‚Рµ {grossField?.label ?? "РЎСѓРјРјР° Р·Р°РІРѕРґР°"} рџ’° РІС‹С€Рµ</span>}
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 16px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                                    <span style={{ color: "var(--text-secondary)" }}>рџ’° РЎСѓРјРјР° Р·Р°РІРѕРґР°</span><span style={{ textAlign: "right", fontWeight: 700 }}>{fmt(c?.G ?? 0)}</span>
                                    <span style={{ color: "var(--text-tertiary)" }}>рџЏ¦ РџРѕСЃСЂРµРґРЅРёРє</span><span style={{ textAlign: "right", color: "var(--text-tertiary)" }}>в€’ {fmt(c?.M ?? 0)}</span>
                                    <span style={{ color: "var(--text-secondary)", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>R1</span><span style={{ textAlign: "right", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>{fmt(c?.R1 ?? 0)}</span>
                                    <span style={{ color: "var(--text-tertiary)" }}>рџ¤– AI</span><span style={{ textAlign: "right", color: "var(--text-tertiary)" }}>в€’ {fmt(c?.A ?? 0)}</span>
                                    <span style={{ color: "var(--text-secondary)", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>R2</span><span style={{ textAlign: "right", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>{fmt(c?.R2 ?? 0)}</span>
                                    <span style={{ color: "var(--amber)" }}>рџ‘Ґ Р—Рџ С„РѕРЅРґ ({parsePayrollPoolPct(tpl)}%)</span><span style={{ textAlign: "right", color: "var(--amber)", fontWeight: 700 }}>в€’ {fmt(c?.F ?? 0)}</span>
                                    <span style={{ fontWeight: 700, color: "var(--green)", borderTop: "2px solid var(--border)", paddingTop: 4 }}>рџЏў РџСЂРёР±С‹Р»СЊ РѕС„РёСЃР°</span><span style={{ textAlign: "right", fontWeight: 700, color: "var(--green)", borderTop: "2px solid var(--border)", paddingTop: 4 }}>{fmt(c?.P ?? 0)}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })() : (
                      <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div className="form-label" style={{ margin: 0 }}>РћРїРµСЂР°С†РёРё (РєР»Р°СЃСЃРёРєР°, Р±РµР· С€Р°Р±Р»РѕРЅР°) *</div>
                          <button className="btn btn-secondary" onClick={() => setDealAmounts((p) => [...p, newAmtRow()])}>+ Р”РѕР±Р°РІРёС‚СЊ СЃС‚СЂРѕРєСѓ</button>
                        </div>

                        <div style={{ display: "grid", gap: 10 }}>
                          {dealAmounts.map((r) => (
                            <div key={r.id} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: 14 }}>
                              {/* row 1: bank, type, shopName */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr 28px", gap: 8, marginBottom: 8, alignItems: "end" }}>
                                <div>
                                  <div className="form-label" style={{ marginBottom: 3 }}>Р‘Р°РЅРє</div>
                                  <input
                                    className="form-input"
                                    value={r.bank}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, bank: e.target.value } : x))}
                                    placeholder="ING, PKO BP..."
                                  />
                                </div>
                                <div>
                                  <div className="form-label" style={{ marginBottom: 3 }}>РўРёРї</div>
                                  <select
                                    className="form-input"
                                    value={r.operationType}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, operationType: e.target.value as OperationType } : x))}
                                  >
                                    <option value="ATM">Р‘Р°РЅРєРѕРјР°С‚</option>
                                    <option value="PURCHASE">РџРѕРєСѓРїРєР°</option>
                                    <option value="TRANSFER">РџРµСЂРµРІРѕРґ</option>
                                  </select>
                                </div>
                                <div>
                                  {r.operationType === "PURCHASE" ? (
                                    <>
                                      <div className="form-label" style={{ marginBottom: 3 }}>РњР°РіР°Р·РёРЅ</div>
                                      <input
                                        className="form-input"
                                        value={r.shopName}
                                        onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, shopName: e.target.value } : x))}
                                        placeholder="РќР°Р·РІР°РЅРёРµ РјР°РіР°Р·РёРЅР°"
                                      />
                                    </>
                                  ) : <div />}
                                </div>
                                <div
                                  style={{ width: 28, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18 }}
                                  onClick={() => setDealAmounts((p) => p.filter((x) => x.id !== r.id))}
                                >Г—</div>
                              </div>

                              {/* row 2: amountIn + currencyIn в†’ amountOut + currencyOut */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 24px 1fr 90px", gap: 8, alignItems: "end" }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>Р’Р·СЏР»Рё</div>
                                  <input
                                    className="form-input"
                                    value={r.amountIn}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, amountIn: e.target.value } : x))}
                                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>Р’Р°Р»СЋС‚Р°</div>
                                  <select
                                    className="form-input"
                                    value={r.currencyIn}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, currencyIn: e.target.value } : x))}
                                  >
                                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                                  </select>
                                </div>
                                <div style={{ textAlign: "center", color: "var(--text-tertiary)", paddingBottom: 8 }}>в†’</div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", marginBottom: 3 }}>РџРѕР»СѓС‡РёР»Рё</div>
                                  <input
                                    className="form-input"
                                    value={r.amountOut}
                                    onChange={(e) => setDealAmounts((p) => p.map((x) => x.id === r.id ? { ...x, amountOut: e.target.value } : x))}
                                    style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--green)" }}
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", marginBottom: 3 }}>Р’Р°Р»СЋС‚Р°</div>
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
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>РС‚РѕРіРѕ РІР·СЏР»Рё</div>
                            <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>{dealTotals.tAmountIn.toLocaleString()}</div>
                          </div>
                          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "8px 10px" }}>
                            <div style={{ fontSize: 10, color: "var(--green)", textTransform: "uppercase" }}>РС‚РѕРіРѕ РїРѕР»СѓС‡РёР»Рё</div>
                            <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "var(--green)" }}>{dealTotals.tAmountOut.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Participants */}
                      {(() => {
                        const incomeBase = participantIncomeInfo.base;
                        const activeTplForParts = dealTemplateId ? templates.find(t => t.id === dealTemplateId) : null;
                        const isMediator = activeTplForParts?.calcPreset === CALC_MEDIATOR_AI_PAYROLL;
                        const filledParticipants = dealParticipants.filter(p => p.userId);
                        const totalPct = dealParticipants.reduce((s, p) => s + (Number(p.pct) || 0), 0);
                        const remaining = 100 - totalPct;

                        function splitEvenly() {
                          const filled = dealParticipants.filter(p => p.userId);
                          if (filled.length === 0) return;
                          const base = Math.floor(100 / filled.length);
                          const rem = 100 - base * filled.length;
                          setDealParticipants(prev => {
                            let extra = rem;
                            return prev.map(p => {
                              if (!p.userId) return p;
                              const add = extra > 0 ? 1 : 0;
                              extra -= add;
                              return { ...p, pct: String(base + add) };
                            });
                          });
                        }

                        return (
                          <div style={{ border: `2px solid ${isMediator ? "var(--accent)44" : "var(--border)"}`, borderRadius: 14, overflow: "hidden" }}>
                            {/* Header */}
                            <div style={{ padding: "12px 16px", background: isMediator ? "var(--accent)08" : "var(--bg-metric)", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                                  рџ‘Ґ Р—Р°СЂРїР»Р°С‚Р° СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ
                                  {totalPct === 100 && filledParticipants.length > 0 && (
                                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--green-bg)", color: "var(--green-text)", fontWeight: 600 }}>вњ“ СЂР°СЃРїСЂРµРґРµР»РµРЅРѕ</span>
                                  )}
                                </div>
                                {isMediator && incomeBase > 0 ? (
                                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                                    Р¤РѕРЅРґ РґР»СЏ СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ:&nbsp;
                                    <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--accent)", fontSize: 14 }}>{incomeBase.toLocaleString()}</strong>
                                    &nbsp;вЂ” СЌС‚Рѕ {parsePayrollPoolPct(activeTplForParts!)}% РѕС‚ СЃСѓРјРјС‹ РїРѕСЃР»Рµ РІСЃРµС… РІС‹С‡РµС‚РѕРІ. Р Р°Р·РґРµР»Рё 100% СЌС‚РѕР№ СЃСѓРјРјС‹ РјРµР¶РґСѓ СЃРѕС‚СЂСѓРґРЅРёРєР°РјРё.
                                  </div>
                                ) : incomeBase > 0 ? (
                                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                                    Р‘Р°Р·Р°: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{incomeBase.toLocaleString()}</strong> В· СѓРєР°Р¶Рё % РєР°Р¶РґРѕРјСѓ СЃРѕС‚СЂСѓРґРЅРёРєСѓ, РІ СЃСѓРјРјРµ 100%
                                  </div>
                                ) : (
                                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-tertiary)" }}>РЈРєР°Р¶Рё СЃСѓРјРјС‹ РІ РїРѕР»СЏС… РІС‹С€Рµ вЂ” СЃСЂР°Р·Сѓ СѓРІРёРґРёС€СЊ СЃРєРѕР»СЊРєРѕ РїРѕР»СѓС‡РёС‚ РєР°Р¶РґС‹Р№</div>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                {filledParticipants.length > 1 && (
                                  <button className="btn btn-secondary" style={{ fontSize: 12, height: 32 }} onClick={splitEvenly} title="Р Р°Р·РґРµР»РёС‚СЊ РїРѕСЂРѕРІРЅСѓ">вљ–пёЏ РџРѕСЂРѕРІРЅСѓ</button>
                                )}
                                <button className="btn btn-secondary" style={{ fontSize: 12, height: 32 }} onClick={() => setDealParticipants((p) => [...p, { id: crypto.randomUUID(), userId: "", pct: remaining > 0 ? String(remaining) : "0" }])}>
                                  + РЎРѕС‚СЂСѓРґРЅРёРє
                                </button>
                              </div>
                            </div>

                            {/* Rows */}
                            <div style={{ padding: dealParticipants.length ? "8px 12px" : 0, display: "grid", gap: 6 }}>
                              {dealParticipants.map((p, idx) => {
                                const pct = Number(p.pct) || 0;
                                const earn = incomeBase > 0 ? Math.round(incomeBase * pct / 100 * 100) / 100 : 0;
                                const worker = dealWorkers.find(w => w.id === p.userId);
                                const initials = worker?.name
                                  ? worker.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                                  : (worker?.email?.[0] ?? "?").toUpperCase();
                                return (
                                  <div key={p.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr 80px auto 32px", gap: 8, alignItems: "center", padding: "8px 4px", borderRadius: 10, background: p.userId ? "var(--bg-metric)" : "transparent" }}>
                                    {/* Avatar */}
                                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: p.userId ? "var(--accent)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: p.userId ? "#fff" : "var(--text-tertiary)", flexShrink: 0 }}>
                                      {p.userId ? initials : idx + 1}
                                    </div>
                                    {/* Employee select */}
                                    <select
                                      className="form-input"
                                      value={p.userId}
                                      onChange={(e) => setDealParticipants((pp) => pp.map((x) => x.id === p.id ? { ...x, userId: e.target.value } : x))}
                                    >
                                      <option value="">вЂ” РІС‹Р±СЂР°С‚СЊ СЃРѕС‚СЂСѓРґРЅРёРєР° вЂ”</option>
                                      {dealWorkers.map((w) => (
                                        <option key={w.id} value={w.id}>
                                          {w.name || w.email}{w.position ? ` В· ${w.position}` : ""}
                                        </option>
                                      ))}
                                    </select>
                                    {/* Pct + earn */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <input
                                        className="form-input"
                                        value={p.pct}
                                        onChange={(e) => setDealParticipants((pp) => pp.map((x) => x.id === p.id ? { ...x, pct: e.target.value } : x))}
                                        style={{ width: 52, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
                                        placeholder="0"
                                      />
                                      <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>%</span>
                                    </div>
                                    {/* Amount */}
                                    <div style={{ minWidth: 80, textAlign: "right" }}>
                                      {incomeBase > 0 && p.userId ? (
                                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--green)", fontSize: 13 }}>
                                          {earn.toLocaleString()}
                                        </div>
                                      ) : <span style={{ color: "var(--border)" }}>вЂ”</span>}
                                    </div>
                                    {/* Remove */}
                                    <button
                                      style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
                                      onClick={() => setDealParticipants((pp) => pp.filter((x) => x.id !== p.id))}
                                    >Г—</button>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Footer: progress bar + total */}
                            {dealParticipants.length > 0 && (
                              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-light)", background: "var(--bg-metric)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Р Р°СЃРїСЂРµРґРµР»РµРЅРѕ: <strong style={{ color: totalPct === 100 ? "var(--green)" : totalPct > 100 ? "var(--red)" : "var(--amber)" }}>{totalPct}%</strong></span>
                                  {incomeBase > 0 && (
                                    <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "var(--text-secondary)" }}>
                                      {dealParticipants.filter(p => p.userId).reduce((s, p) => s + Math.round(incomeBase * (Number(p.pct) || 0) / 100 * 100) / 100, 0).toLocaleString()} РёР· {incomeBase.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <div style={{ height: 6, borderRadius: 6, background: "var(--border)", overflow: "hidden" }}>
                                  <div style={{ height: "100%", borderRadius: 6, background: totalPct === 100 ? "var(--green)" : totalPct > 100 ? "var(--red)" : "var(--accent)", width: `${Math.min(totalPct, 100)}%`, transition: "width 0.2s" }} />
                                </div>
                                {totalPct !== 100 && (
                                  <div style={{ marginTop: 6, fontSize: 12, color: totalPct > 100 ? "var(--red)" : "var(--amber)" }}>
                                    {totalPct > 100 ? `вљ  РџСЂРµРІС‹С€РµРЅРёРµ РЅР° ${totalPct - 100}% вЂ” СѓРјРµРЅСЊС€Рё РїСЂРѕС†РµРЅС‚С‹` : `РћСЃС‚Р°Р»РѕСЃСЊ СЂР°СЃРїСЂРµРґРµР»РёС‚СЊ: ${100 - totalPct}%${incomeBase > 0 ? ` (${Math.round(incomeBase * (100 - totalPct) / 100 * 100) / 100} РІ СЃСѓРјРјРµ)` : ""}`}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Comment */}
                      <div>
                        <div className="form-label">РљРѕРјРјРµРЅС‚Р°СЂРёР№</div>
                        <textarea className="form-input" value={dealComment} onChange={(e) => setDealComment(e.target.value)} style={{ height: 72, paddingTop: 10 }} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        {!dealEditingId && templates.length > 0 && (
                          <button className="btn btn-secondary" onClick={() => setDealTemplateStep("pick")}>в†ђ РЁР°Р±Р»РѕРЅ</button>
                        )}
                        <button className="btn btn-secondary" onClick={closeDealModal}>РћС‚РјРµРЅР°</button>
                        <button className="btn btn-primary" onClick={saveDeal}>
                          {dealEditingId ? "РЎРѕС…СЂР°РЅРёС‚СЊ" : "РЎРѕР·РґР°С‚СЊ СЃРґРµР»РєСѓ"}
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
                  <div className="page-header-title">Р—Р°РґР°С‡Рё</div>
                  <div className="page-header-sub">РќР°Р·РЅР°С‡Р°Р№С‚Рµ СЃСЂРѕРєРё, РѕС‚СЃР»РµР¶РёРІР°Р№С‚Рµ СЃС‚Р°С‚СѓСЃС‹. РСЃРїРѕР»РЅРёС‚РµР»Рё РїРѕР»СѓС‡Р°СЋС‚ РїРёСЃСЊРјРѕ Рѕ РЅРѕРІРѕР№ Р·Р°РґР°С‡Рµ.</div>
                </div>
                {isManager && (
                  <div className="page-header-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => { setTaskModalOpen(true); void loadTaskUserOptions(); }}
                    >+ РќРѕРІР°СЏ Р·Р°РґР°С‡Р°</button>
                  </div>
                )}
              </div>
              <div className="filter-tabs" style={{ width: "fit-content" }}>
                {([
                  { id: "active" as const, label: "РђРєС‚РёРІРЅС‹Рµ" },
                  { id: "all" as const, label: "Р’СЃРµ" },
                  { id: "done" as const, label: "РђСЂС…РёРІ" },
                ]).map((f) => (
                  <button key={f.id} type="button" className={`filter-tab ${taskFilter === f.id ? "active" : ""}`} onClick={() => setTaskFilter(f.id)}>{f.label}</button>
                ))}
              </div>
              {tasksLoading ? (
                <div style={{ color: "var(--text-secondary)" }}>Р—Р°РіСЂСѓР·РєР°вЂ¦</div>
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
                        PENDING: "Рљ РІС‹РїРѕР»РЅРµРЅРёСЋ", IN_PROGRESS: "Р’ СЂР°Р±РѕС‚Рµ", DONE: "Р’С‹РїРѕР»РЅРµРЅРѕ", CANCELLED: "РћС‚РјРµРЅРµРЅР°",
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
                            <span>рџ‘¤ {t.assignee.name || t.assignee.email}</span>
                            <span>В·</span>
                            <span>РѕС‚ {t.createdBy.name || t.createdBy.email}</span>
                            {t.dueAt && (
                              <>
                                <span>В·</span>
                                <span className="mono" style={overdue ? { color: "var(--amber)" } : {}}>РґРѕ {new Date(t.dueAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              </>
                            )}
                          </div>
                          <div className="task-card-actions" onClick={e => e.stopPropagation()}>
                            {isMine && t.status !== "DONE" && t.status !== "CANCELLED" && (
                              <>
                                {t.status === "PENDING" && (
                                  <button className="btn btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => void patchTask(t.id, { status: "IN_PROGRESS" })}>Р’Р·СЏС‚СЊ РІ СЂР°Р±РѕС‚Сѓ</button>
                                )}
                                <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} onClick={() => void patchTask(t.id, { status: "DONE" })}>Р’С‹РїРѕР»РЅРµРЅРѕ</button>
                              </>
                            )}
                            {isManager && (
                              <button className="btn btn-ghost" style={{ height: 30, fontSize: 12, color: "var(--red-text)" }} onClick={() => void deleteTaskById(t.id)}>РЈРґР°Р»РёС‚СЊ</button>
                            )}
                            <button className="btn btn-ghost" style={{ height: 30, fontSize: 12, marginLeft: "auto" }}>РћС‚РєСЂС‹С‚СЊ в†’</button>
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
                  <div className="empty-state-title">РќРµС‚ Р·Р°РґР°С‡</div>
                  <div className="empty-state-desc">{isManager ? "РЎРѕР·РґР°Р№С‚Рµ Р·Р°РґР°С‡Сѓ РґР»СЏ СЃРѕС‚СЂСѓРґРЅРёРєР° вЂ” РѕРЅ РїРѕР»СѓС‡РёС‚ РїРёСЃСЊРјРѕ" : "Р’Р°Рј РїРѕРєР° РЅРёС‡РµРіРѕ РЅРµ РЅР°Р·РЅР°С‡РёР»Рё"}</div>
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
                      <span className="card-title">РќРѕРІР°СЏ Р·Р°РґР°С‡Р°</span>
                      <button className="btn btn-secondary" onClick={() => setTaskModalOpen(false)}>Г—</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 14 }}>
                      <div>
                        <div className="form-label">РќР°Р·РІР°РЅРёРµ *</div>
                        <input className="form-input" value={taskFormTitle} onChange={(e) => setTaskFormTitle(e.target.value)} placeholder="РљСЂР°С‚РєРѕ, С‡С‚Рѕ СЃРґРµР»Р°С‚СЊ" />
                      </div>
                      <div>
                        <div className="form-label">РћРїРёСЃР°РЅРёРµ</div>
                        <textarea className="form-input" value={taskFormDesc} onChange={(e) => setTaskFormDesc(e.target.value)} rows={3} placeholder="Р”РµС‚Р°Р»Рё" />
                      </div>
                      <div>
                        <div className="form-label">РСЃРїРѕР»РЅРёС‚РµР»СЊ *</div>
                        <select className="form-input" value={taskFormAssigneeId} onChange={(e) => setTaskFormAssigneeId(e.target.value)}>
                          <option value="">Р’С‹Р±РµСЂРёС‚Рµ</option>
                          {taskUsersForSelect.map((u) => (
                            <option key={u.id} value={u.id}>{u.name || u.email} ({u.email})</option>
                          ))}
                        </select>
                      </div>
                      <div className="g2">
                        <div>
                          <div className="form-label">РќР°С‡Р°Р»Рѕ</div>
                          <input className="form-input" type="datetime-local" value={taskFormStart} onChange={(e) => setTaskFormStart(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">РЎСЂРѕРє</div>
                          <input className="form-input" type="datetime-local" value={taskFormDue} onChange={(e) => setTaskFormDue(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => setTaskModalOpen(false)}>РћС‚РјРµРЅР°</button>
                        <button className="btn btn-primary" onClick={() => void createTaskFromModal()} disabled={!taskFormTitle.trim() || !taskFormAssigneeId}>РЎРѕР·РґР°С‚СЊ</button>
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
                  <div style={{ fontWeight: 700, fontSize: 15 }}>РЎРѕРѕР±С‰РµРЅРёСЏ</div>
                  <button
                    className="btn btn-secondary"
                    style={{ height: 28, fontSize: 11, padding: "0 10px" }}
                    onClick={() => setChatShowContacts(v => !v)}
                    title="РќРѕРІС‹Р№ С‡Р°С‚"
                  >+ РќРѕРІС‹Р№</button>
                </div>

                {/* New chat: pick a contact */}
                {chatShowContacts && (
                  <div style={{ borderBottom: "1px solid var(--border)", maxHeight: 220, overflowY: "auto" }}>
                    <div style={{ padding: "8px 12px 4px", fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>РЎРѕС‚СЂСѓРґРЅРёРєРё</div>
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
                      <div style={{ fontSize: 28, marginBottom: 8 }}>рџ’¬</div>
                      РќР°Р¶РјРёС‚Рµ В«+ РќРѕРІС‹Р№В» С‡С‚РѕР±С‹ РЅР°С‡Р°С‚СЊ РїРµСЂРµРїРёСЃРєСѓ
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
                              {conv.lastMessage.sender.id === user?.id ? "Р’С‹: " : ""}{conv.lastMessage.body}
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
                    <div style={{ fontWeight: 600, fontSize: 15, opacity: 0.6 }}>Р’С‹Р±РµСЂРёС‚Рµ СЃРѕР±РµСЃРµРґРЅРёРєР°</div>
                    <div style={{ fontSize: 13, opacity: 0.5 }}>Р’СЃРµ СЃРѕРѕР±С‰РµРЅРёСЏ С€РёС„СЂСѓСЋС‚СЃСЏ AES-256</div>
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
                        <div style={{ textAlign: "center", color: "var(--text-tertiary)", paddingTop: 40 }}>Р—Р°РіСЂСѓР·РєР°вЂ¦</div>
                      ) : chatMessages.length === 0 ? (
                        <div style={{ textAlign: "center", color: "var(--text-tertiary)", paddingTop: 40 }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>рџ‘‹</div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>РќР°С‡РЅРёС‚Рµ РѕР±С‰РµРЅРёРµ</div>
                          <div style={{ fontSize: 13 }}>РќР°РїРёС€РёС‚Рµ {chatActiveUser.name || chatActiveUser.email}</div>
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
                        placeholder={`РќР°РїРёСЃР°С‚СЊ ${chatActiveUser.name || chatActiveUser.email}вЂ¦ (Enter вЂ” РѕС‚РїСЂР°РІРёС‚СЊ)`}
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
                  вљ пёЏ <strong>AI РЅРµ РЅР°СЃС‚СЂРѕРµРЅ.</strong> РќР° СЃРµСЂРІРµСЂРµ РЅРµС‚ OPENAI_API_KEY. Р”РѕР±Р°РІСЊС‚Рµ РІ С„Р°Р№Р» <code>.env</code> РЅР° VPS:<br/>
                  <code style={{ display: "block", marginTop: 6, padding: "4px 8px", background: "#0005", borderRadius: 6, fontFamily: "monospace" }}>OPENAI_API_KEY=sk-proj-...</code>
                  Р—Р°С‚РµРј: <code>docker compose up -d backend</code>
                </div>
              )}

              {/* Header */}
              <div className="card" style={{ padding: "16px 20px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, var(--accent), #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>вњ¦</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>AI РђСЃСЃРёСЃС‚РµРЅС‚</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    РЎРґРµР»РєРё, СЂР°СЃС…РѕРґС‹ Рё РєР°СЂС‚РѕС‡РєРё РєР»РёРµРЅС‚РѕРІ РёР· С‚РµРєСЃС‚Р° РёР»Рё РіРѕР»РѕСЃР° вЂ” РІ С‚РѕРј С‡РёСЃР»Рµ РІСЃС‚Р°РІРєР° СѓРІРµРґРѕРјР»РµРЅРёСЏ Рѕ Р·РІРѕРЅРєРµ
                  </div>
                </div>
                {agentHistory.length > 0 && (
                  <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => { setAgentHistory([]); setAgentPending(null); }}>
                    РћС‡РёСЃС‚РёС‚СЊ
                  </button>
                )}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
                {agentHistory.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "40px 20px" }}>
                    <div style={{ fontSize: 48 }}>вњ¦</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Р§РµРј РјРѕРіСѓ РїРѕРјРѕС‡СЊ?</div>
                      <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20 }}>РќР°РґРёРєС‚СѓР№С‚Рµ РёР»Рё РЅР°РїРёС€РёС‚Рµ вЂ” РёР»Рё РІСЃС‚Р°РІСЊС‚Рµ РіРѕС‚РѕРІРѕРµ СѓРІРµРґРѕРјР»РµРЅРёРµ Рѕ Р·РІРѕРЅРєРµ: РїРѕРґРіРѕС‚РѕРІР»СЋ РєР°СЂС‚РѕС‡РєСѓ РєР»РёРµРЅС‚Р° РЅР° РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600 }}>
                      {(
                        [
                          "Р—Р°РїРёС€Рё СЃРґРµР»РєСѓ: РІС‡РµСЂР° Р”Рё Рё РѕР»С… РІР·СЏР»Рё 6838 РѕС‚ eurocom 75/25, Р·Р°РєСЂС‹Р» РђРЅС‚",
                          "РЎРєРѕР»СЊРєРѕ Р·Р°СЂР°Р±РѕС‚Р°Р» РєР°Р¶РґС‹Р№ РІРѕСЂРєРµСЂ Р·Р° СЌС‚РѕС‚ РјРµСЃСЏС†?",
                          "Р—Р°РїРёС€Рё СЂР°СЃС…РѕРґ: Р°СЂРµРЅРґР° РѕС„РёСЃР° 500$",
                          "РџРѕРєР°Р¶Рё СЃС‚Р°С‚РёСЃС‚РёРєСѓ Р·Р° РЅРµРґРµР»СЋ",
                          "РљР°РєРѕР№ РґРѕС…РѕРґ Р·Р° Р°РїСЂРµР»СЊ?",
                          {
                            label: "вњ… РљР»РёРµРЅС‚ РёР· СѓРІРµРґРѕРјР»РµРЅРёСЏ Рѕ Р·РІРѕРЅРєРµ (РїСЂРёРјРµСЂ)",
                            text: "вњ… РќРѕРІС‹Р№ Р·РІРѕРЅРѕРє\n\nрџ‘¤РђСЃСЃРёСЃС‚РµРЅС‚: Robert Nowak PKO BP\n\nрџЏ¦Р‘Р°РЅРє: PKO BP\n\nрџ§ЌвЂЌв™ЂпёЏРљР»РёРµРЅС‚: Marta Rusowicz\n\nвЋпёЏРўРµР»РµС„РѕРЅ: +48503703469\n\nрџ“ќ Summary: РєР»РёРµРЅС‚РєР° Р·Р°СЏРІРёР»Р°, С‡С‚Рѕ РЅРµ РёРјРµРµС‚ СЃС‡С‘С‚Р° РІ PKO BP.\nвЏ° Р’СЂРµРјСЏ РЅР°С‡Р°Р»Р° Р·РІРѕРЅРєР°: 04.05.2026, 11:31",
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
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginRight: 8, marginTop: 2 }}>вњ¦</div>
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
                              вњ… РџРѕРґС‚РІРµСЂРґРёС‚СЊ
                            </button>
                            <button className="btn btn-secondary" style={{ fontSize: 13 }}
                              onClick={() => { setAgentPending(null); setAgentHistory(h => [...h, { role: "assistant", content: "РћС‚РјРµРЅРµРЅРѕ. Р§С‚Рѕ РЅСѓР¶РЅРѕ РёР·РјРµРЅРёС‚СЊ?" }]); }}>
                              вњЏпёЏ РР·РјРµРЅРёС‚СЊ
                            </button>
                            <button className="btn btn-secondary" style={{ fontSize: 13, color: "var(--red)" }}
                              onClick={() => { setAgentPending(null); setAgentHistory(h => [...h, { role: "assistant", content: "РћС‚РјРµРЅРµРЅРѕ." }]); }}>
                              вњ• РћС‚РјРµРЅР°
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {agentLoading && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>вњ¦</div>
                    <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "var(--bg-card)", border: "1px solid var(--border-light)", fontSize: 14, color: "var(--text-tertiary)" }}>
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <span style={{ animation: "pulse 1s ease-in-out infinite" }}>в—Џ</span>
                        <span style={{ animation: "pulse 1s ease-in-out 0.2s infinite" }}>в—Џ</span>
                        <span style={{ animation: "pulse 1s ease-in-out 0.4s infinite" }}>в—Џ</span>
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
                    placeholder="РќР°РїРёС€РёС‚Рµ РёР»Рё РЅР°РґРёРєС‚СѓР№С‚Рµ... (Enter вЂ” РѕС‚РїСЂР°РІРёС‚СЊ, Shift+Enter вЂ” РЅРѕРІР°СЏ СЃС‚СЂРѕРєР°)"
                    disabled={agentLoading}
                    rows={2}
                    style={{ flex: 1, resize: "none", lineHeight: 1.5, paddingTop: 10 }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      onClick={startVoice}
                      disabled={agentLoading}
                      title="Р“РѕР»РѕСЃРѕРІРѕР№ РІРІРѕРґ (Chrome/Edge)"
                      style={{
                        width: 44, height: 44, borderRadius: 12, border: "none",
                        background: isListening ? "#ef4444" : "var(--bg-hover)",
                        cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s",
                        boxShadow: isListening ? "0 0 0 4px #ef444433" : "none",
                      }}
                    >
                      {isListening ? "вЏ№" : "рџЋ¤"}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => sendAgentMessage()}
                      disabled={agentLoading || !agentInput.trim()}
                      style={{ width: 44, height: 44, padding: 0, borderRadius: 12, fontSize: 18 }}
                    >в†’</button>
                  </div>
                </div>
                {isListening && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "pulse 1s ease-in-out infinite" }} />
                    Р“РѕРІРѕСЂРёС‚Рµ... (Chrome СЃР»СѓС€Р°РµС‚)
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
                  РњРѕР¶РЅРѕ РІСЃС‚Р°РІРёС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ Рѕ Р·РІРѕРЅРєРµ (РєР»РёРµРЅС‚, С‚РµР»РµС„РѕРЅ, Р±Р°РЅРє, summary) вЂ” РїРѕСЃР»Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РїРѕСЏРІРёС‚СЃСЏ РєР°СЂС‚РѕС‡РєР° РІ В«РљР»РёРµРЅС‚Р°С…В»
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
                    <div className="page-header-title">РЎРѕС‚СЂСѓРґРЅРёРєРё</div>
                    <div className="page-header-sub">РЈРїСЂР°РІР»СЏР№С‚Рµ РєРѕРјР°РЅРґРѕР№, РѕС„РёСЃР°РјРё Рё СЃС‚Р°С‚РёСЃС‚РёРєРѕР№ СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ</div>
                  </div>
                </div>
              )}
              {staffLoading ? (
                <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Р—Р°РіСЂСѓР·РєР°...</div>
              ) : staffMember ? (
                // ---- Member detail view ----
                <div>
                  <button className="btn btn-secondary" style={{ marginBottom: 20 }}
                    onClick={() => setStaffMember(null)}>в†ђ РќР°Р·Р°Рґ Рє СЃРїРёСЃРєСѓ</button>
                  {staffMemberLoading ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Р—Р°РіСЂСѓР·РєР°...</div>
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
                                {({ SUPER_ADMIN: "РЎСѓРїРµСЂ РђРґРјРёРЅ", ADMIN: "РђРґРјРёРЅ", MANAGER: "РњРµРЅРµРґР¶РµСЂ", WORKER: "Р Р°Р±РѕС‚РЅРёРє" } as Record<string,string>)[staffMember.role] ?? staffMember.role}
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
                              <div><div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>РўРµР»РµС„РѕРЅ</div>
                                <div style={{ fontSize: 13 }}>{staffMember.phone}</div></div>
                            )}
                            {staffMember.telegram && (
                              <div><div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Telegram</div>
                                <div style={{ fontSize: 13 }}>{staffMember.telegram}</div></div>
                            )}
                            {staffMember.contacts && (
                              <div><div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>РљРѕРЅС‚Р°РєС‚С‹</div>
                                <div style={{ fontSize: 13 }}>{staffMember.contacts}</div></div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* extra orgs (memberships) */}
                      {isAdmin && (
                        <div className="card" style={{ padding: "16px 20px" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>РћС„РёСЃС‹ СЃРѕС‚СЂСѓРґРЅРёРєР°</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            {/* Primary org */}
                            <span style={{ padding: "4px 12px", borderRadius: 20, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600 }}>
                              {staffMember.organization?.name ?? "вЂ”"} (РѕСЃРЅРѕРІРЅРѕР№)
                            </span>
                            {/* Extra orgs */}
                            {(staffMember.extraMemberships ?? []).map((m: any) => (
                              <span key={m.id} style={{ padding: "4px 12px", borderRadius: 20, background: "var(--bg-hover)", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                {m.organization.name}
                                {isAdmin && (
                                  <span style={{ cursor: "pointer", color: "var(--text-tertiary)", fontWeight: 700 }}
                                    onClick={() => removeMembership(staffMember.id, m.organizationId)}>Г—</span>
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
                                  <option value="">+ Р”РѕР±Р°РІРёС‚СЊ РІ РѕС„РёСЃ</option>
                                  {available.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                              ) : null;
                            })()}
                          </div>
                          {(staffMember.extraMemberships ?? []).length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                              РЎРѕС‚СЂСѓРґРЅРёРє СѓС‡Р°СЃС‚РІСѓРµС‚ РІ СЃРґРµР»РєР°С… Рё РїРѕР»СѓС‡Р°РµС‚ РІС‹РїР»Р°С‚С‹ РІ {1 + (staffMember.extraMemberships?.length ?? 0)} РѕС„РёСЃР°С…
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
                                { label: "РЎРґРµР»РѕРє", value: staffMember.dealsCount },
                                { label: "Р’С‹РїР»Р°С‚С‹ (СЃРґРµР»РєРё)", value: `$${staffMember.totalPayout}` },
                                { label: "РќР°С‡РёСЃР»РµРЅРѕ (Р—Рџ)", value: empSalary ? `$${empSalary.totalAccrued}` : salaryLoading ? "вЂ¦" : "вЂ”" },
                                { label: "Р—Р°РґР°С‡Рё (Р°РєС‚РёРІ.)", value: tasksLoading ? "вЂ¦" : activeTasks.length },
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
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Р—Р°СЂРїР»Р°С‚Р° ({salaryPeriod})</div>
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
                                    {empSalary?.salaryConfig ? "РР·РјРµРЅРёС‚СЊ СЃС‚Р°РІРєСѓ" : "РќР°СЃС‚СЂРѕРёС‚СЊ"}
                                  </button>
                                )}
                              </div>
                              {salaryLoading ? (
                                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Р—Р°РіСЂСѓР·РєР°вЂ¦</div>
                              ) : empSalary ? (
                                <>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                                    {[
                                      { label: "РќР°С‡РёСЃР»РµРЅРѕ", val: `$${empSalary.totalAccrued}`, color: "var(--text-primary)" },
                                      { label: "Р’С‹РїР»Р°С‡РµРЅРѕ", val: `$${empSalary.paidUsd}`, color: "#22c55e" },
                                      { label: "Р‘Р°Р»Р°РЅСЃ", val: `$${empSalary.balance}`, color: empSalary.balance < 0 ? "#ef4444" : "var(--text-primary)" },
                                    ].map(m => (
                                      <div key={m.label} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "10px 14px" }}>
                                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{m.label}</div>
                                        <div style={{ fontSize: 17, fontWeight: 700, color: m.color }}>{m.val}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {empSalary.salaryConfig && (
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                                      <span>РЎС‚Р°РІРєР°: <b>{empSalary.salaryConfig.baseAmount} {empSalary.salaryConfig.currency}</b></span>
                                      <span>Р”РµРЅСЊ РІС‹РїР»Р°С‚С‹: <b>{empSalary.salaryConfig.payDay}</b></span>
                                      <span>Р‘РѕРЅСѓСЃС‹ РїРѕ СЃРґРµР»РєР°Рј: <b>${empSalary.dealEarningsUsd}</b></span>
                                    </div>
                                  )}
                                  {empSalary.payments?.length > 0 && (
                                    <div style={{ marginTop: 14 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Р’С‹РїР»Р°С‚С‹</div>
                                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {empSalary.payments.slice(0, 5).map((p: any) => (
                                          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 10px", background: "var(--bg-hover)", borderRadius: 6 }}>
                                            <span style={{ color: "var(--text-secondary)" }}>{({ BASE: "РЎС‚Р°РІРєР°", DEAL_BONUS: "Р‘РѕРЅСѓСЃ", ADVANCE: "РђРІР°РЅСЃ", MANUAL: "Р’СЂСѓС‡РЅСѓСЋ" } as Record<string,string>)[p.type] ?? p.type}</span>
                                            <span style={{ fontWeight: 600 }}>{p.amount} {p.currency}</span>
                                            <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, background: p.isPaid ? "#22c55e22" : "#f59e0b22", color: p.isPaid ? "#22c55e" : "#f59e0b" }}>
                                              {p.isPaid ? "Р’С‹РїР»Р°С‡РµРЅРѕ" : "РћР¶РёРґР°РµС‚"}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Р—Р°СЂРїР»Р°С‚Р° РЅРµ РЅР°СЃС‚СЂРѕРµРЅР°. {isAdmin ? "РќР°Р¶РјРёС‚Рµ В«РќР°СЃС‚СЂРѕРёС‚СЊВ» С‡С‚РѕР±С‹ Р·Р°РґР°С‚СЊ СЃС‚Р°РІРєСѓ." : ""}</div>
                              )}
                            </div>

                            {/* Tasks block */}
                            <div className="card" style={{ padding: "20px 24px" }}>
                              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Р—Р°РґР°С‡Рё</div>
                              {tasksLoading ? (
                                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Р—Р°РіСЂСѓР·РєР°вЂ¦</div>
                              ) : empTasks.length === 0 ? (
                                <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>РќРµС‚ Р·Р°РґР°С‡</div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {empTasks.slice(0, 10).map((t: any) => (
                                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-hover)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
                                      onClick={() => { setTab("tasks"); setTaskDetail(t); }}>
                                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                                      <span style={{ marginLeft: 12, padding: "2px 8px", borderRadius: 10, fontSize: 11, flexShrink: 0,
                                        background: t.status === "DONE" ? "#22c55e22" : t.status === "CANCELLED" ? "#ef444422" : t.status === "IN_PROGRESS" ? "#3b82f622" : "#f59e0b22",
                                        color: t.status === "DONE" ? "#22c55e" : t.status === "CANCELLED" ? "#ef4444" : t.status === "IN_PROGRESS" ? "#3b82f6" : "#f59e0b" }}>
                                        {({ TODO: "Рљ РІС‹РїРѕР»РЅРµРЅРёСЋ", IN_PROGRESS: "Р’ СЂР°Р±РѕС‚Рµ", DONE: "Р“РѕС‚РѕРІРѕ", CANCELLED: "РћС‚РјРµРЅРµРЅР°" } as Record<string,string>)[t.status] ?? t.status}
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
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>РџРѕСЃР»РµРґРЅРёРµ СЃРґРµР»РєРё</div>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                                  {["РќР°Р·РІР°РЅРёРµ", "Р”Р°С‚Р°", "РЎС‚Р°С‚СѓСЃ", "РЎС‚Р°РІРєР° %", "Р’С‹РїР»Р°С‚Р°"].map(h => (
                                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 500, fontSize: 11 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {staffMember.recentDeals.map((d: any) => (
                                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                    <td style={{ padding: "8px 8px" }}>{d.title || d.templateName || "вЂ”"}</td>
                                    <td style={{ padding: "8px 8px", color: "var(--text-tertiary)" }}>{d.dealDate ? new Date(d.dealDate).toLocaleDateString("ru-RU") : "вЂ”"}</td>
                                    <td style={{ padding: "8px 8px" }}>
                                      <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: d.status === "DONE" ? "#22c55e22" : d.status === "CANCELLED" ? "#ef444422" : "#f59e0b22", color: d.status === "DONE" ? "#22c55e" : d.status === "CANCELLED" ? "#ef4444" : "#f59e0b" }}>
                                        {d.status === "DONE" ? "Р—Р°РєСЂС‹С‚Р°" : d.status === "CANCELLED" ? "РћС‚РјРµРЅРµРЅР°" : "Р’ СЂР°Р±РѕС‚Рµ"}
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
                    <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-tertiary)" }}>РќРµС‚ РґР°РЅРЅС‹С…</div>
                  ) : staffData.map((group: any) => (
                    <div key={group.org.id} className="card" style={{ padding: "20px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>
                          {group.org.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{group.org.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{group.members.length} СЃРѕС‚СЂ.</div>
                        </div>
                      </div>
                      <StaffTable members={group.members} onSelect={(id: string) => loadStaffMember(id)} />
                    </div>
                  ))}
                </div>
              ) : (
                // ---- ADMIN single office view ----
                <div className="card" style={{ padding: "20px 24px" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>РЎРѕС‚СЂСѓРґРЅРёРєРё РѕС„РёСЃР°</div>
                  {(!staffData || staffData.length === 0) ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)" }}>РќРµС‚ СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ</div>
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
            const ROLE_LABELS_S: Record<string, string> = { ADMIN: "РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ", MANAGER: "РњРµРЅРµРґР¶РµСЂ", WORKER: "Р’РѕСЂРєРµСЂ", SUPER_ADMIN: "РЎСѓРїРµСЂ-Р°РґРјРёРЅ" };
            const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
            const fmtDec = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

            const totalFund = salaryData.reduce((s, e) => s + (e.totalAccrued ?? 0), 0) + (salaryAiPartner?.totalAccrued ?? 0);
            const totalDebt = salaryData.reduce((s, e) => s + Math.max(0, e.balance ?? 0), 0) + Math.max(0, salaryAiPartner?.balance ?? 0);
            const totalPaid = salaryData.reduce((s, e) => s + (e.paidUsd ?? 0), 0) + (salaryAiPartner?.paidUsd ?? 0);

            // в”Ђв”Ђ CABINET VIEW в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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
                      Р’СЃРµ СЃРѕС‚СЂСѓРґРЅРёРєРё
                    </button>
                    <div style={{ width: 1, height: 24, background: "var(--border)" }} />
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor + "22", color: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>
                      {(emp.name || emp.email)?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{emp.name || emp.email}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{isAi ? "РџР°СЂС‚РЅС‘СЂ РР РѕС„РёСЃР°" : (ROLE_LABELS_S[emp.role] ?? emp.role)}{emp.position ? ` В· ${emp.position}` : ""}</div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="month" value={salaryPeriod} onChange={e => { setSalaryPeriod(e.target.value); loadSalary(e.target.value); }}
                        style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
                    </div>
                  </div>

                  {/* Metric cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {(isAi ? [
                      { label: "РќР°С‡РёСЃР»РµРЅРѕ", value: `$${fmt(emp.totalAccrued ?? 0)}`, sub: `Р”РѕР»СЏ РР РїРѕ СЃРґРµР»РєР°Рј РѕС„РёСЃР°: $${fmtDec(emp.dealEarningsUsd ?? 0)}`, color: "#8B5CF6" },
                      { label: "Р’С‹РїР»Р°С‡РµРЅРѕ", value: `$${fmt(emp.paidUsd ?? 0)}`, sub: `${emp.payments.filter((p: any) => p.isPaid).length} РїРѕРґС‚РІ. РІС‹РїР»Р°С‚`, color: "#059669" },
                      { label: isInDebt ? "Рљ РІС‹РїР»Р°С‚Рµ" : "Р‘Р°Р»Р°РЅСЃ", value: `${isInDebt ? "в€’" : "+"}$${fmt(Math.abs(debt))}`, sub: "РЎС‡С‘С‚ РР РїСЂРёРІСЏР·Р°РЅ Рє РѕС„РёСЃСѓ", color: isInDebt ? "#DC2626" : "#059669" },
                    ] : [
                      { label: "РќР°С‡РёСЃР»РµРЅРѕ", value: `$${fmt(emp.totalAccrued ?? 0)}`, sub: (() => {
                          const baseFull = emp.baseUsd ?? 0;
                          const basePart = emp.baseAccruedUsd ?? 0;
                          const pending = Math.max(0, baseFull - basePart);
                          const dealPart = emp.dealEarningsUsd ?? 0;
                          if (cfg && pending > 0 && salaryPeriod === new Date().toISOString().slice(0, 7)) {
                            return `РЎС‚Р°РІРєР° $${fmt(basePart)} (РµС‰С‘ $${fmt(pending)} СЃ ${cfg.payDay}-РіРѕ) + СЃРґРµР»РєРё $${fmtDec(dealPart)}`;
                          }
                          return `РЎС‚Р°РІРєР° $${fmt(basePart || baseFull)} + СЃРґРµР»РєРё $${fmtDec(dealPart)}`;
                        })(), color: "#6366F1" },
                      { label: "Р’С‹РїР»Р°С‡РµРЅРѕ", value: `$${fmt(emp.paidUsd ?? 0)}`, sub: `${emp.payments.filter((p: any) => p.isPaid).length} РїРѕРґС‚РІ. РІС‹РїР»Р°С‚ Р·Р° ${salaryPeriod}`, color: "#059669" },
                      { label: isInDebt ? "Р”РѕР»Рі (РЅРµ РІС‹РїР»Р°С‡РµРЅРѕ)" : "Р‘Р°Р»Р°РЅСЃ", value: `${isInDebt ? "в€’" : "+"}$${fmt(Math.abs(debt))}`, sub: isInDebt ? ((debt > Math.max(0, (emp.totalAccrued ?? 0) - (emp.paidUsd ?? 0)) + 0.01) ? "РЎ СѓС‡С‘С‚РѕРј РїСЂРѕС€Р»С‹С… РјРµСЃСЏС†РµРІ" : "РўСЂРµР±СѓРµС‚ РІС‹РїР»Р°С‚С‹") : "РџРµСЂРµРїР»Р°С‚Р° РёР»Рё СЂРѕРІРЅРѕ", color: isInDebt ? "#DC2626" : "#059669" },
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
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{isAi ? "РР РѕС„РёСЃР°" : "РќР°СЃС‚СЂРѕР№РєРё Р·Р°СЂРїР»Р°С‚С‹"}</div>
                        {!isAi && (
                        <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                          onClick={() => openSalaryConfigModal(emp.userId, emp.name || emp.email, cfg)}>
                          {cfg ? "РР·РјРµРЅРёС‚СЊ СЃС‚Р°РІРєСѓ" : "РќР°СЃС‚СЂРѕРёС‚СЊ"}
                        </button>
                        )}
                      </div>
                      <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
                        {isAi ? (
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                            РЈ РєР°Р¶РґРѕРіРѕ РѕС„РёСЃР° РѕРґРёРЅ СЃС‡С‘С‚ В«РРВ». РќР°С‡РёСЃР»РµРЅРёРµ вЂ” РґРѕР»СЏ РёР· С€Р°Р±Р»РѕРЅР° СЃРґРµР»РѕРє Р·Р° РјРµСЃСЏС†; РїСЂРѕС€Р»С‹Рµ РїРµСЂРёРѕРґС‹ РїРµСЂРµСЃС‡РёС‚С‹РІР°СЋС‚СЃСЏ РїРѕ РґР°РЅРЅС‹Рј СЃРґРµР»РѕРє.
                          </div>
                        ) : cfg ? (
                          <>
                            <div>
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>РЎС‚Р°РІРєР° РІ РјРµСЃСЏС†</div>
                              <div style={{ fontSize: 22, fontWeight: 700 }}>{Number(cfg.baseAmount).toLocaleString()} <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{cfg.currency}</span></div>
                              {cfg.currency !== "USD" && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>в‰€ ${fmt(emp.baseUsd ?? 0)} USD</div>}
                            </div>
                            <div style={{ display: "flex", gap: 20 }}>
                              <div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>Р”РµРЅСЊ РІС‹РїР»Р°С‚С‹</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{cfg.payDay}-Рµ</div>
                                {salaryPeriod === new Date().toISOString().slice(0, 7) && !(emp.baseAccrued || (emp.baseAccruedUsd ?? 0) > 0) && (
                                  <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>РЎС‚Р°РІРєР° РІРѕР№РґС‘С‚ РІ РЅР°С‡РёСЃР»РµРЅРёРµ {cfg.payDay}-РіРѕ С‡РёСЃР»Р°</div>
                                )}
                              </div>
                              <div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>Р’Р°Р»СЋС‚Р°</div>
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
                            <div style={{ fontSize: 32, marginBottom: 8 }}>рџ’°</div>
                            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 14 }}>РЎС‚Р°РІРєР° РЅРµ РЅР°СЃС‚СЂРѕРµРЅР°</div>
                            <button type="button" className="btn btn-primary" style={{ fontSize: 12 }}
                              onClick={() => openSalaryConfigModal(emp.userId, emp.name || emp.email, null)}>
                              РЈСЃС‚Р°РЅРѕРІРёС‚СЊ СЃС‚Р°РІРєСѓ
                            </button>
                          </div>
                        )}

                        {/* Deal earnings breakdown */}
                        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>РЎРґРµР»РєРё Р·Р° {salaryPeriod}</div>
                          {emp.dealEarningsUsd > 0 ? (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Р—Р°СЂР°Р±РѕС‚РѕРє РїРѕ СЃРґРµР»РєР°Рј</span>
                              <span style={{ fontWeight: 700, color: "#059669", fontSize: 15 }}>${fmtDec(emp.dealEarningsUsd)}</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>РќРµС‚ СЃРґРµР»РѕРє Р·Р° РїРµСЂРёРѕРґ</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Payment history */}
                    <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>РСЃС‚РѕСЂРёСЏ РІС‹РїР»Р°С‚ вЂ” {salaryPeriod}</div>
                        <button type="button" className="btn btn-primary" style={{ fontSize: 12 }}
                          onClick={() => openSalaryPaymentModal(emp.userId, emp.name || emp.email, user?.activeOrganizationId ?? "", cfg?.currency ?? "USD")}>
                          + Р”РѕР±Р°РІРёС‚СЊ РІС‹РїР»Р°С‚Сѓ
                        </button>
                      </div>

                      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
                        {emp.payments.length === 0 ? (
                          <div style={{ padding: "40px 0", textAlign: "center" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>рџ“‹</div>
                            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Р’С‹РїР»Р°С‚ Р·Р° СЌС‚РѕС‚ РїРµСЂРёРѕРґ РЅРµС‚</div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>РќР°Р¶РјРёС‚Рµ В«+ Р”РѕР±Р°РІРёС‚СЊ РІС‹РїР»Р°С‚СѓВ», С‡С‚РѕР±С‹ Р·Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ</div>
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
                                    {p.currency !== "USD" && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>в‰€ ${fmt(p.amountUsd)}</span>}
                                    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "var(--accent-light)", color: "var(--accent)", fontWeight: 500 }}>{SALARY_PAYMENT_TYPES[p.type] ?? p.type}</span>
                                    {p.isPaid && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "rgba(5,150,105,0.12)", color: "#059669", fontWeight: 600 }}>вњ“ Р’С‹РїР»Р°С‡РµРЅРѕ</span>}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                                    {p.note && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.note}</span>}
                                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{new Date(p.createdAt).toLocaleDateString("ru-RU")}</span>
                                    {p.isPaid && p.paidAt && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>В· РІС‹РїР»Р°С‡РµРЅРѕ {new Date(p.paidAt).toLocaleDateString("ru-RU")}</span>}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                  <button onClick={() => togglePaymentPaid(p.id, !p.isPaid)}
                                    style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                                      background: p.isPaid ? "rgba(220,38,38,0.1)" : "rgba(5,150,105,0.12)",
                                      color: p.isPaid ? "#DC2626" : "#059669" }}>
                                    {p.isPaid ? "РћС‚РјРµРЅРёС‚СЊ" : "Р’С‹РїР»Р°С‚РёС‚СЊ"}
                                  </button>
                                  <button onClick={() => deleteSalaryPayment(p.id)}
                                    style={{ padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(220,38,38,0.08)", color: "#DC2626", fontSize: 13 }}>
                                    вњ•
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

            // в”Ђв”Ђ LIST VIEW в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
            return (
              <div style={{ display: "grid", gap: 16 }}>
                <div className="page-header">
                  <div className="page-header-left">
                    <div className="page-header-title">Р—Р°СЂРїР»Р°С‚Р°</div>
                    <div className="page-header-sub">РЈС‡С‘С‚ Р·Р°СЂРїР»Р°С‚РЅРѕРіРѕ С„РѕРЅРґР°, РґРѕР»РіРѕРІ Рё РІС‹РїР»Р°С‚ СЃРѕС‚СЂСѓРґРЅРёРєР°Рј</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="month" value={salaryPeriod}
                      onChange={e => { setSalaryPeriod(e.target.value); loadSalary(e.target.value); }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
                    <button className="btn btn-secondary" onClick={() => loadSalary()}>РћР±РЅРѕРІРёС‚СЊ</button>
                  </div>
                </div>

                {/* Summary strip */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  {[
                    { label: "Р¤РѕРЅРґ Р—Рџ Р·Р° РїРµСЂРёРѕРґ", value: `$${fmt(totalFund)}`, sub: "РЎС‚Р°РІРєРё + Р·Р°СЂР°Р±РѕС‚РѕРє РїРѕ СЃРґРµР»РєР°Рј", color: "#6366F1", bg: "rgba(99,102,241,0.07)" },
                    { label: "Р”РѕР»Рі СЃРѕС‚СЂСѓРґРЅРёРєР°Рј", value: `$${fmt(totalDebt)}`, sub: totalDebt > 0 ? `РЈ ${salaryData.filter((e: any) => (e.balance ?? 0) > 0).length} СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ РµСЃС‚СЊ РґРѕР»Рі` : "Р’СЃРµ РґРѕР»РіРё РїРѕРіР°С€РµРЅС‹", color: totalDebt > 0 ? "#DC2626" : "#059669", bg: totalDebt > 0 ? "rgba(220,38,38,0.06)" : "rgba(5,150,105,0.06)" },
                    { label: "РС‚РѕРіРѕ РІС‹РїР»Р°С‡РµРЅРѕ", value: `$${fmt(totalPaid)}`, sub: "РџРѕРґС‚РІРµСЂР¶РґС‘РЅРЅС‹Рµ РІС‹РїР»Р°С‚С‹", color: "#059669", bg: "rgba(5,150,105,0.06)" },
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
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", fontWeight: 600, fontSize: 14 }}>рџ¤– РР РѕС„РёСЃР°</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 110px 110px 110px 110px auto", padding: "12px 20px", gap: 8, alignItems: "center", cursor: "pointer" }}
                      onClick={() => setSelectedSalaryEmp(salaryAiPartner)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(139,92,246,0.15)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>рџ¤–</div>
                        <div><div style={{ fontWeight: 600 }}>{salaryAiPartner.name}</div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Р”РѕР»СЏ РїРѕ СЃРґРµР»РєР°Рј</div></div>
                      </div>
                      <div style={{ textAlign: "right", color: "var(--text-tertiary)", fontSize: 12 }}>вЂ”</div>
                      <div style={{ textAlign: "right", fontWeight: 600, color: "#8B5CF6" }}>${fmtDec(salaryAiPartner.dealEarningsUsd ?? 0)}</div>
                      <div style={{ textAlign: "right", fontWeight: 700, color: "#8B5CF6" }}>${fmt(salaryAiPartner.totalAccrued ?? 0)}</div>
                      <div style={{ textAlign: "right", color: "#059669" }}>${fmt(salaryAiPartner.paidUsd ?? 0)}</div>
                      <div style={{ textAlign: "right", fontWeight: 700, color: (salaryAiPartner.balance ?? 0) > 0 ? "#DC2626" : "#059669" }}>
                        {(salaryAiPartner.balance ?? 0) > 0 ? "в€’" : "+"}${fmt(Math.abs(salaryAiPartner.balance ?? 0))}
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setSelectedSalaryEmp(salaryAiPartner); }}>РљР°Р±РёРЅРµС‚</button>
                    </div>
                  </div>
                )}

                {/* Employee table */}
                <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", fontWeight: 600, fontSize: 14 }}>
                    РЎРѕС‚СЂСѓРґРЅРёРєРё ({salaryData.length})
                  </div>
                  {salaryLoading ? (
                    <div style={{ padding: "50px 0", textAlign: "center", color: "var(--text-tertiary)" }}>Р—Р°РіСЂСѓР·РєР°...</div>
                  ) : salaryData.length === 0 ? (
                    <div style={{ padding: "50px 0", textAlign: "center", color: "var(--text-tertiary)" }}>РќРµС‚ СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ РІ РѕС„РёСЃРµ</div>
                  ) : (
                    <>
                      {/* Table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 110px 110px 110px 110px auto", padding: "8px 20px", borderBottom: "1px solid var(--border-light)", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", gap: 8 }}>
                        <span>РЎРѕС‚СЂСѓРґРЅРёРє</span>
                        <span style={{ textAlign: "right" }}>РЎС‚Р°РІРєР°</span>
                        <span style={{ textAlign: "right" }}>РЎРґРµР»РєРё</span>
                        <span style={{ textAlign: "right" }}>РќР°С‡РёСЃР»РµРЅРѕ</span>
                        <span style={{ textAlign: "right" }}>Р’С‹РїР»Р°С‡РµРЅРѕ</span>
                        <span style={{ textAlign: "right" }}>Р‘Р°Р»Р°РЅСЃ</span>
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
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{ROLE_LABELS_S[emp.role] ?? emp.role}{emp.position ? ` В· ${emp.position}` : ""}</div>
                              </div>
                              {cfg && <div style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--bg-input)", color: "var(--text-tertiary)" }}>Р—Рџ {cfg.payDay}-Рµ</div>}
                            </div>

                            {/* Base salary */}
                            <div style={{ textAlign: "right" }}>
                              {cfg ? (
                                <span style={{ fontSize: 13, fontWeight: 600 }}>${fmt(emp.baseUsd ?? 0)}</span>
                              ) : (
                                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>вЂ”</span>
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
                                {isInDebt ? "в€’" : "+"}${fmt(Math.abs(debt))}
                              </span>
                              {isInDebt && <div style={{ fontSize: 10, color: "#DC2626" }}>РґРѕР»Рі</div>}
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                              <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                                onClick={() => setSelectedSalaryEmp(emp)}>
                                РљР°Р±РёРЅРµС‚ в†’
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
                    <span className="card-title">РћС„РёСЃС‹ / РћСЂРіР°РЅРёР·Р°С†РёРё</span>
                    <button className="btn btn-secondary" onClick={loadOrgs}>РћР±РЅРѕРІРёС‚СЊ</button>
                  </div>
                  <div className="card-body" style={{ display: "grid", gap: 16 }}>
                    {/* Create org */}
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <div className="form-label">РќР°Р·РІР°РЅРёРµ РѕС„РёСЃР°</div>
                        <input className="form-input" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="РљРёС—РІ, Р”РЅС–РїСЂРѕ, Р›СЊРІС–РІ..." />
                      </div>
                      <button className="btn btn-primary" onClick={createOrg} disabled={!newOrgName.trim()}>+ РЎРѕР·РґР°С‚СЊ РѕС„РёСЃ</button>
                    </div>

                    {/* Orgs table */}
                    <div className="card" style={{ border: "1px solid var(--border-light)" }}>
                      <div className="card-body table-scroll" style={{ padding: 0 }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>РќР°Р·РІР°РЅРёРµ</th>
                              <th style={{ textAlign: "right" }}>РЎРѕС‚СЂСѓРґРЅРёРєРѕРІ</th>
                              <th style={{ textAlign: "right" }}>РЎРґРµР»РѕРє</th>
                              <th style={{ width: 180 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {orgs.length === 0 ? (
                              <tr><td colSpan={5} style={{ padding: 16, color: "var(--text-secondary)" }}>РќРµС‚ РѕС„РёСЃРѕРІ</td></tr>
                            ) : (
                              orgs.map((o) => (
                                <tr key={o.id}>
                                  <td style={{ fontWeight: 600 }}>
                                    {o.name}
                                    {o.id === user.activeOrganizationId ? (
                                      <span style={{ marginLeft: 8, fontSize: 11, background: "var(--accent-light)", color: "var(--accent)", borderRadius: 6, padding: "2px 7px" }}>Р°РєС‚РёРІРЅС‹Р№</span>
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
                                        >РџРµСЂРµР№С‚Рё</button>
                                      ) : null}
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: "4px 12px", fontSize: 12, color: "var(--red)" }}
                                        onClick={() => deleteOrg(o.id, o.name)}
                                      >РЈРґР°Р»РёС‚СЊ</button>
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
                      <span className="card-title">РљСѓСЂСЃС‹ РІР°Р»СЋС‚</span>
                      {ratesLastSync && (
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                          РћР±РЅРѕРІР»РµРЅРѕ: {new Date(ratesLastSync).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
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
                          {ratesSyncing ? "РћР±РЅРѕРІР»РµРЅРёРµвЂ¦" : "РђРІС‚Рѕ-РѕР±РЅРѕРІРёС‚СЊ"}
                        </button>
                      )}
                      <button type="button" className="btn btn-secondary" onClick={() => setRatesModalOpen(true)}>РР·РјРµРЅРёС‚СЊ РІСЂСѓС‡РЅСѓСЋ</button>
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
                      РљСѓСЂСЃС‹ РѕР±РЅРѕРІР»СЏСЋС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РєР°Р¶РґС‹Р№ РґРµРЅСЊ РІ 06:00 Рё РїСЂРё Р·Р°РїСѓСЃРєРµ СЃРµСЂРІРµСЂР°. 1 USD вЂ” Р±Р°Р·РѕРІР°СЏ РІР°Р»СЋС‚Р°.
                    </div>
                  </div>
                </div>
              )}

              {/* Deal Templates */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">РЁР°Р±Р»РѕРЅС‹ СЃРґРµР»РѕРє</span>
                  <button className="btn btn-primary" onClick={() => openTemplateModal()}>+ РќРѕРІС‹Р№ С€Р°Р±Р»РѕРЅ</button>
                </div>
                <div className="card-body" style={{ display: "grid", gap: 10 }}>
                  {templates.length === 0 ? (
                    <div style={{ color: "var(--text-secondary)", fontSize: 13, padding: "8px 0" }}>
                      РќРµС‚ С€Р°Р±Р»РѕРЅРѕРІ. РЎРѕР·РґР°Р№С‚Рµ СЃРІРѕР№ РїРµСЂРІС‹Р№ С€Р°Р±Р»РѕРЅ С‡С‚РѕР±С‹ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РєР°СЃС‚РѕРјРЅС‹Рµ РїРѕР»СЏ РІ СЃРґРµР»РєР°С….
                    </div>
                  ) : (
                    <div className="card" style={{ border: "1px solid var(--border-light)" }}>
                      <div className="table-scroll" style={{ padding: 0 }}>
                        <table className="data-table">
                          <thead><tr><th>РќР°Р·РІР°РЅРёРµ</th><th>РџРѕР»РµР№</th><th>Р’РѕСЂРєРµСЂС‹</th><th style={{ width: 160 }}></th></tr></thead>
                          <tbody>
                            {templates.map((t) => (
                              <tr key={t.id}>
                                <td style={{ fontWeight: 600 }}>{t.name}</td>
                                <td style={{ color: "var(--text-secondary)" }}>{t.fields.length}</td>
                                <td>{t.hasWorkers ? <span className="badge badge-green">Р”Р°</span> : <span className="badge badge-amber">РќРµС‚</span>}</td>
                                <td>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openTemplateModal(t)}>Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ</button>
                                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => deleteTemplate(t.id, t.name)}>РЈРґР°Р»РёС‚СЊ</button>
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

              {isAdmin ? (
                <>
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <span className="card-title">РљР»РёРµРЅС‚С‹ вЂ” СЃС‚Р°С‚СѓСЃС‹ РІРѕСЂРѕРЅРєРё</span>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, maxWidth: 720, lineHeight: 1.5 }}>
                          <strong>РљРѕРґ</strong> вЂ” Р»Р°С‚РёРЅРёС†Р° РґР»СЏ СЃРёСЃС‚РµРјС‹ (РЅРµ РјРµРЅСЏРµС‚СЃСЏ). <strong>РќР°Р·РІР°РЅРёРµ</strong> вЂ” РєР°Рє РІРёРґСЏС‚ СЃРѕС‚СЂСѓРґРЅРёРєРё РІ CRM.
                          <strong> РџРѕСЂСЏРґРѕРє</strong> вЂ” СЃРѕСЂС‚РёСЂРѕРІРєР° РІ СЃРїРёСЃРєР°С…. <strong>Р¦РІРµС‚</strong> вЂ” hex, РЅР°РїСЂРёРјРµСЂ <code style={{ fontSize: 11 }}>#3b82f6</code>.
                          <strong> РљРѕРЅРµС† РІРѕСЂРѕРЅРєРё</strong> вЂ” РѕС‚РјРµС‚РєР° В«С„РёРЅР°Р»СЊРЅС‹Р№В» СЃС‚Р°С‚СѓСЃ (РЅР°РїСЂРёРјРµСЂ Р·Р°РєСЂС‹С‚).
                        </div>
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={() => void loadClientStatuses()}>РћР±РЅРѕРІРёС‚СЊ</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 18 }}>
                      <div style={clientFormSectionStyle(true)}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Р”РѕР±Р°РІРёС‚СЊ СЃС‚Р°С‚СѓСЃ</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                          <div style={{ minWidth: 160 }}>
                            <div className="form-label">РљРѕРґ (Р»Р°С‚РёРЅРёС†Р°)</div>
                            <input className="form-input" value={newClientStatusSlug} onChange={(e) => setNewClientStatusSlug(e.target.value)} placeholder="naprimer_ozhidaet" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div className="form-label">РќР°Р·РІР°РЅРёРµ РІ РёРЅС‚РµСЂС„РµР№СЃРµ</div>
                            <input className="form-input" value={newClientStatusLabel} onChange={(e) => setNewClientStatusLabel(e.target.value)} placeholder="РќР°РїСЂРёРјРµСЂ: РћР¶РёРґР°РµС‚ РѕС‚РІРµС‚Р°" />
                          </div>
                          <button type="button" className="btn btn-primary" onClick={() => void addClientStatusRow()}>Р”РѕР±Р°РІРёС‚СЊ СЃС‚Р°С‚СѓСЃ</button>
                        </div>
                      </div>
                      <div className="table-scroll" style={{ border: "1px solid var(--border-light)", borderRadius: 12, overflow: "auto" }}>
                        <table className="data-table">
                          <thead style={{ background: "var(--bg-metric)" }}>
                            <tr>
                              <th><span style={{ display: "block" }}>РљРѕРґ</span><span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>СЃРёСЃС‚РµРјРЅС‹Р№</span></th>
                              <th>РљР°Рє РІ CRM</th>
                              <th style={{ width: 100 }}>РџРѕСЂСЏРґРѕРє</th>
                              <th style={{ width: 120 }}>Р¦РІРµС‚ (HEX)</th>
                              <th style={{ width: 110 }}><span style={{ display: "block" }}>РљРѕРЅРµС†</span><span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>РІРѕСЂРѕРЅРєРё</span></th>
                              <th style={{ width: 180 }}>Р”РµР№СЃС‚РІРёСЏ</th>
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
                                          return alert(j.message ?? "РћС€РёР±РєР°");
                                        }
                                        await loadClientStatuses();
                                      }}>РЎРѕС…СЂР°РЅРёС‚СЊ</button>
                                      <button type="button" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => void deleteClientStatusRow(s.id)}>РЈРґР°Р»РёС‚СЊ</button>
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
                        <span className="card-title">РљР»РёРµРЅС‚С‹ вЂ” РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РїРѕР»СЏ</span>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, maxWidth: 720, lineHeight: 1.5 }}>
                          РџРѕР»СЏ РїРѕСЏРІР»СЏСЋС‚СЃСЏ РІ С„РѕСЂРјРµ РєР»РёРµРЅС‚Р° РїРѕРґ СЃС‚Р°РЅРґР°СЂС‚РЅС‹РјРё Р±Р»РѕРєР°РјРё. Р‘Р°РЅРє, Р°СЃСЃРёСЃС‚РµРЅС‚ Рё РёС‚РѕРі Р·РІРѕРЅРєР° СѓР¶Рµ РµСЃС‚СЊ РѕС‚РґРµР»СЊРЅРѕ.
                          Р”Р»СЏ С‚РёРїР° В«РЎРїРёСЃРѕРєВ» РІ РєРѕР»РѕРЅРєРµ РІР°СЂРёР°РЅС‚РѕРІ СѓРєР°Р¶РёС‚Рµ Р·РЅР°С‡РµРЅРёСЏ С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ РёР»Рё СЃ РЅРѕРІРѕР№ СЃС‚СЂРѕРєРё.
                        </div>
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={() => void loadClientFieldDefinitions()}>РћР±РЅРѕРІРёС‚СЊ</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 18 }}>
                      <div style={clientFormSectionStyle(true)}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>РќРѕРІРѕРµ РїРѕР»Рµ</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                          <div style={{ minWidth: 140 }}>
                            <div className="form-label">РљРѕРґ РїРѕР»СЏ (Р»Р°С‚РёРЅРёС†Р°)</div>
                            <input className="form-input" value={newClientFieldKey} onChange={(e) => setNewClientFieldKey(e.target.value)} placeholder="istochnik" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <div className="form-label">РџРѕРґРїРёСЃСЊ РІ С„РѕСЂРјРµ</div>
                            <input className="form-input" value={newClientFieldLabel} onChange={(e) => setNewClientFieldLabel(e.target.value)} placeholder="РСЃС‚РѕС‡РЅРёРє Р»РёРґР°" />
                          </div>
                          <div style={{ width: 200 }}>
                            <div className="form-label">РўРёРї РґР°РЅРЅС‹С…</div>
                            <select className="form-input" value={newClientFieldType} onChange={(e) => setNewClientFieldType(e.target.value as FieldType)}>
                              {FIELD_TYPES_ALL.map((t) => (
                                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                              ))}
                            </select>
                          </div>
                          <button type="button" className="btn btn-primary" onClick={() => void addClientFieldRow()}>Р”РѕР±Р°РІРёС‚СЊ РїРѕР»Рµ</button>
                        </div>
                      </div>
                      <div className="table-scroll" style={{ border: "1px solid var(--border-light)", borderRadius: 12, overflow: "auto" }}>
                        <table className="data-table">
                          <thead style={{ background: "var(--bg-metric)" }}>
                            <tr>
                              <th><span style={{ display: "block" }}>РљРѕРґ</span><span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>РЅРµ РјРµРЅСЏРµС‚СЃСЏ</span></th>
                              <th>РџРѕРґРїРёСЃСЊ</th>
                              <th style={{ width: 160 }}>РўРёРї</th>
                              <th style={{ width: 90 }}>РџРѕСЂСЏРґРѕРє</th>
                              <th style={{ width: 80 }}>РћР±СЏР·.</th>
                              <th style={{ minWidth: 160 }}><span style={{ display: "block" }}>Р’Р°СЂРёР°РЅС‚С‹</span><span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>РґР»СЏ СЃРїРёСЃРєР°</span></th>
                              <th style={{ width: 180 }}>Р”РµР№СЃС‚РІРёСЏ</th>
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
                                          return alert(j.message ?? "РћС€РёР±РєР°");
                                        }
                                        await loadClientFieldDefinitions();
                                      }}>РЎРѕС…СЂР°РЅРёС‚СЊ</button>
                                      <button type="button" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => void deleteClientFieldRow(f.id)}>РЈРґР°Р»РёС‚СЊ</button>
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
                  <span className="card-title">РџРѕР»СЊР·РѕРІР°С‚РµР»Рё</span>
                  <button className="btn btn-secondary" onClick={loadUsers}>РћР±РЅРѕРІРёС‚СЊ</button>
                </div>
                <div className="card-body" style={{ display: "grid", gap: 16 }}>
                  {!isAdmin ? (
                    <div style={{ color: "var(--text-secondary)" }}>Р”РѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РґР»СЏ РђРґРјРёРЅР° Рё РЎСѓРїРµСЂ РђРґРјРёРЅР°.</div>
                  ) : (
                    <>
                      {/* create form */}
                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                        <div>
                          <div className="form-label">Р›РѕРіРёРЅ (email)</div>
                          <input className="form-input" value={newUserLogin} onChange={(e) => setNewUserLogin(e.target.value)} placeholder="email РёР»Рё username" />
                        </div>
                        <div>
                          <div className="form-label">РРјСЏ (РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ РІ CRM)</div>
                          <input className="form-input" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="РРІР°РЅ РџРµС‚СЂРѕРІ" />
                        </div>
                        <div>
                          <div className="form-label">РџР°СЂРѕР»СЊ</div>
                          <input className="form-input" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                        </div>
                        <div>
                          <div className="form-label">Р”РѕР»Р¶РЅРѕСЃС‚СЊ / Р РѕР»СЊ РІ РєРѕРјР°РЅРґРµ</div>
                          <input className="form-input" value={newUserPosition} onChange={(e) => setNewUserPosition(e.target.value)} placeholder="Р’РѕСЂРєРµСЂ, РљР°СЃСЃРёСЂ, Р‘СѓС…РіР°Р»С‚РµСЂ..." />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <div className="form-label">Р”РѕСЃС‚СѓРї</div>
                            <select className="form-input" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)}>
                              <option value="WORKER">Р Р°Р±РѕС‚РЅРёРє</option>
                              <option value="MANAGER">РњРµРЅРµРґР¶РµСЂ</option>
                              <option value="ADMIN">РђРґРјРёРЅ РѕС„РёСЃР°</option>
                              {isSuperAdmin && <option value="SUPER_ADMIN">РЎСѓРїРµСЂ РђРґРјРёРЅ</option>}
                            </select>
                          </div>
                          <div>
                            <div className="form-label">РћС„РёСЃ</div>
                            <select className="form-input" value={newUserTargetOrgId} onChange={(e) => setNewUserTargetOrgId(e.target.value)}>
                              <option value="">РўРµРєСѓС‰РёР№</option>
                              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div>
                        <button className="btn btn-primary" onClick={createUser} disabled={!newUserLogin || !newUserPassword}>+ РЎРѕР·РґР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ</button>
                      </div>

                      {/* users table */}
                      <div className="card" style={{ border: "1px solid var(--border-light)" }}>
                        <div className="card-body table-scroll" style={{ padding: 0 }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Р›РѕРіРёРЅ</th>
                                <th>РРјСЏ</th>
                                <th>Р”РѕР»Р¶РЅРѕСЃС‚СЊ</th>
                                <th>РћС„РёСЃ</th>
                                <th>Р”РѕСЃС‚СѓРї</th>
                                <th style={{ width: 260 }}>Р”РµР№СЃС‚РІРёСЏ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usersLoading ? (
                                <tr><td colSpan={6} style={{ padding: 16 }}>Р—Р°РіСЂСѓР·РєР°...</td></tr>
                              ) : users.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: 16 }}>РџРѕРєР° РїСѓСЃС‚Рѕ</td></tr>
                              ) : (
                                users.map((u) => (
                                  <tr key={u.id}>
                                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{u.email}</td>
                                    <td style={{ fontWeight: 600 }}>{u.name || <span style={{ color: "var(--text-tertiary)", fontStyle: "italic", fontWeight: 400 }}>РЅРµ Р·Р°РґР°РЅРѕ</span>}</td>
                                    <td>
                                      {userPositionId === u.id ? (
                                        <div style={{ display: "flex", gap: 4 }}>
                                          <input
                                            className="form-input"
                                            value={userPositionValue}
                                            onChange={(e) => setUserPositionValue(e.target.value)}
                                            placeholder="Р’РѕСЂРєРµСЂ..."
                                            style={{ width: 120 }}
                                          />
                                          <button className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setUserPosition(u.id)}>OK</button>
                                          <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setUserPositionId(null)}>Г—</button>
                                        </div>
                                      ) : (
                                        <span
                                          style={{ cursor: "pointer", color: u.position ? "var(--text-primary)" : "var(--text-tertiary)", fontStyle: u.position ? "normal" : "italic" }}
                                          onClick={() => { setUserPositionId(u.id); setUserPositionValue(u.position ?? ""); }}
                                        >
                                          {u.position || "РЅРµ Р·Р°РґР°РЅР°"}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                      {orgs.find((o) => o.id === u.organizationId)?.name ?? "вЂ”"}
                                    </td>
                                    <td>
                                      <select
                                        className="form-input"
                                        value={u.role}
                                        style={{ width: 120 }}
                                        onChange={(e) => changeUserRole(u.id, e.target.value as any)}
                                      >
                                        <option value="WORKER">Р Р°Р±РѕС‚РЅРёРє</option>
                                        <option value="MANAGER">РњРµРЅРµРґР¶РµСЂ</option>
                                        <option value="ADMIN">РђРґРјРёРЅ РѕС„РёСЃР°</option>
                                        {isSuperAdmin && <option value="SUPER_ADMIN">РЎСѓРїРµСЂ РђРґРјРёРЅ</option>}
                                      </select>
                                    </td>
                                    <td>
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        {userPwdId === u.id ? (
                                          <div style={{ display: "flex", gap: 4 }}>
                                            <input
                                              className="form-input"
                                              type="password"
                                              placeholder="РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ"
                                              value={userPwdValue}
                                              onChange={(e) => setUserPwdValue(e.target.value)}
                                              style={{ width: 120 }}
                                            />
                                            <button className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => resetUserPassword(u.id)}>OK</button>
                                            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => { setUserPwdId(null); setUserPwdValue(""); }}>Г—</button>
                                          </div>
                                        ) : (
                                          <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { setUserPwdId(u.id); setUserPwdValue(""); }}>
                                            РЎРјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ
                                          </button>
                                        )}
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                                          onClick={() => deleteUser(u.id, u.email)}
                                        >РЈРґР°Р»РёС‚СЊ</button>
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

              {/* Audit log вЂ” admin only */}
              {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Р–СѓСЂРЅР°Р» РґРµР№СЃС‚РІРёР№</span>
                    <button className="btn btn-secondary" onClick={() => loadAuditLog(0)} style={{ fontSize: 12 }}>РћР±РЅРѕРІРёС‚СЊ</button>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {auditLoading ? (
                      <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>Р—Р°РіСЂСѓР·РєР°...</div>
                    ) : auditLog.length === 0 ? (
                      <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>РќРµС‚ Р·Р°РїРёСЃРµР№</div>
                    ) : (
                      <>
                        <div className="table-scroll">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Р’СЂРµРјСЏ</th>
                                <th>РЎРѕС‚СЂСѓРґРЅРёРє</th>
                                <th>Р”РµР№СЃС‚РІРёРµ</th>
                                <th>РћР±СЉРµРєС‚</th>
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
                                    {row.entityType ? `${row.entityType}${row.entityId ? ` #${row.entityId.slice(0, 8)}` : ""}` : "вЂ”"}
                                  </td>
                                  <td style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                                    {row.ip ?? "вЂ”"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Pagination */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border-light)", fontSize: 12, color: "var(--text-secondary)" }}>
                          <span>{auditTotal} Р·Р°РїРёСЃРµР№</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-secondary" style={{ fontSize: 11 }} disabled={auditOffset === 0} onClick={() => loadAuditLog(Math.max(0, auditOffset - AUDIT_LIMIT))}>в†ђ РќР°Р·Р°Рґ</button>
                            <span style={{ lineHeight: "28px" }}>{Math.floor(auditOffset / AUDIT_LIMIT) + 1} / {Math.ceil(auditTotal / AUDIT_LIMIT) || 1}</span>
                            <button className="btn btn-secondary" style={{ fontSize: 11 }} disabled={auditOffset + AUDIT_LIMIT >= auditTotal} onClick={() => loadAuditLog(auditOffset + AUDIT_LIMIT)}>Р’РїРµСЂС‘Рґ в†’</button>
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
                <div style={{ color: "var(--text-secondary)" }}>Р—Р°РіСЂСѓР·РєР°...</div>
              ) : (
                <>
                  {/* Info card */}
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Р›РёС‡РЅС‹Рµ РґР°РЅРЅС‹Рµ</span>
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
                            {ROLE_LABELS[profile?.role as Role] ?? profile?.role} В· {profile?.organization?.name}
                          </div>
                          {profile?.position && (
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{profile.position}</div>
                          )}
                        </div>
                      </div>

                      <div className="g2">
                        <div>
                          <div className="form-label">РРјСЏ</div>
                          <input className="form-input" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="РРІР°РЅ РРІР°РЅРѕРІ" />
                        </div>
                        <div>
                          <div className="form-label">Email (Р»РѕРіРёРЅ)</div>
                          <input className="form-input" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} placeholder="email@example.com" />
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>РљРѕРЅС‚Р°РєС‚С‹</div>
                        <div style={{ display: "grid", gap: 12 }}>
                          <div className="g2">
                            <div>
                              <div className="form-label">РўРµР»РµС„РѕРЅ</div>
                              <input className="form-input" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+380 XX XXX XXXX" />
                            </div>
                            <div>
                              <div className="form-label">Telegram</div>
                              <input className="form-input" value={profileTelegram} onChange={(e) => setProfileTelegram(e.target.value)} placeholder="@username" />
                            </div>
                          </div>
                          <div>
                            <div className="form-label">Р”СЂСѓРіРёРµ РєРѕРЅС‚Р°РєС‚С‹</div>
                            <textarea className="form-input" value={profileContacts} onChange={(e) => setProfileContacts(e.target.value)}
                              placeholder="Viber, WhatsApp, РґСЂСѓРіРѕРµ..." style={{ height: 72 }} />
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
                          {profileSaving ? "РЎРѕС…СЂР°РЅСЏРµРј..." : "РЎРѕС…СЂР°РЅРёС‚СЊ"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password change card */}
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">РЎРјРµРЅР° РїР°СЂРѕР»СЏ</span>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 14 }}>
                      <div>
                        <div className="form-label">РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ</div>
                        <input className="form-input" type="password" value={pwdOld} onChange={(e) => setPwdOld(e.target.value)} autoComplete="current-password" />
                      </div>
                      <div className="g2">
                        <div>
                          <div className="form-label">РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ</div>
                          <input className="form-input" type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} autoComplete="new-password" />
                        </div>
                        <div>
                          <div className="form-label">РџРѕРІС‚РѕСЂ РїР°СЂРѕР»СЏ</div>
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
                          {pwdSaving ? "РњРµРЅСЏРµРј..." : "РР·РјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active sessions card */}
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">РђРєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={loadSessions} style={{ fontSize: 12 }}>РћР±РЅРѕРІРёС‚СЊ</button>
                        <button className="btn btn-secondary" onClick={revokeAllSessions} style={{ fontSize: 12, color: "var(--red)" }}>Р—Р°РІРµСЂС€РёС‚СЊ РІСЃРµ РґСЂСѓРіРёРµ</button>
                      </div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      {sessionsLoading ? (
                        <div style={{ padding: "16px", color: "var(--text-secondary)", fontSize: 13 }}>Р—Р°РіСЂСѓР·РєР°...</div>
                      ) : sessions.length === 0 ? (
                        <div style={{ padding: "16px", color: "var(--text-secondary)", fontSize: 13 }}>РќРµС‚ Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёР№</div>
                      ) : (
                        <div style={{ display: "grid" }}>
                          {sessions.map((s, i) => {
                            const ua = s.userAgent ?? "";
                            const isMobile = /mobile|android|iphone|ipad/i.test(ua);
                            const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)[/ ]([\d.]+)/)?.[0] ?? "Р‘СЂР°СѓР·РµСЂ РЅРµРёР·РІРµСЃС‚РµРЅ";
                            const isFirst = i === 0;
                            return (
                              <div key={s.id} style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "12px 16px",
                                borderTop: i > 0 ? "1px solid var(--border-light)" : undefined,
                                background: isFirst ? "var(--accent)06" : undefined,
                              }}>
                                <div style={{ fontSize: 22, flexShrink: 0 }}>{isMobile ? "рџ“±" : "рџ’»"}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    {browser}
                                    {isFirst && (
                                      <span style={{ marginLeft: 8, fontSize: 10, background: "var(--accent-light)", color: "var(--accent)", borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>С‚РµРєСѓС‰Р°СЏ</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                                    IP: {s.ip ?? "вЂ”"} В· РџРѕСЃР»РµРґРЅСЏСЏ Р°РєС‚РёРІРЅРѕСЃС‚СЊ: {new Date(s.lastActiveAt).toLocaleString("ru")}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                    РЎРѕР·РґР°РЅР°: {new Date(s.createdAt).toLocaleString("ru")}
                                  </div>
                                </div>
                                {!isFirst && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 12, flexShrink: 0, color: "var(--red)" }}
                                    onClick={() => revokeSession(s.id)}
                                    disabled={sessionRevoking === s.id}
                                  >
                                    {sessionRevoking === s.id ? "..." : "Р—Р°РІРµСЂС€РёС‚СЊ"}
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

      {/* ===== TEMPLATE MODAL (WIZARD) ===== */}
      {templateModalOpen ? (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setTemplateModalOpen(false); }}>
          <div className="card" style={{ width: 700, maxWidth: "100%", maxHeight: "92vh", overflow: "auto" }}>
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="card-title">{templateEditing ? "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ С€Р°Р±Р»РѕРЅ" : "РќРѕРІС‹Р№ С€Р°Р±Р»РѕРЅ СЃРґРµР»РєРё"}</span>
                {!templateEditing && (
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
                    РЁР°Рі {tplWizardStep === "type" ? "1" : "2"} РёР· 2
                  </span>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => setTemplateModalOpen(false)}>РћС‚РјРµРЅР°</button>
            </div>

            {/* в”Ђв”Ђ РЁРђР“ 1: РІС‹Р±РѕСЂ С‚РёРїР° СЃС…РµРјС‹ в”Ђв”Ђ */}
            {tplWizardStep === "type" && !templateEditing && (
              <div className="card-body" style={{ display: "grid", gap: 20 }}>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  Р’С‹Р±РµСЂРёС‚Рµ, РєР°Рє Р±СѓРґСѓС‚ СЃС‡РёС‚Р°С‚СЊСЃСЏ РґРµРЅСЊРіРё РІ СЃРґРµР»РєР°С… РїРѕ СЌС‚РѕРјСѓ С€Р°Р±Р»РѕРЅСѓ:
                </div>

                {/* РљР°СЂС‚РѕС‡РєР° 1: СЃС…РµРјР° РїРѕСЃСЂРµРґРЅРёРєР° */}
                <div
                  onClick={() => {
                    setTplCalcPreset(CALC_MEDIATOR_AI_PAYROLL);
                    applyMediatorAiPresetFields();
                    setTplWizardStep("fields");
                  }}
                  style={{
                    display: "grid", gridTemplateColumns: "56px 1fr", gap: 16,
                    padding: "18px 20px", borderRadius: 14, cursor: "pointer",
                    border: "2px solid var(--accent)", background: "var(--accent)08",
                    transition: "box-shadow 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent)33")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>рџ’ё</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>РЎС…РµРјР° СЃ РїРѕСЃСЂРµРґРЅРёРєРѕРј, AI Рё СЃРѕС‚СЂСѓРґРЅРёРєР°РјРё</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                      РџРѕРґС…РѕРґРёС‚ РµСЃР»Рё РґРµРЅСЊРіРё РёРґСѓС‚ РїРѕ С†РµРїРѕС‡РєРµ:
                    </div>
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {["РЎСѓРјРјР° Р·Р°РІРѕРґР°", "в†’ РІС‹С‡РµС‚ РїРѕСЃСЂРµРґРЅРёРєР° %", "в†’ РІС‹С‡РµС‚ AI %", "в†’ Р·Р°СЂРїР»Р°С‚РЅС‹Р№ С„РѕРЅРґ %", "в†’ РїСЂРёР±С‹Р»СЊ РѕС„РёСЃР°"].map((s, i) => (
                        <span key={i} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 20, background: i === 0 ? "var(--accent)" : "var(--bg-metric)", color: i === 0 ? "#fff" : "var(--text-secondary)", fontWeight: i === 0 ? 700 : 400 }}>{s}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-tertiary)" }}>
                      РЎРёСЃС‚РµРјР° СЃР°РјР° СЃС‡РёС‚Р°РµС‚ СЃРєРѕР»СЊРєРѕ РєРѕРјСѓ РґРѕСЃС‚Р°С‘С‚СЃСЏ. Р’Р°Рј РѕСЃС‚Р°С‘С‚СЃСЏ С‚РѕР»СЊРєРѕ РІРІРѕРґРёС‚СЊ СЃСѓРјРјС‹ Рё РїСЂРѕС†РµРЅС‚С‹.
                    </div>
                  </div>
                </div>

                {/* РљР°СЂС‚РѕС‡РєР° 2: РїСЂРѕСЃС‚Р°СЏ СЃС…РµРјР° */}
                <div
                  onClick={() => {
                    setTplCalcPreset("");
                    setTplCalcGrossKey(""); setTplCalcMediatorKey(""); setTplCalcAiKey("");
                    setTplCalcSteps([]);
                    setTplFields([]);
                    setTplWizardStep("fields");
                  }}
                  style={{
                    display: "grid", gridTemplateColumns: "56px 1fr", gap: 16,
                    padding: "18px 20px", borderRadius: 14, cursor: "pointer",
                    border: "2px solid var(--border)", background: "var(--bg-card)",
                    transition: "box-shadow 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent)22")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--bg-metric)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>рџ“‹</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>РџСЂРѕРёР·РІРѕР»СЊРЅР°СЏ С„РѕСЂРјР°</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                      Р’С‹ СЃР°РјРё РґРѕР±Р°РІР»СЏРµС‚Рµ РЅСѓР¶РЅС‹Рµ РїРѕР»СЏ вЂ” С‚РµРєСЃС‚, С‡РёСЃР»Р°, СЃРїРёСЃРєРё, С„Р»Р°Р¶РєРё. РџРѕРґС…РѕРґРёС‚ РґР»СЏ Р»СЋР±РѕР№ СЃС‚СЂСѓРєС‚СѓСЂС‹ РґР°РЅРЅС‹С….
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-tertiary)" }}>
                      Р Р°СЃС‡С‘С‚ Р·Р°СЂРїР»Р°С‚С‹ СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ РїРѕ РѕРґРЅРѕРјСѓ РІС‹Р±СЂР°РЅРЅРѕРјСѓ С‡РёСЃР»РѕРІРѕРјСѓ РїРѕР»СЋ.
                    </div>
                  </div>
                </div>

                <div style={{ paddingTop: 4, textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>
                  РќР°Р¶РјРёС‚Рµ РЅР° РєР°СЂС‚РѕС‡РєСѓ С‡С‚РѕР±С‹ РїСЂРѕРґРѕР»Р¶РёС‚СЊ
                </div>
              </div>
            )}

            {/* в”Ђв”Ђ РЁРђР“ 2: РЅР°СЃС‚СЂРѕР№РєР° РїРѕР»РµР№ в”Ђв”Ђ */}
            {(tplWizardStep === "fields" || templateEditing) && (
              <div className="card-body" style={{ display: "grid", gap: 18 }}>

                {/* РќР°Р·РІР°РЅРёРµ */}
                <div>
                  <div className="form-label">РќР°Р·РІР°РЅРёРµ С€Р°Р±Р»РѕРЅР° *</div>
                  <input className="form-input" value={tplName} onChange={(e) => setTplName(e.target.value)}
                    placeholder="РќР°РїСЂРёРјРµСЂ: РћР±РјРµРЅРЅРёРє PLN, РљСЂРёРїС‚Рѕ-СЃС…РµРјР°вЂ¦" autoFocus />
                </div>

                {/* РЎС…РµРјР° вЂ” РєСЂР°С‚РєРёР№ Р±Р»РѕРє, С‚РѕР»СЊРєРѕ РµСЃР»Рё MEDIATOR_AI */}
                {tplCalcPreset === CALC_MEDIATOR_AI_PAYROLL && (
                  <div style={{ display: "grid", gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid var(--accent)33" }}>
                    <div style={{ background: "var(--accent)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>рџ’ё</span>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>РЎС…РµРјР°: РїРѕСЃСЂРµРґРЅРёРє в†’ AI в†’ Р·Р°СЂРїР»Р°С‚РЅС‹Р№ С„РѕРЅРґ в†’ РїСЂРёР±С‹Р»СЊ</span>
                    </div>
                    <div style={{ padding: "12px 16px", background: "var(--accent)06", display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        РўСЂРё РїРѕР»СЏ СЂР°СЃС‡С‘С‚Р° СѓР¶Рµ РґРѕР±Р°РІР»РµРЅС‹ (РІС‹РґРµР»РµРЅС‹ С†РІРµС‚РѕРј Рё Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅС‹). Р’Р°Рј РЅСѓР¶РЅРѕ С‚РѕР»СЊРєРѕ Р·Р°РґР°С‚СЊ <strong>% Р·Р°СЂРїР»Р°С‚РЅРѕРіРѕ С„РѕРЅРґР°</strong> вЂ” СЃРєРѕР»СЊРєРѕ РїСЂРѕС†РµРЅС‚РѕРІ РѕС‚ РѕСЃС‚Р°РІС€РµР№СЃСЏ СЃСѓРјРјС‹ РёРґС‘С‚ РЅР° Р·Р°СЂРїР»Р°С‚С‹ СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ.
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>% Р·Р°СЂРїР»Р°С‚РЅРѕРіРѕ С„РѕРЅРґР°</div>
                        <input
                          className="form-input"
                          value={tplPayrollPoolPct}
                          onChange={(e) => setTplPayrollPoolPct(e.target.value)}
                          type="number" min={0} max={100} step="1"
                          style={{ width: 90, fontFamily: "'JetBrains Mono', monospace" }}
                        />
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          РџСЂРёРјРµСЂ: РїСЂРё 20% вЂ” РµСЃР»Рё РѕСЃС‚Р°Р»РѕСЃСЊ 70, С‚Рѕ 14 РёРґС‘С‚ СЃРѕС‚СЂСѓРґРЅРёРєР°Рј, 56 вЂ” РїСЂРёР±С‹Р»СЊ РѕС„РёСЃР°
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI-РїР°СЂСЃРµСЂ */}
                <div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setAiParseOpen(p => !p)}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, width: "100%", justifyContent: "center" }}
                  >
                    <span>рџ¤–</span> {aiParseOpen ? "РЎРєСЂС‹С‚СЊ AI-РїРѕРјРѕС‰РЅРёРєР°" : "РЎРѕР·РґР°С‚СЊ РїРѕР»СЏ С‡РµСЂРµР· AI (РІСЃС‚Р°РІРёС‚СЊ СЃС‚СЂРѕРєРё РёР· С‚Р°Р±Р»РёС†С‹)"}
                  </button>
                  {aiParseOpen && (
                    <div style={{ marginTop: 10, border: "1px solid var(--accent)44", borderRadius: 12, padding: 16, background: "var(--accent)08" }}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                        Р’СЃС‚Р°РІСЊС‚Рµ 2вЂ“5 СЃС‚СЂРѕРє РёР· РІР°С€РµР№ С‚Р°Р±Р»РёС†С‹. AI СЃР°Рј РѕРїСЂРµРґРµР»РёС‚ РєРѕР»РѕРЅРєРё Рё С‚РёРїС‹ РїРѕР»РµР№.
                      </div>
                      <textarea
                        className="form-input"
                        value={aiParseSample}
                        onChange={e => setAiParseSample(e.target.value)}
                        style={{ height: 90, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", paddingTop: 10 }}
                        placeholder={"21,04  Р”Рё+РѕР»С…(Рќ)  75/25  DP  eurocom  6838\n22.04  Р”Рё+Р’Р»+Р‘Рѕ  45/30/25  DP  eurocom  5809"}
                      />
                      {aiParseError && <div style={{ marginTop: 6, fontSize: 12, color: "var(--red)" }}>{aiParseError}</div>}
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => { setAiParseOpen(false); setAiParseSample(""); setAiParseError(null); }}>РћС‚РјРµРЅР°</button>
                        <button className="btn btn-primary" onClick={aiParseTemplate} disabled={aiParsing || !aiParseSample.trim()}>
                          {aiParsing ? "РђРЅР°Р»РёР·РёСЂСѓСЋ..." : "РћРїСЂРµРґРµР»РёС‚СЊ РїРѕР»СЏ в†’"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* РЎРїРёСЃРѕРє РїРѕР»РµР№ */}
                <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "var(--bg-metric)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>РџРѕР»СЏ СЃРґРµР»РєРё</span>
                      {tplCalcPreset === CALC_MEDIATOR_AI_PAYROLL && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>РџРµСЂРІС‹Рµ 3 РїРѕР»СЏ вЂ” СЂР°СЃС‡С‘С‚РЅС‹Рµ (РЅРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ)</span>
                      )}
                      {tplCalcPreset !== CALC_MEDIATOR_AI_PAYROLL && tplHasWorkers && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>РќР°Р¶РјРёС‚Рµ рџ’° Сѓ С‡РёСЃР»РѕРІРѕРіРѕ РїРѕР»СЏ вЂ” РЅР° РµРіРѕ РѕСЃРЅРѕРІРµ Р±СѓРґРµС‚ СЃС‡РёС‚Р°С‚СЊСЃСЏ Р·Р°СЂРїР»Р°С‚Р°</span>
                      )}
                    </div>
                    <button className="btn btn-secondary" onClick={addTplField}>+ Р”РѕР±Р°РІРёС‚СЊ РїРѕР»Рµ</button>
                  </div>

                  {tplFields.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                      РќР°Р¶РјРёС‚Рµ В«+ Р”РѕР±Р°РІРёС‚СЊ РїРѕР»РµВ» вЂ” РЅР°РїСЂРёРјРµСЂ: Р¤РРћ, РўРµР»РµС„РѕРЅ, Р‘Р°РЅРє, Р’Р°Р»СЋС‚Р°, РњРµС‚РѕРґ
                    </div>
                  ) : (
                    <div style={{ display: "grid" }}>
                      {tplFields.map((f, i) => {
                        const fieldKey = f.key || slugifyFieldKey(f.label, i);
                        const isIncomeField = tplIncomeFieldKey === fieldKey;
                        const canBeIncome = f.type === "NUMBER" || f.type === "PERCENT";
                        const isFixed = ["fixed_gross", "fixed_mediator", "fixed_ai"].includes(f._id);
                        const fixedLabel: Record<string, string> = {
                          fixed_gross: "РЎСѓРјРјР° Р·Р°РІРѕРґР° вЂ” С‡РёСЃР»Рѕ, СЃРєРѕР»СЊРєРѕ РґРµРЅРµРі Р·Р°С€Р»Рѕ",
                          fixed_mediator: "% РїРѕСЃСЂРµРґРЅРёРєР° вЂ” СЃРєРѕР»СЊРєРѕ % Р·Р°Р±РёСЂР°РµС‚ РїРѕСЃСЂРµРґРЅРёРє",
                          fixed_ai: "% AI вЂ” СЃРєРѕР»СЊРєРѕ % СѓС…РѕРґРёС‚ РЅР° AI (РѕС‚ СЃСѓРјРјС‹ РїРѕСЃР»Рµ РїРѕСЃСЂРµРґРЅРёРєР°)",
                        };
                        return (
                          <div key={f._id} style={{
                            padding: "12px 16px",
                            borderTop: i > 0 ? "1px solid var(--border-light)" : undefined,
                            background: isFixed ? "var(--accent)06" : isIncomeField ? "var(--accent)08" : undefined,
                          }}>
                            {isFixed ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 16 }}>{f._id === "fixed_gross" ? "рџ’°" : f._id === "fixed_mediator" ? "рџЏ¦" : "рџ¤–"}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{fixedLabel[f._id]}</div>
                                </div>
                                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--accent)22", color: "var(--accent)", fontWeight: 600 }}>Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅРѕ</span>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px auto 32px", gap: 10, alignItems: "end" }}>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>РќР°Р·РІР°РЅРёРµ РїРѕР»СЏ</div>
                                    <input className="form-input" value={f.label} placeholder="Р¤РРћ, РўРµР»РµС„РѕРЅ, Р‘Р°РЅРє, РњРµС‚РѕРґвЂ¦"
                                      onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))} />
                                  </div>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>РўРёРї РІРІРѕРґР°</div>
                                    <select className="form-input" value={f.type}
                                      onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, type: e.target.value as FieldType } : x))}>
                                      <option value="TEXT">РўРµРєСЃС‚ (Р»СЋР±РѕР№)</option>
                                      <option value="NUMBER">Р§РёСЃР»Рѕ / СЃСѓРјРјР°</option>
                                      <option value="PERCENT">РџСЂРѕС†РµРЅС‚ (0вЂ“100)</option>
                                      <option value="CURRENCY">Р’Р°Р»СЋС‚Р° (USD/EUR/UAHвЂ¦)</option>
                                      <option value="SELECT">РЎРїРёСЃРѕРє РІР°СЂРёР°РЅС‚РѕРІ</option>
                                      <option value="DATE">Р”Р°С‚Р°</option>
                                      <option value="CHECKBOX">Р”Р° / РќРµС‚</option>
                                    </select>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 1 }}>
                                    {tplHasWorkers && canBeIncome && tplCalcPreset !== CALC_MEDIATOR_AI_PAYROLL && (
                                      <button
                                        title="Р—Р°СЂРїР»Р°С‚Р° СЃС‡РёС‚Р°РµС‚СЃСЏ РѕС‚ СЌС‚РѕРіРѕ РїРѕР»СЏ"
                                        onClick={() => setTplIncomeFieldKey(isIncomeField ? "" : fieldKey)}
                                        style={{ height: 38, width: 38, borderRadius: 8, border: isIncomeField ? "2px solid var(--accent)" : "1px solid var(--border)", background: isIncomeField ? "var(--accent)" : "var(--bg-card)", cursor: "pointer", fontSize: 18, transition: "all 0.15s" }}
                                      >рџ’°</button>
                                    )}
                                  </div>
                                  <div style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 20, borderRadius: 8 }}
                                    onClick={() => { setTplFields(p => p.filter((_, xi) => xi !== i)); if (isIncomeField) setTplIncomeFieldKey(""); }}>Г—</div>
                                </div>
                                {f.type === "SELECT" && (
                                  <div style={{ marginTop: 8 }}>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Р’Р°СЂРёР°РЅС‚С‹ РґР»СЏ РІС‹Р±РѕСЂР° (С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ)</div>
                                    <input className="form-input" value={f.options} placeholder="РќР°Р», Р‘РµР·РЅР°Р», РљР°СЂС‚Р°, USDTвЂ¦"
                                      onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, options: e.target.value } : x))} />
                                  </div>
                                )}
                                {isIncomeField && (
                                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--accent)" }}>
                                    рџ’° Р—Р°СЂРїР»Р°С‚Р° СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ СЃС‡РёС‚Р°РµС‚СЃСЏ РєР°Рє % РѕС‚ СЌС‚РѕРіРѕ РїРѕР»СЏ
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* в”Ђв”Ђ Р Р°СЃС‡С‘С‚РЅР°СЏ С†РµРїРѕС‡РєР° в”Ђв”Ђ */}
                {(() => {
                  const numericFields = tplFields.filter(f => f.type === "NUMBER" || f.type === "PERCENT");
                  const allFieldKeys = tplFields.map((f, i) => ({ key: f.key || slugifyFieldKey(f.label, i), label: f.label }));

                  return (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", background: "var(--bg-metric)", borderBottom: tplCalcSteps.length > 0 ? "1px solid var(--border)" : undefined, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>рџ“Љ Р Р°СЃС‡С‘С‚РЅР°СЏ С†РµРїРѕС‡РєР°</span>
                          <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                            {tplCalcSteps.length > 0 ? `${tplCalcSteps.length} С€Р°Рі(РѕРІ)` : "РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ вЂ” РґР»СЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРіРѕ СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ РґРµРЅРµРі"}
                          </span>
                        </div>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setTplCalcSteps(prev => [...prev, {
                            id: `step_${Date.now()}`,
                            label: "",
                            sourceType: "field" as const,
                            sourceId: numericFields[0] ? (numericFields[0].key || slugifyFieldKey(numericFields[0].label, 0)) : "",
                            deductType: "percent" as const,
                            deductFieldKey: "",
                            resultLabel: "",
                            isPayrollPool: false,
                          }])}
                        >+ Р”РѕР±Р°РІРёС‚СЊ С€Р°Рі</button>
                      </div>

                      {tplCalcSteps.length === 0 ? (
                        <div style={{ padding: "16px", fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                          Р¦РµРїРѕС‡РєР° РїРѕР·РІРѕР»СЏРµС‚ РѕРїРёСЃР°С‚СЊ РєР°Рє РґРµРЅСЊРіРё РґРµР»СЏС‚СЃСЏ РїРѕ С€Р°РіР°Рј: РєР°Р¶РґС‹Р№ С€Р°Рі Р±РµСЂС‘С‚ СЃСѓРјРјСѓ РёР· РїСЂРµРґС‹РґСѓС‰РµРіРѕ РѕСЃС‚Р°С‚РєР° РёР»Рё РёР· РїРѕР»СЏ, Рё РІС‹С‡РёС‚Р°РµС‚ % РёР»Рё С„РёРєСЃРёСЂРѕРІР°РЅРЅСѓСЋ СЃСѓРјРјСѓ. РћРґРёРЅ С€Р°Рі РјРѕР¶РЅРѕ РїРѕРјРµС‚РёС‚СЊ РєР°Рє В«Р·Р°СЂРїР»Р°С‚РЅС‹Р№ С„РѕРЅРґВ» вЂ” РѕРЅ Р±СѓРґРµС‚ СЂР°СЃРїСЂРµРґРµР»СЏС‚СЊСЃСЏ РјРµР¶РґСѓ СЃРѕС‚СЂСѓРґРЅРёРєР°РјРё.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 0 }}>
                          {tplCalcSteps.map((step, si) => {
                            const prevSteps = tplCalcSteps.slice(0, si);
                            return (
                              <div key={step.id} style={{ padding: "14px 16px", borderTop: si > 0 ? "1px solid var(--border-light)" : undefined, background: step.isPayrollPool ? "var(--amber)08" : undefined }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: step.isPayrollPool ? "var(--amber)" : "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{si + 1}</span>
                                  <input
                                    className="form-input"
                                    value={step.label}
                                    onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, label: e.target.value } : s))}
                                    placeholder="РќР°Р·РІР°РЅРёРµ С€Р°РіР° (РєРѕРјСѓ РёРґСѓС‚ РґРµРЅСЊРіРё)"
                                    style={{ flex: 1, fontWeight: 600 }}
                                  />
                                  <button
                                    style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", fontSize: 16, color: "var(--text-tertiary)" }}
                                    onClick={() => setTplCalcSteps(p => p.filter(s => s.id !== step.id))}
                                  >Г—</button>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                  {/* Source */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Р’Р·СЏС‚СЊ СЃСѓРјРјСѓ РёР·</div>
                                    <select
                                      className="form-input"
                                      value={`${step.sourceType}:${step.sourceId}`}
                                      onChange={e => {
                                        const [type, ...rest] = e.target.value.split(":");
                                        setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, sourceType: type as "field"|"step", sourceId: rest.join(":") } : s));
                                      }}
                                    >
                                      {allFieldKeys.filter(f => {
                                        const fDef = tplFields.find(tf => (tf.key || slugifyFieldKey(tf.label, 0)) === f.key);
                                        return fDef?.type === "NUMBER" || fDef?.type === "PERCENT";
                                      }).map(f => (
                                        <option key={`field:${f.key}`} value={`field:${f.key}`}>рџ“‹ {f.label}</option>
                                      ))}
                                      {prevSteps.map(ps => (
                                        <option key={`step:${ps.id}`} value={`step:${ps.id}`}>в†© РћСЃС‚Р°С‚РѕРє: {ps.resultLabel || ps.label || `РЁР°Рі ${tplCalcSteps.indexOf(ps) + 1}`}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {/* Deduct field */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Р’С‹С‡РµСЃС‚СЊ РїРѕР»Рµ</div>
                                    <select
                                      className="form-input"
                                      value={step.deductFieldKey}
                                      onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, deductFieldKey: e.target.value } : s))}
                                    >
                                      <option value="">вЂ” РІС‹Р±РµСЂРёС‚Рµ РїРѕР»Рµ вЂ”</option>
                                      {allFieldKeys.filter(f => {
                                        const fDef = tplFields.find(tf => (tf.key || slugifyFieldKey(tf.label, 0)) === f.key);
                                        return fDef?.type === "PERCENT" || fDef?.type === "NUMBER";
                                      }).map(f => (
                                        <option key={f.key} value={f.key}>{f.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {/* Deduct type */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>РўРёРї РІС‹С‡РёС‚Р°РЅРёСЏ</div>
                                    <select
                                      className="form-input"
                                      value={step.deductType}
                                      onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, deductType: e.target.value as "percent"|"fixed" } : s))}
                                    >
                                      <option value="percent">% РѕС‚ РёСЃС‚РѕС‡РЅРёРєР°</option>
                                      <option value="fixed">Р¤РёРєСЃРёСЂРѕРІР°РЅРЅР°СЏ СЃСѓРјРјР°</option>
                                    </select>
                                  </div>
                                  {/* Result label */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>РќР°Р·РІР°РЅРёРµ РѕСЃС‚Р°С‚РєР°</div>
                                    <input
                                      className="form-input"
                                      value={step.resultLabel}
                                      onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, resultLabel: e.target.value } : s))}
                                      placeholder="РќР°РїСЂРёРјРµСЂ: РџРѕСЃР»Рµ РїРѕСЃСЂРµРґРЅРёРєР° (R1)"
                                    />
                                  </div>
                                </div>

                                {/* isPayrollPool */}
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 10 }}>
                                  <input
                                    type="checkbox"
                                    checked={step.isPayrollPool}
                                    onChange={e => setTplCalcSteps(p => p.map(s =>
                                      s.id === step.id ? { ...s, isPayrollPool: e.target.checked } :
                                      e.target.checked ? { ...s, isPayrollPool: false } : s
                                    ))}
                                    style={{ width: 15, height: 15, accentColor: "var(--amber)" }}
                                  />
                                  <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: step.isPayrollPool ? 700 : 400 }}>
                                    рџ‘Ґ Р­С‚Рѕ Р·Р°СЂРїР»Р°С‚РЅС‹Р№ С„РѕРЅРґ вЂ” РІС‹С‡РёС‚Р°РµРјР°СЏ СЃСѓРјРјР° СЂР°СЃРїСЂРµРґРµР»СЏРµС‚СЃСЏ РјРµР¶РґСѓ СЃРѕС‚СЂСѓРґРЅРёРєР°РјРё
                                  </span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Р”Р»СЏ РїСЂРѕСЃС‚РѕР№ СЃС…РµРјС‹ вЂ” РµСЃС‚СЊ Р»Рё РІРѕСЂРєРµСЂС‹ */}
                {tplCalcPreset !== CALC_MEDIATOR_AI_PAYROLL && tplCalcSteps.length === 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={tplHasWorkers} onChange={(e) => setTplHasWorkers(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Р Р°СЃРїСЂРµРґРµР»СЏС‚СЊ Р·Р°СЂРїР»Р°С‚Сѓ СЃРѕС‚СЂСѓРґРЅРёРєР°Рј РїРѕ СЌС‚РѕР№ СЃРґРµР»РєРµ</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Р•СЃР»Рё РІРєР»СЋС‡РµРЅРѕ вЂ” РїСЂРё СЃРѕР·РґР°РЅРёРё СЃРґРµР»РєРё РЅСѓР¶РЅРѕ Р±СѓРґРµС‚ СѓРєР°Р·Р°С‚СЊ РєРѕРјСѓ Рё СЃРєРѕР»СЊРєРѕ %</div>
                    </div>
                  </label>
                )}

                {/* РљРЅРѕРїРєРё */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                  {!templateEditing ? (
                    <button className="btn btn-secondary" onClick={() => setTplWizardStep("type")}>в†ђ РќР°Р·Р°Рґ</button>
                  ) : <div />}
                  <button className="btn btn-primary" onClick={saveTemplate}>
                    {templateEditing ? "РЎРѕС…СЂР°РЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ" : "РЎРѕР·РґР°С‚СЊ С€Р°Р±Р»РѕРЅ в†’"}
                  </button>
                </div>
              </div>
            )}
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
                  РѕС‚ {taskDetail.createdBy.name || taskDetail.createdBy.email} В· {new Date(taskDetail.createdAt).toLocaleDateString("ru-RU")}
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
                }}>Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ</button>
              )}
              {taskEditMode && (
                <>
                  <button className="btn btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => void saveTaskEdit()}>РЎРѕС…СЂР°РЅРёС‚СЊ</button>
                  <button className="btn btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => setTaskEditMode(false)}>РћС‚РјРµРЅР°</button>
                </>
              )}
              <button className="btn btn-ghost" style={{ height: 32, width: 32, padding: 0, fontSize: 18, flexShrink: 0 }} onClick={() => setTaskDetail(null)}>Г—</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Status + badge */}
              {!taskEditMode && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {(() => {
                    const stLabel: Record<TaskStatus, string> = { PENDING: "Рљ РІС‹РїРѕР»РЅРµРЅРёСЋ", IN_PROGRESS: "Р’ СЂР°Р±РѕС‚Рµ", DONE: "Р’С‹РїРѕР»РЅРµРЅРѕ", CANCELLED: "РћС‚РјРµРЅРµРЅР°" };
                    const stClass: Record<TaskStatus, string> = { PENDING: "badge-amber", IN_PROGRESS: "badge-blue", DONE: "badge-green", CANCELLED: "badge-gray" };
                    return <span className={`badge ${stClass[taskDetail.status]}`}>{stLabel[taskDetail.status]}</span>;
                  })()}
                  {taskDetail.dueAt && (
                    <span style={{ fontSize: 12, color: new Date(taskDetail.dueAt) < new Date() && taskDetail.status !== "DONE" ? "var(--amber)" : "var(--text-tertiary)" }}>
                      РЎСЂРѕРє: {new Date(taskDetail.dueAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {/* Quick status actions for assignee */}
                  {user?.id === taskDetail.assignee.id && taskDetail.status !== "DONE" && taskDetail.status !== "CANCELLED" && (
                    <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                      {taskDetail.status === "PENDING" && (
                        <button className="btn btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={() => void patchTask(taskDetail.id, { status: "IN_PROGRESS" }).then(() => setTaskDetail(prev => prev ? { ...prev, status: "IN_PROGRESS" } : null))}>Р’Р·СЏС‚СЊ РІ СЂР°Р±РѕС‚Сѓ</button>
                      )}
                      <button className="btn btn-primary" style={{ height: 28, fontSize: 11 }} onClick={() => void patchTask(taskDetail.id, { status: "DONE" }).then(() => { setTaskDetail(prev => prev ? { ...prev, status: "DONE" } : null); void loadTaskPendingCount(); })}>Р’С‹РїРѕР»РЅРµРЅРѕ вњ“</button>
                    </div>
                  )}
                </div>
              )}

              {/* Edit form */}
              {taskEditMode && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div className="form-label">РћРїРёСЃР°РЅРёРµ</div>
                    <textarea className="form-input" rows={3} value={taskEditDesc} onChange={e => setTaskEditDesc(e.target.value)} placeholder="Р”РµС‚Р°Р»Рё Р·Р°РґР°С‡Рё" />
                  </div>
                  <div>
                    <div className="form-label">РСЃРїРѕР»РЅРёС‚РµР»СЊ</div>
                    <select className="form-input" value={taskEditAssigneeId} onChange={e => setTaskEditAssigneeId(e.target.value)}>
                      {taskUsersForSelect.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                    </select>
                  </div>
                  <div className="g2">
                    <div>
                      <div className="form-label">РќР°С‡Р°Р»Рѕ</div>
                      <input className="form-input" type="datetime-local" value={taskEditStart} onChange={e => setTaskEditStart(e.target.value)} />
                    </div>
                    <div>
                      <div className="form-label">РЎСЂРѕРє</div>
                      <input className="form-input" type="datetime-local" value={taskEditDue} onChange={e => setTaskEditDue(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Description (view) */}
              {!taskEditMode && taskDetail.description && (
                <div>
                  <div className="form-label" style={{ marginBottom: 6 }}>РћРїРёСЃР°РЅРёРµ</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", background: "var(--bg-metric)", borderRadius: 10, padding: "12px 14px" }}>
                    {taskDetail.description}
                  </div>
                </div>
              )}

              {/* Info row */}
              {!taskEditMode && (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>рџ‘¤ РСЃРїРѕР»РЅРёС‚РµР»СЊ: <strong>{taskDetail.assignee.name || taskDetail.assignee.email}</strong></span>
                  {taskDetail.startsAt && <span>рџ“… РќР°С‡Р°Р»Рѕ: {new Date(taskDetail.startsAt).toLocaleDateString("ru-RU")}</span>}
                </div>
              )}

              {/* Comments */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                  РљРѕРјРјРµРЅС‚Р°СЂРёРё {taskComments.length > 0 && <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>({taskComments.length})</span>}
                </div>
                {taskCommentsLoading ? (
                  <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Р—Р°РіСЂСѓР·РєР°вЂ¦</div>
                ) : taskComments.length === 0 ? (
                  <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>РљРѕРјРјРµРЅС‚Р°СЂРёРµРІ РїРѕРєР° РЅРµС‚ вЂ” РЅР°РїРёС€РёС‚Рµ РїРµСЂРІС‹Рј!</div>
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
                placeholder="РќР°РїРёСЃР°С‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёР№вЂ¦ (Enter вЂ” РѕС‚РїСЂР°РІРёС‚СЊ)"
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
