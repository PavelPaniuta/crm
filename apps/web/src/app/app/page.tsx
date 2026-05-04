"use client";

import React, { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const AreaChart = dynamic(() => import("../../components/charts/AreaChart"), { ssr: false });
const DonutChart = dynamic(() => import("../../components/charts/DonutChart"), { ssr: false });
const BarChart = dynamic(() => import("../../components/charts/BarChart"), { ssr: false });

type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "WORKER";

type User = {
  id: string;
  email: string;
  role: Role;
  activeOrganizationId: string;
};

type ClientPipelineStatus = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
  color: string | null;
  isTerminal: boolean;
};

type Client = {
  id: string;
  name: string;
  phone: string;
  note?: string | null;
  statusId?: string | null;
  status?: ClientPipelineStatus | null;
  bank?: string | null;
  assistantName?: string | null;
  callSummary?: string | null;
  callStartedAt?: string | null;
  customData?: Record<string, unknown>;
};

type ClientFormState = {
  name: string;
  phone: string;
  note: string;
  statusId: string;
  bank: string;
  assistantName: string;
  callSummary: string;
  callStartedAt: string;
};

function emptyClientForm(): ClientFormState {
  return {
    name: "",
    phone: "",
    note: "",
    statusId: "",
    bank: "",
    assistantName: "",
    callSummary: "",
    callStartedAt: "",
  };
}

/** Разбор текста из бота / мессенджера (строки «Клиент:», «Телефон:», …). */
function parseClientLeadPaste(text: string): Partial<ClientFormState> {
  const norm = text.replace(/\r\n/g, "\n");
  const pickLine = (re: RegExp) => {
    const m = norm.match(re);
    return m ? m[1].replace(/\s+$/u, "").trim() : "";
  };
  const out: Partial<ClientFormState> = {};
  const assistant = pickLine(/[Аа]ссистент\s*[:：]\s*(.+)/im);
  if (assistant) out.assistantName = assistant;
  const bank = pickLine(/Банк\s*[:：]\s*(.+)/im);
  if (bank) out.bank = bank;
  const name = pickLine(/Клиент\s*[:：]\s*(.+)/im);
  if (name) out.name = name;
  const phone = pickLine(/Телефон\s*[:：]\s*(.+)/im);
  if (phone) out.phone = phone;
  const sumM = norm.match(/Summary\s*[:：]\s*([\s\S]+?)(?=\n\s*[⏰]|\n\s*Время\s+начала|$)/im);
  if (sumM) out.callSummary = sumM[1].trim();
  else {
    const one = pickLine(/Summary\s*[:：]\s*(.+)/im);
    if (one) out.callSummary = one;
  }
  const timeM = norm.match(/Время\s+начала\s+звонка\s*[:：]\s*(.+)/im);
  if (timeM) {
    const p = timeM[1].trim().match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*,\s*(\d{1,2}):(\d{2})/);
    if (p) {
      const [, d, mo, y, h, mi] = p;
      out.callStartedAt = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}`;
    }
  }
  return out;
}

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

type Tab = "dashboard" | "deals" | "clients" | "expenses" | "reports" | "settings" | "profile" | "staff" | "tasks" | "assistant" | "chat" | "salary";
type DealStatus = "NEW" | "IN_PROGRESS" | "CLOSED";
type OperationType = "PURCHASE" | "ATM" | "TRANSFER";
type FieldType = "TEXT" | "NUMBER" | "SELECT" | "DATE" | "PERCENT" | "CHECKBOX" | "CURRENCY";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Текст",
  NUMBER: "Число",
  SELECT: "Список",
  DATE: "Дата",
  PERCENT: "Процент",
  CHECKBOX: "Да / нет",
  CURRENCY: "Сумма",
};

const FIELD_TYPES_ALL: FieldType[] = ["TEXT", "NUMBER", "SELECT", "DATE", "PERCENT", "CHECKBOX", "CURRENCY"];

function clientFormSectionStyle(muted?: boolean): React.CSSProperties {
  return {
    border: "1px solid var(--border-light)",
    borderRadius: 12,
    padding: "16px 18px",
    background: muted ? "var(--bg-metric)" : "var(--bg-card)",
    display: "grid",
    gap: 14,
  };
}

type ClientFieldDef = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  order: number;
  options?: string | null;
};

type TemplateField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  order: number;
  options?: string | null;
};

const CALC_MEDIATOR_AI_PAYROLL = "MEDIATOR_AI_PAYROLL" as const;

function slugifyFieldKey(label: string, i: number): string {
  return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_а-яё]/gi, "") || `field_${i}`;
}

// ─── Universal Calc Chain ────────────────────────────────────────────────────
type CalcStep = {
  id: string;
  label: string;
  sourceType: "field" | "step";
  sourceId: string;
  deductType: "percent" | "fixed";
  deductFieldKey: string;
  resultLabel: string;
  isPayrollPool: boolean;
};

type CalcStepResult = {
  step: CalcStep;
  source: number;
  deductAmt: number;
  result: number;
};

function computeChain(data: Record<string, string>, steps: CalcStep[]): CalcStepResult[] {
  const results: Record<string, number> = {};
  return steps.map((step) => {
    const source = step.sourceType === "field"
      ? Number(data[step.sourceId]) || 0
      : (results[step.sourceId] ?? 0);
    const deductVal = Number(data[step.deductFieldKey]) || 0;
    const deductAmt = step.deductType === "percent" ? source * (deductVal / 100) : deductVal;
    results[step.id] = source - deductAmt;
    return { step, source, deductAmt, result: results[step.id] };
  });
}

function getPayrollBaseFromChain(chain: CalcStepResult[]): number {
  const payrollStep = chain.find((c) => c.step.isPayrollPool);
  if (payrollStep) return Math.max(0, payrollStep.deductAmt);
  const last = chain[chain.length - 1];
  return last ? Math.max(0, last.result) : 0;
}

// ─── Template type ────────────────────────────────────────────────────────────
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

function parsePayrollPoolPct(tpl: DealTemplate): number {
  if (tpl.payrollPoolPct == null) return 20;
  const n = Number(tpl.payrollPoolPct);
  return Number.isFinite(n) ? n : 20;
}

/** % ИИ от остатка после посредника (R1). Фонд: % от R2. */
function computeMediatorAiPayrollFront(
  data: Record<string, string>,
  tpl: DealTemplate,
): { G: number; M: number; R1: number; A: number; R2: number; F: number; P: number } | null {
  if (tpl.calcPreset !== CALC_MEDIATOR_AI_PAYROLL) return null;
  const gk = tpl.calcGrossFieldKey;
  const mk = tpl.calcMediatorPctKey;
  const ak = tpl.calcAiPctKey;
  if (!gk || !mk || !ak) return null;
  const G = Number(data[gk]) || 0;
  const pM = Number(data[mk]) || 0;
  const pAi = Number(data[ak]) || 0;
  const poolPct = parsePayrollPoolPct(tpl);
  const M = G * (pM / 100);
  const R1 = G - M;
  const A = R1 * (pAi / 100);
  const R2 = R1 - A;
  const F = R2 * (poolPct / 100);
  const P = R2 - F;
  return { G, M, R1, A, R2, F, P };
}

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

const CURRENCIES = ["USD", "EUR", "UAH", "PLN", "CHF"];
const CURRENCY_META: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: "$",  name: "US Dollar" },
  EUR: { symbol: "€",  name: "Euro" },
  UAH: { symbol: "₴",  name: "Ukrainian Hryvnia" },
  PLN: { symbol: "zł", name: "Polish Zloty" },
  CHF: { symbol: "Fr", name: "Swiss Franc" },
};

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
  const [clientStatuses, setClientStatuses] = useState<ClientPipelineStatus[]>([]);
  const [clientFieldDefs, setClientFieldDefs] = useState<ClientFieldDef[]>([]);
  const [clientStatusFilter, setClientStatusFilter] = useState<string>("all");
  const [clientSearchQ, setClientSearchQ] = useState("");
  const [newClientForm, setNewClientForm] = useState<ClientFormState>(emptyClientForm);
  const [newClientCustom, setNewClientCustom] = useState<Record<string, string>>({});
  const [clientPasteImport, setClientPasteImport] = useState("");
  const [clientCreateModalOpen, setClientCreateModalOpen] = useState(false);
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [clientEditing, setClientEditing] = useState<Client | null>(null);
  const [clientEditForm, setClientEditForm] = useState<ClientFormState>(emptyClientForm);
  const [clientEditCustom, setClientEditCustom] = useState<Record<string, string>>({});
  const [newClientStatusSlug, setNewClientStatusSlug] = useState("");
  const [newClientStatusLabel, setNewClientStatusLabel] = useState("");
  const [newClientFieldKey, setNewClientFieldKey] = useState("");
  const [newClientFieldLabel, setNewClientFieldLabel] = useState("");
  const [newClientFieldType, setNewClientFieldType] = useState<FieldType>("TEXT");
  const [clientStatusDrafts, setClientStatusDrafts] = useState<Record<string, { label: string; sortOrder: string; color: string; isTerminal: boolean }>>({});
  const [clientFieldDrafts, setClientFieldDrafts] = useState<Record<string, { label: string; order: string; options: string; type: FieldType; required: boolean }>>({});

  // --- Expenses ---
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseCurrency, setNewExpenseCurrency] = useState("PLN");
  const [newExpensePayMethod, setNewExpensePayMethod] = useState("bank");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseEditing, setExpenseEditing] = useState<Expense | null>(null);
  const [expenseEditMode, setExpenseEditMode] = useState(false);
  const [expenseEditTitle, setExpenseEditTitle] = useState("");
  const [expenseEditAmount, setExpenseEditAmount] = useState("");
  const [expenseEditCurrency, setExpenseEditCurrency] = useState("PLN");
  const [expenseEditPayMethod, setExpenseEditPayMethod] = useState("bank");

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
  const [ratesEditing, setRatesEditing] = useState<Record<string, string>>({});
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

  // --- Salary ---
  const [salaryData, setSalaryData] = useState<any[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryPeriod, setSalaryPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedSalaryEmp, setSelectedSalaryEmp] = useState<any | null>(null);
  const [salaryConfigModal, setSalaryConfigModal] = useState<{ userId: string; name: string; config: any } | null>(null);
  const [salaryPaymentModal, setSalaryPaymentModal] = useState<{ userId: string; name: string; orgId: string } | null>(null);
  const [salaryConfigForm, setSalaryConfigForm] = useState({ baseAmount: "", currency: "USD", payDay: "1", note: "" });
  const [salaryPaymentForm, setSalaryPaymentForm] = useState({ amount: "", currency: "USD", type: "BASE", note: "", isPaid: false });

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
    if (tab === "salary") return "Зарплата";
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
    if (tab === "dashboard" && user?.role !== "WORKER") { loadDashboard(); loadDeals(); loadExpenses(); }
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
  }, [tab]);

  // ---- loaders ----
  async function loadClients() {
    setClientsLoading(true);
    try {
      const q = clientSearchQ.trim();
      const url = q ? `/api/clients?q=${encodeURIComponent(q)}` : "/api/clients";
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) return;
      const j = await res.json();
      setClients(Array.isArray(j) ? j : []);
    } finally { setClientsLoading(false); }
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

  const clientsFiltered = useMemo(() => {
    if (clientStatusFilter === "all") return clients;
    return clients.filter((c) => (c.status?.id ?? c.statusId) === clientStatusFilter);
  }, [clients, clientStatusFilter]);

  /** Группировка списка по статусу (порядок как в настройках воронки). */
  const clientsGroupedByStatus = useMemo(() => {
    type Section = { key: string; label: string; color: string | null | undefined; clients: Client[] };
    const map = new Map<string, Client[]>();
    for (const c of clientsFiltered) {
      const sid = (c.status?.id ?? c.statusId) || "__none__";
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(c);
    }
    const used = new Set<string>();
    const sections: Section[] = [];
    for (const s of [...clientStatuses].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const list = map.get(s.id);
      if (list?.length) {
        sections.push({ key: s.id, label: s.label, color: s.color, clients: list });
        used.add(s.id);
      }
    }
    const none = map.get("__none__");
    if (none?.length) {
      sections.push({ key: "__none__", label: "Без статуса", color: null, clients: none });
      used.add("__none__");
    }
    for (const [key, list] of map) {
      if (!used.has(key) && list.length) {
        const st = list[0]?.status;
        sections.push({ key, label: st?.label ?? "Статус", color: st?.color, clients: list });
      }
    }
    return sections;
  }, [clientsFiltered, clientStatuses]);

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
      const res = await fetch("/api/expenses", { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) return;
      const j = await res.json();
      setExpenses(Array.isArray(j) ? j : []);
    } finally { setExpensesLoading(false); }
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
        const data = await res.json();
        setSalaryData(data);
        // refresh cabinet if open
        setSelectedSalaryEmp((prev: any) => prev ? data.find((e: any) => e.userId === prev.userId) ?? prev : null);
      }
    } finally { setSalaryLoading(false); }
  }

  async function saveSalaryConfig() {
    if (!salaryConfigModal) return;
    const res = await fetch(`/api/salary/config/${salaryConfigModal.userId}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseAmount: Number(salaryConfigForm.baseAmount) || 0,
        currency: salaryConfigForm.currency,
        payDay: Number(salaryConfigForm.payDay) || 1,
        note: salaryConfigForm.note || undefined,
      }),
    });
    if (res.ok) { setSalaryConfigModal(null); loadSalary(); }
    else { const j = await res.json(); alert(j.message || "Ошибка сохранения"); }
  }

  async function addSalaryPayment() {
    if (!salaryPaymentModal) return;
    const res = await fetch("/api/salary/payments", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: salaryPaymentModal.userId,
        organizationId: salaryPaymentModal.orgId,
        amount: Number(salaryPaymentForm.amount) || 0,
        currency: salaryPaymentForm.currency,
        period: salaryPeriod,
        type: salaryPaymentForm.type,
        note: salaryPaymentForm.note || undefined,
        isPaid: salaryPaymentForm.isPaid,
      }),
    });
    if (res.ok) { setSalaryPaymentModal(null); loadSalary(); }
    else { const j = await res.json(); alert(j.message || "Ошибка"); }
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
        if (salaryData.length === 0) loadSalary();
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

  /** Инициализирует поля и цепочку для схемы посредник → AI → ЗП фонд */
  function applyMediatorAiPresetFields() {
    const fixed: Array<{ _id: string; key: string; label: string; type: FieldType; required: boolean; options: string }> = [
      { _id: "fixed_gross",    key: "сумма_завода",       label: "Сумма завода",          type: "NUMBER",  required: true,  options: "" },
      { _id: "fixed_mediator", key: "процент_посредника", label: "% посредника",          type: "PERCENT", required: true,  options: "" },
      { _id: "fixed_ai",       key: "процент_аи",         label: "% AI",                  type: "PERCENT", required: true,  options: "" },
      { _id: "fixed_payroll",  key: "процент_зп_фонда",   label: "% зарплатного фонда",   type: "PERCENT", required: true,  options: "" },
    ];
    const presetSteps: CalcStep[] = [
      {
        id: "step_mediator",
        label: "Выплата посредника",
        sourceType: "field",
        sourceId: "сумма_завода",
        deductType: "percent",
        deductFieldKey: "процент_посредника",
        resultLabel: "После посредника (R1)",
        isPayrollPool: false,
      },
      {
        id: "step_ai",
        label: "Доля AI",
        sourceType: "step",
        sourceId: "step_mediator",
        deductType: "percent",
        deductFieldKey: "процент_аи",
        resultLabel: "После AI (R2)",
        isPayrollPool: false,
      },
      {
        id: "step_payroll",
        label: "Зарплатный фонд",
        sourceType: "step",
        sourceId: "step_ai",
        deductType: "percent",
        deductFieldKey: "процент_зп_фонда",
        resultLabel: "Прибыль офиса",
        isPayrollPool: true,
      },
    ];
    setTplCalcPreset(CALC_MEDIATOR_AI_PAYROLL);
    setTplCalcSteps(presetSteps);
    setTplHasWorkers(true);
    setTplCalcGrossKey("сумма_завода");
    setTplCalcMediatorKey("процент_посредника");
    setTplCalcAiKey("процент_аи");
    setTplIncomeFieldKey("сумма_завода");
    setTplFields((prev) => {
      const existing = prev.filter((f) => !["fixed_gross","fixed_mediator","fixed_ai","fixed_payroll"].includes(f._id));
      return [...fixed, ...existing];
    });
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

    // Validate calc chain if configured
    if (tplCalcSteps.length > 0) {
      const fields2 = tplFields.map((f, i) => ({ key: f.key || slugifyFieldKey(f.label, i), label: f.label }));
      const fieldKeys = new Set(fields2.map(x => x.key));
      for (const step of tplCalcSteps) {
        if (!step.label.trim()) return alert("У каждого шага цепочки должно быть название");
        if (!step.deductFieldKey) return alert(`Шаг «${step.label}»: укажите поле для вычитания`);
        if (!fieldKeys.has(step.deductFieldKey)) return alert(`Шаг «${step.label}»: поле «${step.deductFieldKey}» не найдено в полях шаблона`);
        if (step.sourceType === "field" && step.sourceId && !fieldKeys.has(step.sourceId))
          return alert(`Шаг «${step.label}»: поле-источник «${step.sourceId}» не найдено`);
      }
    }

    // Legacy validation for old preset (when no calcSteps)
    if (tplCalcPreset === CALC_MEDIATOR_AI_PAYROLL && tplCalcSteps.length === 0) {
      if (!tplCalcGrossKey || !tplCalcMediatorKey || !tplCalcAiKey) {
        return alert("Для цепочки «Посредник → ИИ → фонд» укажите поля: сумма завода, % посредника, % ИИ");
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
        return alert(`Ошибка сохранения шаблона:\n${Array.isArray(detail) ? detail.join("\n") : detail}`);
      }
    } else {
      const res = await fetch("/api/deal-templates", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const detail = j?.message ?? j?.error ?? `HTTP ${res.status}`;
        return alert(`Ошибка создания шаблона:\n${Array.isArray(detail) ? detail.join("\n") : detail}`);
      }
    }
    setTemplateModalOpen(false);
    loadTemplates();
  }

  async function deleteTemplate(id: string, name: string) {
    if (!confirm(`Удалить шаблон "${name}"? Существующие сделки не будут затронуты.`)) return;
    await fetch(`/api/deal-templates/${id}`, { method: "DELETE", credentials: "include" });
    loadTemplates();
  }

  async function saveExchangeRates() {
    for (const code of CURRENCIES) {
      const raw = ratesEditing[code];
      if (raw === undefined) continue;
      const val = Number(raw);
      if (!Number.isFinite(val) || val <= 0) { alert(`Некорректный курс для ${code}`); return; }
    }
    for (const code of CURRENCIES) {
      const raw = ratesEditing[code];
      if (raw === undefined) continue;
      const val = Number(raw);
      await fetch(`/api/exchange-rates/${code}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateToUsd: val, symbol: CURRENCY_META[code]?.symbol, name: CURRENCY_META[code]?.name }),
      });
    }
    await loadExchangeRates();
    setRatesModalOpen(false);
    setRatesEditing({});
  }

  async function loadDashboard(from?: string, to?: string) {
    setDashLoading(true);
    const f = from ?? dashFrom;
    const t = to ?? dashTo;
    try {
      const res = await fetch(`/api/dashboard?from=${f}&to=${t}`, { credentials: "include" });
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

  async function loadGlobalDash(from?: string, to?: string) {
    setGlobalDashLoading(true);
    const f = from ?? dashFrom;
    const t = to ?? dashTo;
    try {
      const res = await fetch(`/api/dashboard/global?from=${f}&to=${t}`, { credentials: "include" });
      if (res.ok) setGlobalDash(await res.json());
    } finally { setGlobalDashLoading(false); }
  }

  // ---- clients ----
  function applyClientPasteToNewForm() {
    const p = parseClientLeadPaste(clientPasteImport);
    setNewClientForm((f) => ({ ...f, ...p }));
  }

  async function createClient() {
    const { name, phone, note, statusId, bank, assistantName, callSummary, callStartedAt } = newClientForm;
    if (!name.trim() || !phone.trim()) return alert("Укажите имя и телефон");
    const customData: Record<string, string> = {};
    for (const def of clientFieldDefs) {
      const v = newClientCustom[def.key]?.trim() ?? "";
      if (v) customData[def.key] = v;
    }
    const res = await fetch("/api/clients", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.trim(),
        note: note.trim() || undefined,
        statusId: statusId || undefined,
        bank: bank.trim() || null,
        assistantName: assistantName.trim() || null,
        callSummary: callSummary.trim() || null,
        callStartedAt: callStartedAt || null,
        customData: Object.keys(customData).length ? customData : undefined,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return alert(j.message ?? "Не удалось создать клиента");
    }
    setNewClientForm(emptyClientForm());
    setNewClientCustom({});
    setClientPasteImport("");
    setClientCreateModalOpen(false);
    await loadClients();
  }

  function openClientCreateModal() {
    setNewClientForm(emptyClientForm());
    setNewClientCustom({});
    setClientPasteImport("");
    setClientCreateModalOpen(true);
  }

  function openClientEdit(c: Client) {
    setClientEditing(c);
    setClientEditForm({
      name: c.name,
      phone: c.phone,
      note: c.note ?? "",
      statusId: c.status?.id ?? c.statusId ?? "",
      bank: c.bank ?? "",
      assistantName: c.assistantName ?? "",
      callSummary: c.callSummary ?? "",
      callStartedAt: c.callStartedAt
        ? new Date(c.callStartedAt).toISOString().slice(0, 16)
        : "",
    });
    const cd = c.customData && typeof c.customData === "object" ? (c.customData as Record<string, unknown>) : {};
    const next: Record<string, string> = {};
    for (const def of clientFieldDefs) {
      next[def.key] = cd[def.key] != null ? String(cd[def.key]) : "";
    }
    setClientEditCustom(next);
    setClientEditOpen(true);
  }

  async function saveClientEdit() {
    if (!clientEditing) return;
    const { name, phone, note, statusId, bank, assistantName, callSummary, callStartedAt } = clientEditForm;
    if (!name.trim() || !phone.trim()) return alert("Укажите имя и телефон");
    const customData: Record<string, string> = {};
    for (const def of clientFieldDefs) {
      customData[def.key] = clientEditCustom[def.key]?.trim() ?? "";
    }
    const res = await fetch(`/api/clients/${clientEditing.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.trim(),
        note: note.trim() || null,
        statusId: statusId || null,
        bank: bank.trim() || null,
        assistantName: assistantName.trim() || null,
        callSummary: callSummary.trim() || null,
        callStartedAt: callStartedAt || null,
        customData,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return alert(j.message ?? "Не удалось обновить клиента");
    }
    setClientEditOpen(false);
    await loadClients();
  }

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

  async function saveExpenseEdit() {
    if (!expenseEditing) return;
    const amount = Number(expenseEditAmount);
    if (!Number.isFinite(amount) || !expenseEditTitle.trim()) return alert("Проверьте поля");
    const res = await fetch(`/api/expenses/${expenseEditing.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: expenseEditTitle, amount, currency: expenseEditCurrency, payMethod: expenseEditPayMethod }),
    });
    if (!res.ok) return alert("Не удалось сохранить расход");
    const updated: Expense = await res.json();
    setExpenses((prev) => prev.map((e) => e.id === updated.id ? updated : e));
    setExpenseEditing(updated);
    setExpenseEditMode(false);
  }

  async function deleteExpense(id: string) {
    if (!confirm("Удалить расход?")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return alert("Не удалось удалить расход");
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setExpenseModalOpen(false);
    setExpenseEditing(null);
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

  async function openDealModal() {
    const tRes = await fetch("/api/deal-templates", { credentials: "include" });
    if (!tRes.ok) {
      alert("Не удалось загрузить шаблоны");
      return;
    }
    const list: DealTemplate[] = await tRes.json();
    setTemplates(list);
    if (list.length === 0) {
      alert("Создайте хотя бы один шаблон сделки: Настройки → блок «Шаблоны сделок».");
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

  const participantIncomeInfo = useMemo(() => {
    const activeTpl = dealTemplateId ? templates.find((t) => t.id === dealTemplateId) : null;
    if (!activeTpl) {
      return { base: dealTotals.tAmountOut, label: "сумма «получили»" };
    }
    // New: universal calc chain
    if (activeTpl.calcSteps && activeTpl.calcSteps.length > 0 && dealDataRows[0]) {
      const chain = computeChain(dealDataRows[0].data, activeTpl.calcSteps);
      const payrollStep = chain.find((c) => c.step.isPayrollPool);
      const base = payrollStep
        ? Math.max(0, payrollStep.deductAmt)
        : chain.length > 0 ? Math.max(0, chain[chain.length - 1].result) : 0;
      const label = payrollStep
        ? `Зарплатный фонд (${payrollStep.step.label})`
        : chain.length > 0 ? chain[chain.length - 1].step.resultLabel : "Результат расчёта";
      return { base, label };
    }
    // Legacy: MEDIATOR_AI_PAYROLL
    if (activeTpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && dealDataRows[0]) {
      const c = computeMediatorAiPayrollFront(dealDataRows[0].data, activeTpl);
      if (c) return { base: c.F, label: "зарплатный фонд (F), после AI/автоматики" };
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
                {orgs.find((o) => o.id === user?.activeOrganizationId)?.name ?? "…"}
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
              staff: "Сотрудники", salary: "Зарплата", tasks: "Задачи", chat: "Чат",
              assistant: "AI Ассистент", settings: "Настройки", profile: "Профиль"
            };
            const NAV_SVG: Record<string, ReactElement> = {
              dashboard: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
              deals: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
              clients: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              expenses: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
              reports: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
              staff: <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
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
              <div className="sidebar-user-name">{user?.email ?? "…"}</div>
              <div className="sidebar-user-role">{user ? (ROLE_LABELS[user.role] ?? user.role) : "…"}</div>
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
            <div style={{ display: "grid", gap: 20 }}>

              {/* Period bar */}
              <div className="dash-period-bar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div className="dash-period-dates" style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, flexWrap: "wrap" }}>
                  <input className="form-input" type="date" value={dashFrom} onChange={(e) => setDashFrom(e.target.value)} style={{ maxWidth: 160 }} />
                  <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>—</span>
                  <input className="form-input" type="date" value={dashTo} onChange={(e) => setDashTo(e.target.value)} style={{ maxWidth: 160 }} />
                  <button className="btn btn-secondary" style={{ whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => dashView === "global" ? loadGlobalDash() : loadDashboard()}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    Обновить
                  </button>
                  {/* Quick period shortcuts */}
                  {([
                    { label: "Месяц", getRange: () => { const n = new Date(); return { f: new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0,10), t: n.toISOString().slice(0,10) }; } },
                    { label: "3 мес",  getRange: () => { const n = new Date(); return { f: new Date(n.getFullYear(), n.getMonth()-2, 1).toISOString().slice(0,10), t: n.toISOString().slice(0,10) }; } },
                    { label: "Год",    getRange: () => { const n = new Date(); return { f: new Date(n.getFullYear(), 0, 1).toISOString().slice(0,10), t: n.toISOString().slice(0,10) }; } },
                    { label: "Всё",    getRange: () => ({ f: "2020-01-01", t: new Date().toISOString().slice(0,10) }) },
                  ]).map(q => (
                    <button key={q.label} className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px", flexShrink: 0 }}
                      onClick={() => { const { f, t } = q.getRange(); setDashFrom(f); setDashTo(t); if (dashView === "global") loadGlobalDash(f, t); else loadDashboard(f, t); }}>
                      {q.label}
                    </button>
                  ))}
                </div>
                {isSuperAdmin ? (
                  <div className="filter-tabs dash-view-tabs">
                    {([{ id: "current", label: "Текущий офис" }, { id: "global", label: "Все офисы" }] as const).map((v) => (
                      <button key={v.id} className={`filter-tab${dashView === v.id ? " active" : ""}`}
                        onClick={() => { setDashView(v.id); if (v.id === "global") loadGlobalDash(); else loadDashboard(); }}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {dashView === "current" ? (
                <>
                  {/* 4 Metric cards — TailAdmin style */}
                  {dashLoading || !dash ? (
                    <div className="metric-grid">
                      {[0,1,2,3].map(i => (
                        <div key={i} className="metric-card" style={{ minHeight: 110, animation: "pulse 1.5s ease infinite" }}>
                          <div style={{ height: 44, width: 44, borderRadius: 10, background: "var(--bg-metric)" }} />
                          <div style={{ height: 20, borderRadius: 6, background: "var(--bg-metric)", marginTop: 8 }} />
                        </div>
                      ))}
                    </div>
                  ) : (() => {
                    const amountOut = dash.deals?.totalAmountOut ?? 0;
                    const workersTotal = dash.deals?.totalWorkersPayoutUsdt ?? 0;
                    // officeIncome: prefer backend-computed value, fallback to gross-workers if 0
                    const officeIncomeRaw = dash.deals?.totalOfficeIncome ?? 0;
                    const officeIncome = officeIncomeRaw > 0 ? officeIncomeRaw : Math.max(0, amountOut - workersTotal);
                    const expTotal = dash.expenses?.totalAmount ?? 0;
                    const profit = officeIncome - expTotal;
                    const metrics = [
                      {
                        label: "Сделки за период",
                        value: String(dash.deals?.count ?? 0),
                        sub: `Новых: ${dash.deals?.byStatus?.NEW ?? 0} · В работе: ${dash.deals?.byStatus?.IN_PROGRESS ?? 0}`,
                        iconColor: "#6366F1", iconBg: "rgba(99,102,241,0.1)",
                        trend: null,
                        icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
                      },
                      {
                        label: "Завод (брутто)",
                        value: amountOut.toLocaleString(),
                        sub: `Офису: ${officeIncome.toLocaleString()} · Воркерам: ${workersTotal.toLocaleString()}`,
                        iconColor: "#059669", iconBg: "rgba(5,150,105,0.1)",
                        trend: amountOut > 0 ? "up" : "neutral",
                        icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>,
                      },
                      {
                        label: "Расходы",
                        value: expTotal.toLocaleString(),
                        sub: `Записей: ${dash.expenses?.count ?? 0}`,
                        iconColor: "#D97706", iconBg: "rgba(217,119,6,0.1)",
                        trend: expTotal > 0 ? "down" : "neutral",
                        icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
                      },
                      {
                        label: "Прибыль офиса",
                        value: profit.toLocaleString(),
                        sub: "Заработок офиса минус расходы",
                        iconColor: profit >= 0 ? "#059669" : "#DC2626",
                        iconBg: profit >= 0 ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
                        trend: profit >= 0 ? "up" : "down",
                        icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
                      },
                    ];
                    return (
                      <div className="metric-grid">
                        {metrics.map((m) => (
                          <div key={m.label} className="metric-card">
                            <div className="metric-card-top">
                              <div className="metric-icon" style={{ background: m.iconBg, color: m.iconColor }}>{m.icon}</div>
                              {m.trend && (
                                <div className={`metric-trend ${m.trend}`}>
                                  {m.trend === "up" ? (
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                                  ) : m.trend === "down" ? (
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            <div className="metric-body">
                              <div className="metric-value">{m.value}</div>
                              <div className="metric-label">{m.label}</div>
                              <div className="metric-sub">{m.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Charts row */}
                  {dash && !dashLoading && (
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                      {/* Area chart — deals by status over time (simulated from current data) */}
                      <div className="chart-card">
                        <div className="chart-header">
                          <div>
                            <div className="chart-title">Динамика сделок</div>
                            <div className="chart-sub">по статусам за период</div>
                          </div>
                          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-tertiary)" }}>
                            {[
                              { label: "Новые", color: "#6366F1" },
                              { label: "В работе", color: "#D97706" },
                              { label: "Закрыты", color: "#059669" },
                            ].map(l => (
                              <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
                                {l.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="chart-body">
                          {(() => {
                            // Filter deals by selected period and group by date
                            const fromTs = dashFrom ? new Date(dashFrom).getTime() : 0;
                            const toTs = dashTo ? new Date(dashTo + "T23:59:59").getTime() : Infinity;
                            const byDay: Record<string, number> = {};
                            for (const d of deals) {
                              const dt = d.dealDate ? new Date(d.dealDate) : null;
                              if (!dt) continue;
                              const ts = dt.getTime();
                              if (ts < fromTs || ts > toTs) continue;
                              let value = d.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
                              if (value === 0 && d.template && d.dataRows && d.dataRows.length > 0) {
                                const rowData = (d.dataRows[0] as any).data as Record<string, string>;
                                const tpl = d.template as DealTemplate;
                                if (Array.isArray(tpl.calcSteps) && tpl.calcSteps.length > 0) {
                                  const chain = computeChain(rowData, tpl.calcSteps as CalcStep[]);
                                  if (chain.length > 0) value = chain[0].source;
                                } else if (tpl.incomeFieldKey) {
                                  value = Number(rowData[tpl.incomeFieldKey]) || 0;
                                } else if (tpl.calcGrossFieldKey) {
                                  value = Number(rowData[tpl.calcGrossFieldKey]) || 0;
                                }
                              }
                              const key = dt.toISOString().slice(0, 10);
                              byDay[key] = (byDay[key] ?? 0) + value;
                            }
                            const chartData = Object.entries(byDay)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([dateStr, value]) => ({
                                label: new Date(dateStr).toLocaleDateString("ru", { day: "numeric", month: "short" }),
                                value: Math.round(value * 100) / 100,
                              }));
                            return (
                              <AreaChart
                                data={chartData}
                                title="Выход"
                                height={230}
                                color="#6366F1"
                              />
                            );
                          })()}
                        </div>
                      </div>

                      {/* Donut — deals by status */}
                      <div className="chart-card">
                        <div className="chart-header">
                          <div>
                            <div className="chart-title">Статусы сделок</div>
                            <div className="chart-sub">распределение</div>
                          </div>
                        </div>
                        <div className="chart-body">
                          <DonutChart
                            data={[
                              { label: "Новые", value: dash.deals?.byStatus?.NEW ?? 0, color: "#6366F1" },
                              { label: "В работе", value: dash.deals?.byStatus?.IN_PROGRESS ?? 0, color: "#D97706" },
                              { label: "Закрыты", value: dash.deals?.byStatus?.CLOSED ?? 0, color: "#059669" },
                            ].filter(d => d.value > 0)}
                            height={265}
                            totalLabel="Сделок"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="dash-quick-actions g3" style={{ gap: 12 }}>
                    {[
                      { title: "Новая сделка", desc: "Создать сделку с клиентом", action: () => { setTab("deals"); setTimeout(openDealModal, 50); }, color: "#6366F1", bg: "rgba(99,102,241,0.1)",
                        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
                      { title: "Новый клиент", desc: "Добавить по номеру телефона", action: () => { setTab("clients"); openClientCreateModal(); }, color: "#059669", bg: "rgba(5,150,105,0.1)",
                        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> },
                      { title: "Новый расход", desc: "Крипта, офис, материалы", action: () => setTab("expenses"), color: "#D97706", bg: "rgba(217,119,6,0.1)",
                        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> },
                    ].map((a) => (
                      <button key={a.title} onClick={a.action} style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                        padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
                        cursor: "pointer", transition: "var(--transition)", textAlign: "left",
                        fontFamily: "inherit", boxShadow: "var(--shadow-card)",
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = a.color; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)"; }}
                      >
                        <div style={{ width: 42, height: 42, borderRadius: 11, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", color: a.color, flexShrink: 0 }}>{a.icon}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.title}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>{a.desc}</div>
                        </div>
                        <svg width="14" height="14" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" viewBox="0 0 24 24" style={{ marginLeft: "auto", flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    ))}
                  </div>

                  {/* Recent activity: deals + expenses */}
                  <div className="dash-recent-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {/* Recent deals */}
                    <div className="card">
                      <div className="card-header">
                        <span className="card-title">Последние сделки</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setTab("deals")} style={{ color: "var(--accent)" }}>Все →</button>
                      </div>
                      <div className="table-scroll" style={{ padding: 0 }}>
                        <table className="data-table">
                          <thead><tr><th>Клиент</th><th>Статус</th><th style={{ textAlign: "right" }}>Выход</th></tr></thead>
                          <tbody>
                            {deals.length === 0 ? (
                              <tr><td colSpan={3} style={{ padding: "20px 18px", color: "var(--text-secondary)" }}>Нет сделок за период</td></tr>
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
                        <button className="btn btn-ghost btn-sm" onClick={() => setTab("expenses")} style={{ color: "var(--accent)" }}>Все →</button>
                      </div>
                      <div className="table-scroll" style={{ padding: 0 }}>
                        <table className="data-table">
                          <thead><tr><th>Название</th><th>Статус</th><th style={{ textAlign: "right" }}>Сумма</th></tr></thead>
                          <tbody>
                            {expenses.length === 0 ? (
                              <tr><td colSpan={3} style={{ padding: "20px 18px", color: "var(--text-secondary)" }}>Нет расходов</td></tr>
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
                <div style={{ display: "grid", gap: 16 }}>
                  {globalDashLoading || !globalDash ? (
                    <div className="card" style={{ padding: 24, color: "var(--text-secondary)" }}>Загрузка...</div>
                  ) : (
                    <>
                      <div className="metric-grid">
                        {[
                          { label: "Сделок всего", value: String(globalDash.totals?.dealsCount ?? 0), iconBg: "rgba(99,102,241,0.1)", iconColor: "#6366F1", icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
                          { label: "Доход", value: (globalDash.totals?.totalAmountOut ?? 0).toLocaleString(), iconBg: "rgba(5,150,105,0.1)", iconColor: "#059669", icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg> },
                          { label: "Воркерам", value: (globalDash.totals?.totalWorkersPayoutUsdt ?? 0).toLocaleString(), iconBg: "rgba(99,102,241,0.1)", iconColor: "#6366F1", icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
                          { label: "Расходы", value: (globalDash.totals?.totalExpenses ?? 0).toLocaleString(), iconBg: "rgba(217,119,6,0.1)", iconColor: "#D97706", icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> },
                        ].map((c) => (
                          <div key={c.label} className="metric-card">
                            <div className="metric-card-top"><div className="metric-icon" style={{ background: c.iconBg, color: c.iconColor }}>{c.icon}</div></div>
                            <div className="metric-body"><div className="metric-value">{c.value}</div><div className="metric-label">{c.label}</div></div>
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

                      {/* Bar chart: revenue by org */}
                      {(globalDash.byOrg ?? []).length > 0 && (
                        <div className="chart-card" style={{ margin: "0 0 0 0" }}>
                          <div className="chart-header">
                            <div className="chart-title">Доход по офисам</div>
                          </div>
                          <div className="chart-body">
                            <BarChart
                              data={(globalDash.byOrg ?? []).map((r: any) => ({ label: r.orgName, value: r.totalAmountOut ?? 0 }))}
                              color="#6366F1"
                              title="Доход"
                              height={220}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
                  {isManager && (
                    <>
                      <input
                        className="form-input"
                        style={{ width: 72 }}
                        title="Год для дат «23.04» (без года в ячейке)"
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
                        {legacyImporting ? "Импорт…" : "Импорт Excel"}
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
                                  {totalOut > 0 ? `${totalOut.toLocaleString("ru-RU")}${dealCurrencyLabel ? " " + dealCurrencyLabel : ""}` : "—"}
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
                                  {t.calcPreset === CALC_MEDIATOR_AI_PAYROLL ? " · расчёт посредник/ИИ/фонд" : ""}
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
                                alert("Выберите шаблон");
                                return;
                              }
                              setDealTemplateStep("form");
                            }}
                          >
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
                        return (
                          <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                              <div className="form-label" style={{ margin: 0 }}>Данные [{tpl.name}]</div>
                              {tpl.calcPreset !== CALC_MEDIATOR_AI_PAYROLL && (
                                <button className="btn btn-secondary" onClick={() => setDealDataRows(p => [...p, { _id: crypto.randomUUID(), data: {} }])}>+ Добавить строку</button>
                              )}
                            </div>
                            {tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && (
                              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>Одна строка на сделку. Расчёт по полям: сумма завода, % посредника, % ИИ (от остатка после посредника), затем {parsePayrollPoolPct(tpl)}% в зарплатный фонд.</div>
                            )}
                            {dealDataRows.map((row, ri) => (
                              <div key={row._id} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Строка {ri + 1}</span>
                                  {dealDataRows.length > 1 && (
                                    <span style={{ cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }} onClick={() => setDealDataRows(p => p.filter(x => x._id !== row._id))}>×</span>
                                  )}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                                  {tpl.fields.map((f) => {
                                    const isGross = tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && f.key === tpl.calcGrossFieldKey;
                                    const isMediator = tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && f.key === tpl.calcMediatorPctKey;
                                    const isAi = tpl.calcPreset === CALC_MEDIATOR_AI_PAYROLL && f.key === tpl.calcAiPctKey;
                                    const calcBadge = isGross ? { icon: "💰", color: "var(--accent)", tip: "База расчёта" }
                                      : isMediator ? { icon: "🏦", color: "var(--amber)", tip: "% посредника" }
                                      : isAi ? { icon: "🤖", color: "var(--text-secondary)", tip: "% AI" }
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
                                          <option value="">— валюта —</option>
                                          {CURRENCIES.map(c => (
                                            <option key={c} value={c}>{CURRENCY_META[c]?.symbol} {c} — {CURRENCY_META[c]?.name}</option>
                                          ))}
                                        </select>
                                      ) : f.type === "SELECT" ? (
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
                                    📊 Расчёт распределения
                                    {!hasValues && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>— заполните числовые поля выше</span>}
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
                                            {isPayroll ? "👥" : "−"} {cr.step.label} ({deductLabel})
                                          </span>
                                          <span style={{ textAlign: "right", color: isPayroll ? "var(--amber)" : "var(--text-tertiary)", fontWeight: isPayroll ? 700 : 400 }}>
                                            − {fmt(cr.deductAmt)}
                                          </span>
                                          <span style={{
                                            color: isLast ? "var(--green)" : "var(--text-secondary)",
                                            fontWeight: isLast ? 700 : 400,
                                            borderTop: "1px dashed var(--border)", paddingTop: 3,
                                          }}>
                                            {isLast ? "🏢 " : ""}{cr.step.resultLabel}
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
                              const c = dealDataRows[0] ? computeMediatorAiPayrollFront(dealDataRows[0].data, tpl) : null;
                              const fmt = (n: number) => n > 0 ? n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : "0";
                              const grossField = tpl.fields.find(f => f.key === tpl.calcGrossFieldKey);
                              return (
                                <div style={{ marginTop: 8, padding: 14, background: "var(--accent)08", borderRadius: 10, border: "2px solid var(--accent)33" }}>
                                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                    📊 Расчёт распределения
                                    {(!c || c.G === 0) && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 4 }}>— заполните {grossField?.label ?? "Сумма завода"} 💰 выше</span>}
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 16px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                                    <span style={{ color: "var(--text-secondary)" }}>💰 Сумма завода</span><span style={{ textAlign: "right", fontWeight: 700 }}>{fmt(c?.G ?? 0)}</span>
                                    <span style={{ color: "var(--text-tertiary)" }}>🏦 Посредник</span><span style={{ textAlign: "right", color: "var(--text-tertiary)" }}>− {fmt(c?.M ?? 0)}</span>
                                    <span style={{ color: "var(--text-secondary)", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>R1</span><span style={{ textAlign: "right", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>{fmt(c?.R1 ?? 0)}</span>
                                    <span style={{ color: "var(--text-tertiary)" }}>🤖 AI</span><span style={{ textAlign: "right", color: "var(--text-tertiary)" }}>− {fmt(c?.A ?? 0)}</span>
                                    <span style={{ color: "var(--text-secondary)", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>R2</span><span style={{ textAlign: "right", borderTop: "1px dashed var(--border)", paddingTop: 3 }}>{fmt(c?.R2 ?? 0)}</span>
                                    <span style={{ color: "var(--amber)" }}>👥 ЗП фонд ({parsePayrollPoolPct(tpl)}%)</span><span style={{ textAlign: "right", color: "var(--amber)", fontWeight: 700 }}>− {fmt(c?.F ?? 0)}</span>
                                    <span style={{ fontWeight: 700, color: "var(--green)", borderTop: "2px solid var(--border)", paddingTop: 4 }}>🏢 Прибыль офиса</span><span style={{ textAlign: "right", fontWeight: 700, color: "var(--green)", borderTop: "2px solid var(--border)", paddingTop: 4 }}>{fmt(c?.P ?? 0)}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })() : (
                      <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div className="form-label" style={{ margin: 0 }}>Операции (классика, без шаблона) *</div>
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
                                  👥 Зарплата сотрудников
                                  {totalPct === 100 && filledParticipants.length > 0 && (
                                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--green-bg)", color: "var(--green-text)", fontWeight: 600 }}>✓ распределено</span>
                                  )}
                                </div>
                                {isMediator && incomeBase > 0 ? (
                                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                                    Фонд для распределения:&nbsp;
                                    <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--accent)", fontSize: 14 }}>{incomeBase.toLocaleString()}</strong>
                                    &nbsp;— это {parsePayrollPoolPct(activeTplForParts!)}% от суммы после всех вычетов. Раздели 100% этой суммы между сотрудниками.
                                  </div>
                                ) : incomeBase > 0 ? (
                                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                                    База: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{incomeBase.toLocaleString()}</strong> · укажи % каждому сотруднику, в сумме 100%
                                  </div>
                                ) : (
                                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-tertiary)" }}>Укажи суммы в полях выше — сразу увидишь сколько получит каждый</div>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                {filledParticipants.length > 1 && (
                                  <button className="btn btn-secondary" style={{ fontSize: 12, height: 32 }} onClick={splitEvenly} title="Разделить поровну">⚖️ Поровну</button>
                                )}
                                <button className="btn btn-secondary" style={{ fontSize: 12, height: 32 }} onClick={() => setDealParticipants((p) => [...p, { id: crypto.randomUUID(), userId: "", pct: remaining > 0 ? String(remaining) : "0" }])}>
                                  + Сотрудник
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
                                      <option value="">— выбрать сотрудника —</option>
                                      {dealWorkers.map((w) => (
                                        <option key={w.id} value={w.id}>
                                          {w.name || w.email}{w.position ? ` · ${w.position}` : ""}
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
                                      ) : <span style={{ color: "var(--border)" }}>—</span>}
                                    </div>
                                    {/* Remove */}
                                    <button
                                      style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
                                      onClick={() => setDealParticipants((pp) => pp.filter((x) => x.id !== p.id))}
                                    >×</button>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Footer: progress bar + total */}
                            {dealParticipants.length > 0 && (
                              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-light)", background: "var(--bg-metric)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Распределено: <strong style={{ color: totalPct === 100 ? "var(--green)" : totalPct > 100 ? "var(--red)" : "var(--amber)" }}>{totalPct}%</strong></span>
                                  {incomeBase > 0 && (
                                    <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "var(--text-secondary)" }}>
                                      {dealParticipants.filter(p => p.userId).reduce((s, p) => s + Math.round(incomeBase * (Number(p.pct) || 0) / 100 * 100) / 100, 0).toLocaleString()} из {incomeBase.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <div style={{ height: 6, borderRadius: 6, background: "var(--border)", overflow: "hidden" }}>
                                  <div style={{ height: "100%", borderRadius: 6, background: totalPct === 100 ? "var(--green)" : totalPct > 100 ? "var(--red)" : "var(--accent)", width: `${Math.min(totalPct, 100)}%`, transition: "width 0.2s" }} />
                                </div>
                                {totalPct !== 100 && (
                                  <div style={{ marginTop: 6, fontSize: 12, color: totalPct > 100 ? "var(--red)" : "var(--amber)" }}>
                                    {totalPct > 100 ? `⚠ Превышение на ${totalPct - 100}% — уменьши проценты` : `Осталось распределить: ${100 - totalPct}%${incomeBase > 0 ? ` (${Math.round(incomeBase * (100 - totalPct) / 100 * 100) / 100} в сумме)` : ""}`}
                                  </div>
                                )}
                              </div>
                            )}
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
              <div className="page-header" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                <div className="page-header-left" style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div className="page-header-title">Клиенты</div>
                  <div className="page-header-sub">Список сгруппирован по статусам воронки. Добавление — кнопкой ниже или через AI ассистента (одно подтверждение). Воронку и поля настраивают в «Настройки».</div>
                </div>
                <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => openClientCreateModal()}>+ Добавить клиента</button>
              </div>

              <div className="card">
                <div className="card-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <span className="card-title">Список клиентов</span>
                    <button type="button" className="btn btn-secondary" onClick={() => void loadClients()}>Обновить список</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "12px 14px", background: "var(--bg-metric)", borderRadius: 10, border: "1px solid var(--border-light)" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginRight: 4 }}>Фильтры</span>
                    <input className="form-input" style={{ minWidth: 180, flex: "1 1 160px", maxWidth: 280 }} placeholder="Поиск по имени, телефону, банку…" value={clientSearchQ} onChange={(e) => setClientSearchQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loadClients(); }} />
                    <button type="button" className="btn btn-secondary" onClick={() => void loadClients()}>Найти</button>
                    <select className="form-input" style={{ minWidth: 200, maxWidth: 260 }} value={clientStatusFilter} onChange={(e) => setClientStatusFilter(e.target.value)}>
                      <option value="all">Все статусы</option>
                      {clientStatuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="card-body" style={{ padding: "18px 16px 20px" }}>
                  {clientsLoading ? (
                    <div style={{ padding: 24, color: "var(--text-secondary)" }}>Загрузка...</div>
                  ) : clientsFiltered.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <svg width="22" height="22" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <div className="empty-state-title">Нет клиентов</div>
                      <div className="empty-state-desc">Измените фильтр или нажмите «Добавить клиента» / создайте карточку через AI ассистента</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                      {clientsGroupedByStatus.map((sec) => {
                        const accent = sec.color || "var(--accent)";
                        const tint = sec.color ? `${sec.color}14` : "var(--bg-metric)";
                        return (
                          <div key={sec.key} style={{ borderRadius: 14, border: "1px solid var(--border-light)", overflow: "hidden", background: "var(--bg-card)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <div style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                              padding: "12px 16px", background: tint, borderLeft: `4px solid ${accent}`,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{sec.label}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", background: "var(--bg-card)", padding: "3px 10px", borderRadius: 999, border: "1px solid var(--border-light)" }}>{sec.clients.length}</span>
                              </div>
                            </div>
                            <div style={{ padding: "16px 14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                              {sec.clients.map((c) => {
                                const st = c.status;
                                const badgeBg = st?.color ? `${st.color}22` : "var(--accent-light)";
                                const badgeFg = st?.color ?? "var(--accent)";
                                return (
                                  <div key={c.id} className="card" style={{
                                    border: "1px solid var(--border-light)",
                                    margin: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0,
                                    overflow: "hidden",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                  }}>
                                    <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, background: "var(--bg-card)" }}>
                                      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                                        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--green-bg)", color: "var(--green-text)", fontWeight: 700, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                          {(c.name || "?")[0].toUpperCase()}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25 }}>{c.name}</div>
                                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{c.phone}</div>
                                        </div>
                                      </div>
                                      {st ? (
                                        <span className="badge" style={{ background: badgeBg, color: badgeFg, flexShrink: 0, fontSize: 11 }}>{st.label}</span>
                                      ) : null}
                                    </div>
                                    <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)", display: "grid", gap: 8, background: "var(--bg-metric)", borderTop: "1px solid var(--border-light)" }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Звонок</div>
                                      {c.bank ? <div><span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Банк</span><span style={{ margin: "0 6px", color: "var(--border-color)" }}>·</span>{c.bank}</div> : <div style={{ color: "var(--text-tertiary)" }}>Банк не указан</div>}
                                      {c.assistantName ? <div><span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Ассистент</span><span style={{ margin: "0 6px", color: "var(--border-color)" }}>·</span>{c.assistantName}</div> : null}
                                      {c.callStartedAt ? (
                                        <div><span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Время</span><span style={{ margin: "0 6px", color: "var(--border-color)" }}>·</span>
                                          {new Date(c.callStartedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                      ) : null}
                                    </div>
                                    {c.callSummary ? (
                                      <div style={{ padding: "12px 16px 14px" }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>Итог разговора</div>
                                        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, maxHeight: 130, overflow: "auto" }}>
                                          {c.callSummary}
                                        </div>
                                      </div>
                                    ) : null}
                                    <div style={{ display: "flex", gap: 8, padding: "12px 16px", marginTop: "auto", borderTop: "1px solid var(--border-light)", background: "var(--bg-card)" }}>
                                      <button type="button" className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }} onClick={() => openClientEdit(c)}>Редактировать</button>
                                      <button type="button" className="btn btn-ghost" style={{ fontSize: 13, color: "var(--red-text)" }} onClick={() => deleteClient(c.id)}>Удалить</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {clientCreateModalOpen ? (
                <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 55 }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) setClientCreateModalOpen(false); }}>
                  <div className="card" style={{ width: 640, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", margin: 0 }}>
                    <div className="card-header" style={{ alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="card-title">Новый клиент</span>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.45 }}>Вставьте текст из бота или заполните поля вручную</div>
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={() => setClientCreateModalOpen(false)}>Закрыть</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 18 }}>
                      <div style={clientFormSectionStyle(true)}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Из Telegram / бота</div>
                        <div className="form-label">Вставьте целиком сообщение</div>
                        <textarea className="form-input" rows={4} value={clientPasteImport} onChange={(e) => setClientPasteImport(e.target.value)} placeholder="Строки «Клиент:», «Телефон:», «Банк:», «Ассистент:», Summary, время звонка…" style={{ resize: "vertical", minHeight: 80 }} />
                        <button type="button" className="btn btn-secondary" style={{ justifySelf: "start" }} onClick={applyClientPasteToNewForm}>Разобрать текст и подставить в форму</button>
                      </div>

                      <div style={clientFormSectionStyle()}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Обязательно</div>
                        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                          <div>
                            <div className="form-label">Имя клиента *</div>
                            <input className="form-input" value={newClientForm.name} onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))} placeholder="Как в CRM" />
                          </div>
                          <div>
                            <div className="form-label">Телефон *</div>
                            <input className="form-input" value={newClientForm.phone} onChange={(e) => setNewClientForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+48 …" style={{ fontFamily: "'JetBrains Mono', monospace" }} />
                          </div>
                          <div>
                            <div className="form-label">Статус воронки</div>
                            <select className="form-input" value={newClientForm.statusId} onChange={(e) => setNewClientForm((f) => ({ ...f, statusId: e.target.value }))}>
                              <option value="">Авто — первый статус в списке</option>
                              {clientStatuses.map((s) => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div style={clientFormSectionStyle()}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Данные звонка / лида</div>
                        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                          <div>
                            <div className="form-label">Банк</div>
                            <input className="form-input" value={newClientForm.bank} onChange={(e) => setNewClientForm((f) => ({ ...f, bank: e.target.value }))} placeholder="PKO BP, …" />
                          </div>
                          <div>
                            <div className="form-label">Ассистент</div>
                            <input className="form-input" value={newClientForm.assistantName} onChange={(e) => setNewClientForm((f) => ({ ...f, assistantName: e.target.value }))} placeholder="Кто вёл линию" />
                          </div>
                          <div>
                            <div className="form-label">Начало звонка</div>
                            <input className="form-input" type="datetime-local" value={newClientForm.callStartedAt} onChange={(e) => setNewClientForm((f) => ({ ...f, callStartedAt: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <div className="form-label">Итог разговора (summary)</div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>Текст из бота или кратко своими словами</div>
                          <textarea className="form-input" rows={4} value={newClientForm.callSummary} onChange={(e) => setNewClientForm((f) => ({ ...f, callSummary: e.target.value }))} style={{ resize: "vertical", minHeight: 88 }} />
                        </div>
                      </div>

                      <div style={clientFormSectionStyle(true)}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Только для офиса</div>
                        <div>
                          <div className="form-label">Внутренняя заметка</div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>Не для карточки из бота; видят сотрудники CRM</div>
                          <input className="form-input" value={newClientForm.note} onChange={(e) => setNewClientForm((f) => ({ ...f, note: e.target.value }))} placeholder="Напоминание менеджеру" />
                        </div>
                      </div>

                      {clientFieldDefs.length > 0 ? (
                        <div style={clientFormSectionStyle()}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Дополнительные поля</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: -6, marginBottom: 4 }}>Настраиваются в «Настройки» → клиенты</div>
                          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                            {clientFieldDefs.map((def) => (
                              <div key={def.id} style={{ paddingBottom: 12, borderBottom: "1px dashed var(--border-light)" }}>
                                <div className="form-label">{def.label}{def.required ? " *" : ""}</div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>{FIELD_TYPE_LABELS[def.type]}</div>
                                {def.type === "CHECKBOX" ? (
                                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                    <input type="checkbox" checked={newClientCustom[def.key] === "true"} onChange={(e) => setNewClientCustom((m) => ({ ...m, [def.key]: e.target.checked ? "true" : "" }))} />
                                    <span style={{ fontSize: 13 }}>Да</span>
                                  </label>
                                ) : def.type === "SELECT" && def.options ? (
                                  <select className="form-input" value={newClientCustom[def.key] ?? ""} onChange={(e) => setNewClientCustom((m) => ({ ...m, [def.key]: e.target.value }))}>
                                    <option value="">Выберите…</option>
                                    {def.options.split(/[\n,]/).map((o) => o.trim()).filter(Boolean).map((o) => (
                                      <option key={o} value={o}>{o}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input className="form-input" type={def.type === "NUMBER" || def.type === "PERCENT" || def.type === "CURRENCY" ? "text" : def.type === "DATE" ? "date" : "text"} value={newClientCustom[def.key] ?? ""} onChange={(e) => setNewClientCustom((m) => ({ ...m, [def.key]: e.target.value }))} />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: "1px solid var(--border-light)", flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setClientCreateModalOpen(false)}>Отмена</button>
                        <button type="button" className="btn btn-primary" onClick={() => void createClient()} disabled={!newClientForm.name.trim() || !newClientForm.phone.trim()}>Создать клиента</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {clientEditOpen && clientEditing ? (
                <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) setClientEditOpen(false); }}>
                  <div className="card" style={{ width: 580, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }}>
                    <div className="card-header" style={{ alignItems: "flex-start" }}>
                      <div>
                        <span className="card-title">Редактирование клиента</span>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Блоки ниже совпадают с формой создания</div>
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={() => setClientEditOpen(false)}>Закрыть</button>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 16 }}>
                      <div style={clientFormSectionStyle()}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Основное</div>
                        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                          <div>
                            <div className="form-label">Имя *</div>
                            <input className="form-input" value={clientEditForm.name} onChange={(e) => setClientEditForm((f) => ({ ...f, name: e.target.value }))} />
                          </div>
                          <div>
                            <div className="form-label">Телефон *</div>
                            <input className="form-input" value={clientEditForm.phone} onChange={(e) => setClientEditForm((f) => ({ ...f, phone: e.target.value }))} style={{ fontFamily: "'JetBrains Mono', monospace" }} />
                          </div>
                        </div>
                        <div>
                          <div className="form-label">Статус воронки</div>
                          <select className="form-input" value={clientEditForm.statusId} onChange={(e) => setClientEditForm((f) => ({ ...f, statusId: e.target.value }))}>
                            {clientStatuses.map((s) => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={clientFormSectionStyle()}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Звонок / лид</div>
                        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                          <div>
                            <div className="form-label">Банк</div>
                            <input className="form-input" value={clientEditForm.bank} onChange={(e) => setClientEditForm((f) => ({ ...f, bank: e.target.value }))} />
                          </div>
                          <div>
                            <div className="form-label">Ассистент</div>
                            <input className="form-input" value={clientEditForm.assistantName} onChange={(e) => setClientEditForm((f) => ({ ...f, assistantName: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <div className="form-label">Начало звонка</div>
                          <input className="form-input" type="datetime-local" value={clientEditForm.callStartedAt} onChange={(e) => setClientEditForm((f) => ({ ...f, callStartedAt: e.target.value }))} />
                        </div>
                        <div>
                          <div className="form-label">Итог разговора</div>
                          <textarea className="form-input" rows={4} value={clientEditForm.callSummary} onChange={(e) => setClientEditForm((f) => ({ ...f, callSummary: e.target.value }))} style={{ resize: "vertical" }} />
                        </div>
                      </div>
                      <div style={clientFormSectionStyle(true)}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Только для офиса</div>
                        <div>
                          <div className="form-label">Внутренняя заметка</div>
                          <input className="form-input" value={clientEditForm.note} onChange={(e) => setClientEditForm((f) => ({ ...f, note: e.target.value }))} />
                        </div>
                      </div>
                      {clientFieldDefs.length > 0 ? (
                        <div style={clientFormSectionStyle()}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Дополнительные поля</div>
                          <div style={{ display: "grid", gap: 14 }}>
                            {clientFieldDefs.map((def) => (
                              <div key={def.id}>
                                <div className="form-label">{def.label}{def.required ? " *" : ""}</div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>{FIELD_TYPE_LABELS[def.type]}</div>
                                {def.type === "CHECKBOX" ? (
                                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input type="checkbox" checked={clientEditCustom[def.key] === "true"} onChange={(e) => setClientEditCustom((m) => ({ ...m, [def.key]: e.target.checked ? "true" : "" }))} />
                                    <span style={{ fontSize: 13 }}>Да</span>
                                  </label>
                                ) : def.type === "SELECT" && def.options ? (
                                  <select className="form-input" value={clientEditCustom[def.key] ?? ""} onChange={(e) => setClientEditCustom((m) => ({ ...m, [def.key]: e.target.value }))}>
                                    <option value="">—</option>
                                    {def.options.split(/[\n,]/).map((o) => o.trim()).filter(Boolean).map((o) => (
                                      <option key={o} value={o}>{o}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input className="form-input" type={def.type === "NUMBER" || def.type === "PERCENT" || def.type === "CURRENCY" ? "text" : def.type === "DATE" ? "date" : "text"} value={clientEditCustom[def.key] ?? ""} onChange={(e) => setClientEditCustom((m) => ({ ...m, [def.key]: e.target.value }))} />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setClientEditOpen(false)}>Отмена</button>
                        <button type="button" className="btn btn-primary" onClick={() => void saveClientEdit()}>Сохранить</button>
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

              {/* Multi-currency summary for admin+ */}
              {isAdmin && expenses.length > 0 && (() => {
                const byCurrency: Record<string, number> = {};
                for (const e of expenses) {
                  byCurrency[e.currency] = (byCurrency[e.currency] ?? 0) + Number(e.amount);
                }
                const totalUsd = Object.entries(byCurrency).reduce((s, [cur, amt]) => s + toUsd(amt, cur), 0);
                return (
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Итого по валютам</span>
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>≈ {totalUsd.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} USD</span>
                    </div>
                    <div className="card-body" style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {Object.entries(byCurrency).map(([cur, amt]) => (
                          <div key={cur} style={{ background: "var(--bg-metric)", borderRadius: 10, padding: "8px 14px", minWidth: 110 }}>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>{CURRENCY_META[cur]?.name ?? cur}</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16 }}>
                              {CURRENCY_META[cur]?.symbol ?? ""}{amt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>≈ {toUsd(amt, cur).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} USD</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Расходы</span>
                  <button className="btn btn-secondary" onClick={loadExpenses}>Обновить</button>
                </div>
                <div className="card-body table-scroll" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Название</th><th>Статус</th><th style={{ textAlign: "right" }}>Сумма</th>{isAdmin && <th style={{ width: 40 }}></th>}</tr>
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
                          <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => { setExpenseEditing(e); setExpenseEditMode(false); setExpenseModalOpen(true); }}>
                            <td style={{ fontWeight: 500 }}>{e.title}</td>
                            <td>
                              <span className={`badge ${e.status === "APPROVED" ? "badge-green" : e.status === "SUBMITTED" ? "badge-blue" : e.status === "REJECTED" ? "badge-red" : "badge-amber"}`}>
                                {e.status === "APPROVED" ? "Одобрен" : e.status === "SUBMITTED" ? "На проверке" : e.status === "REJECTED" ? "Отклонён" : "Черновик"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{Number(e.amount).toLocaleString()} {e.currency}</td>
                            {isAdmin && (
                              <td style={{ width: 40, padding: "0 8px 0 0" }}>
                                <button
                                  onClick={(ev) => { ev.stopPropagation(); deleteExpense(e.id); }}
                                  className="btn btn-ghost"
                                  style={{ width: 28, height: 28, padding: 0, color: "var(--text-tertiary)" }}
                                  title="Удалить"
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {expenseModalOpen && expenseEditing ? (
                <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) { setExpenseModalOpen(false); setExpenseEditMode(false); } }}>
                  <div className="card" style={{ width: 520, maxWidth: "100%" }}>
                    <div className="card-header">
                      <span className="card-title">{expenseEditMode ? "Редактировать расход" : "Расход"}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!expenseEditMode && isAdmin && (
                          <button className="btn btn-secondary" style={{ color: "var(--red)" }} onClick={() => deleteExpense(expenseEditing.id)}>Удалить</button>
                        )}
                        {!expenseEditMode && expenseEditing.status === "DRAFT" && (
                          <button className="btn btn-secondary" onClick={() => {
                            setExpenseEditTitle(expenseEditing.title);
                            setExpenseEditAmount(String(expenseEditing.amount));
                            setExpenseEditCurrency(expenseEditing.currency);
                            setExpenseEditPayMethod(expenseEditing.payMethod);
                            setExpenseEditMode(true);
                          }}>Редактировать</button>
                        )}
                        <button className="btn btn-secondary" onClick={() => { setExpenseModalOpen(false); setExpenseEditMode(false); }}>Закрыть</button>
                      </div>
                    </div>
                    <div className="card-body" style={{ display: "grid", gap: 14 }}>
                      {expenseEditMode ? (
                        <>
                          <div>
                            <div className="form-label">Название</div>
                            <input className="form-input" value={expenseEditTitle} onChange={(e) => setExpenseEditTitle(e.target.value)} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px", gap: 12 }}>
                            <div>
                              <div className="form-label">Сумма</div>
                              <input className="form-input" value={expenseEditAmount} onChange={(e) => setExpenseEditAmount(e.target.value)} style={{ fontFamily: "'JetBrains Mono', monospace" }} />
                            </div>
                            <div>
                              <div className="form-label">Валюта</div>
                              <select className="form-input" value={expenseEditCurrency} onChange={(e) => setExpenseEditCurrency(e.target.value)}>
                                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <div className="form-label">Оплата</div>
                              <select className="form-input" value={expenseEditPayMethod} onChange={(e) => setExpenseEditPayMethod(e.target.value)}>
                                <option value="bank">Банк</option>
                                <option value="usdt">USDT</option>
                                <option value="cash">Кэш</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                            <button className="btn btn-secondary" onClick={() => setExpenseEditMode(false)}>Отмена</button>
                            <button className="btn btn-primary" onClick={saveExpenseEdit}>Сохранить</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div><div className="form-label">Название</div><div style={{ fontWeight: 600 }}>{expenseEditing.title}</div></div>
                          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr 1fr" }}>
                            <div>
                              <div className="form-label">Сумма</div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{Number(expenseEditing.amount).toLocaleString()} {expenseEditing.currency}</div>
                            </div>
                            <div>
                              <div className="form-label">Оплата</div>
                              <div style={{ color: "var(--text-secondary)" }}>{expenseEditing.payMethod}</div>
                            </div>
                            <div>
                              <div className="form-label">Статус</div>
                              <span className={`badge ${expenseEditing.status === "APPROVED" ? "badge-green" : expenseEditing.status === "SUBMITTED" ? "badge-blue" : expenseEditing.status === "REJECTED" ? "badge-red" : "badge-amber"}`}>
                                {expenseEditing.status === "APPROVED" ? "Одобрен" : expenseEditing.status === "SUBMITTED" ? "На проверке" : expenseEditing.status === "REJECTED" ? "Отклонён" : "Черновик"}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
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
                        </>
                      )}
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
                          "Сколько заработал каждый воркер за этот месяц?",
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
                                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 12px" }}
                                    onClick={() => {
                                      setSalaryConfigModal({ userId: staffMember.id, name: staffMember.name || staffMember.email, config: empSalary?.salaryConfig ?? null });
                                      setSalaryConfigForm({
                                        baseAmount: String(empSalary?.salaryConfig?.baseAmount ?? ""),
                                        currency: empSalary?.salaryConfig?.currency ?? "USD",
                                        payDay: String(empSalary?.salaryConfig?.payDay ?? "1"),
                                        note: empSalary?.salaryConfig?.note ?? "",
                                      });
                                    }}>
                                    {empSalary?.salaryConfig ? "Изменить" : "Настроить"}
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

          {/* ===== SALARY ===== */}
          {tab === "salary" ? (() => {
            const CURRENCIES = ["USD", "EUR", "UAH", "PLN", "CHF"];
            const PAYMENT_TYPES: Record<string, string> = { BASE: "Ставка", DEAL_BONUS: "Бонус по сделкам", ADVANCE: "Аванс", MANUAL: "Ручная" };
            const ROLE_LABELS_S: Record<string, string> = { ADMIN: "Администратор", MANAGER: "Менеджер", WORKER: "Воркер", SUPER_ADMIN: "Супер-админ" };
            const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
            const fmtDec = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

            const totalFund = salaryData.reduce((s, e) => s + (e.totalAccrued ?? 0), 0);
            const totalDebt = salaryData.reduce((s, e) => s + Math.max(0, e.balance ?? 0), 0);
            const totalPaid = salaryData.reduce((s, e) => s + (e.paidUsd ?? 0), 0);

            // Shared modals (usable from both list and cabinet)
            const configModal = salaryConfigModal && (
              <div className="modal-overlay" onClick={() => setSalaryConfigModal(null)}>
                <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <div className="modal-title">Настройка ставки — {salaryConfigModal.name}</div>
                    <button className="modal-close" onClick={() => setSalaryConfigModal(null)}>✕</button>
                  </div>
                  <div className="modal-body" style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                      <div>
                        <label className="form-label">Базовая ставка (в месяц)</label>
                        <input className="form-control" type="number" min="0" placeholder="0" value={salaryConfigForm.baseAmount} onChange={e => setSalaryConfigForm(f => ({ ...f, baseAmount: e.target.value }))} />
                      </div>
                      <div>
                        <label className="form-label">Валюта</label>
                        <select className="form-control" value={salaryConfigForm.currency} onChange={e => setSalaryConfigForm(f => ({ ...f, currency: e.target.value }))}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">День выплаты зарплаты (число месяца, 1–31)</label>
                      <input className="form-control" type="number" min="1" max="31" value={salaryConfigForm.payDay} onChange={e => setSalaryConfigForm(f => ({ ...f, payDay: e.target.value }))} />
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>Например, 15 — значит 15-го числа каждого месяца</div>
                    </div>
                    <div>
                      <label className="form-label">Примечание</label>
                      <input className="form-control" type="text" placeholder="Необязательно" value={salaryConfigForm.note} onChange={e => setSalaryConfigForm(f => ({ ...f, note: e.target.value }))} />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={() => setSalaryConfigModal(null)}>Отмена</button>
                    <button className="btn btn-primary" onClick={saveSalaryConfig}>Сохранить</button>
                  </div>
                </div>
              </div>
            );

            const paymentModal = salaryPaymentModal && (
              <div className="modal-overlay" onClick={() => setSalaryPaymentModal(null)}>
                <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <div className="modal-title">Добавить выплату — {salaryPaymentModal.name}</div>
                    <button className="modal-close" onClick={() => setSalaryPaymentModal(null)}>✕</button>
                  </div>
                  <div className="modal-body" style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                      <div>
                        <label className="form-label">Сумма</label>
                        <input className="form-control" type="number" min="0" placeholder="0" value={salaryPaymentForm.amount} onChange={e => setSalaryPaymentForm(f => ({ ...f, amount: e.target.value }))} />
                      </div>
                      <div>
                        <label className="form-label">Валюта</label>
                        <select className="form-control" value={salaryPaymentForm.currency} onChange={e => setSalaryPaymentForm(f => ({ ...f, currency: e.target.value }))}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Тип выплаты</label>
                      <select className="form-control" value={salaryPaymentForm.type} onChange={e => setSalaryPaymentForm(f => ({ ...f, type: e.target.value }))}>
                        {Object.entries(PAYMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Примечание</label>
                      <input className="form-control" type="text" placeholder="Необязательно" value={salaryPaymentForm.note} onChange={e => setSalaryPaymentForm(f => ({ ...f, note: e.target.value }))} />
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border)" }}>
                      <input type="checkbox" checked={salaryPaymentForm.isPaid} onChange={e => setSalaryPaymentForm(f => ({ ...f, isPaid: e.target.checked }))} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Отметить как выплачено</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Если деньги уже переданы сотруднику</div>
                      </div>
                    </label>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={() => setSalaryPaymentModal(null)}>Отмена</button>
                    <button className="btn btn-primary" onClick={addSalaryPayment}>Добавить</button>
                  </div>
                </div>
              </div>
            );

            // ── CABINET VIEW ──────────────────────────────────────────────
            if (selectedSalaryEmp) {
              const emp = selectedSalaryEmp;
              const cfg = emp.salaryConfig;
              const debt = emp.balance ?? 0;
              const isInDebt = debt > 0;
              const avatarColor = ["#6366F1","#059669","#D97706","#DC2626","#0EA5E9"][emp.email.charCodeAt(0) % 5];

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
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{ROLE_LABELS_S[emp.role] ?? emp.role}{emp.position ? ` · ${emp.position}` : ""}</div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="month" value={salaryPeriod} onChange={e => { setSalaryPeriod(e.target.value); loadSalary(e.target.value); }}
                        style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }} />
                    </div>
                  </div>

                  {/* Metric cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {[
                      { label: "Начислено", value: `$${fmt(emp.totalAccrued ?? 0)}`, sub: `Ставка $${fmt(emp.baseUsd ?? 0)} + Сделки $${fmtDec(emp.dealEarningsUsd ?? 0)}`, color: "#6366F1" },
                      { label: "Выплачено", value: `$${fmt(emp.paidUsd ?? 0)}`, sub: `${emp.payments.filter((p: any) => p.isPaid).length} подтв. выплат`, color: "#059669" },
                      { label: isInDebt ? "Долг (не выплачено)" : "Баланс", value: `${isInDebt ? "−" : "+"}$${fmt(Math.abs(debt))}`, sub: isInDebt ? "Требует выплаты" : "Переплата или ровно", color: isInDebt ? "#DC2626" : "#059669" },
                    ].map(m => (
                      <div key={m.label} style={{ background: "var(--bg-card)", borderRadius: 14, padding: "18px 20px", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>{m.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Main grid: settings + history */}
                  <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>

                    {/* Left: Salary settings */}
                    <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Настройки зарплаты</div>
                        <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                          onClick={() => {
                            setSalaryConfigModal({ userId: emp.userId, name: emp.name || emp.email, config: cfg });
                            setSalaryConfigForm({ baseAmount: cfg?.baseAmount ? String(cfg.baseAmount) : "", currency: cfg?.currency ?? "USD", payDay: cfg?.payDay ? String(cfg.payDay) : "1", note: cfg?.note ?? "" });
                          }}>
                          {cfg ? "Изменить" : "Настроить"}
                        </button>
                      </div>
                      <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
                        {cfg ? (
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
                            <button className="btn btn-primary" style={{ fontSize: 12 }}
                              onClick={() => {
                                setSalaryConfigModal({ userId: emp.userId, name: emp.name || emp.email, config: null });
                                setSalaryConfigForm({ baseAmount: "", currency: "USD", payDay: "1", note: "" });
                              }}>
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
                        <button className="btn btn-primary" style={{ fontSize: 12 }}
                          onClick={() => {
                            setSalaryPaymentModal({ userId: emp.userId, name: emp.name || emp.email, orgId: user?.activeOrganizationId ?? "" });
                            setSalaryPaymentForm({ amount: "", currency: cfg?.currency ?? "USD", type: "BASE", note: "", isPaid: false });
                          }}>
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
                                    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "var(--accent-light)", color: "var(--accent)", fontWeight: 500 }}>{PAYMENT_TYPES[p.type] ?? p.type}</span>
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

                  {configModal}
                  {paymentModal}
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
                    { label: "Итого выплачено", value: `$${fmt(totalPaid)}`, sub: "Подтверждённые выплаты", color: "#059669", bg: "rgba(5,150,105,0.06)" },
                  ].map(m => (
                    <div key={m.label} style={{ padding: "18px 22px", borderRadius: 14, background: m.bg, border: `1px solid ${m.color}22` }}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6 }}>{m.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>{m.sub}</div>
                    </div>
                  ))}
                </div>

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

                {configModal}
                {paymentModal}
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
                      <button className="btn btn-secondary" onClick={() => {
                        const init: Record<string, string> = {};
                        for (const c of CURRENCIES) init[c] = String(exchangeRates[c] ?? "");
                        setRatesEditing(init);
                        setRatesModalOpen(true);
                      }}>Изменить вручную</button>
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

      {/* ===== EXCHANGE RATES MODAL ===== */}
      {ratesModalOpen && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 70 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setRatesModalOpen(false); }}>
          <div className="card" style={{ width: 420, maxWidth: "100%" }}>
            <div className="card-header">
              <span className="card-title">Курсы валют (к USD)</span>
              <button className="btn btn-ghost" onClick={() => setRatesModalOpen(false)}>✕</button>
            </div>
            <div className="card-body" style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
                Укажите сколько единиц каждой валюты равно 1 USD.<br/>
                Пример: 1 USD = 41.5 UAH → значение для UAH = 41.5
              </div>
              {CURRENCIES.map(c => (
                <div key={c} style={{ display: "grid", gridTemplateColumns: "60px 1fr", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>{CURRENCY_META[c]?.symbol} {c}</div>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="any"
                    value={ratesEditing[c] ?? ""}
                    onChange={(e) => setRatesEditing(p => ({ ...p, [c]: e.target.value }))}
                    placeholder={String(exchangeRates[c] ?? "")}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setRatesModalOpen(false)}>Отмена</button>
                <button className="btn btn-primary" onClick={saveExchangeRates}>Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TEMPLATE MODAL (WIZARD) ===== */}
      {templateModalOpen ? (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setTemplateModalOpen(false); }}>
          <div className="card" style={{ width: 700, maxWidth: "100%", maxHeight: "92vh", overflow: "auto" }}>
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="card-title">{templateEditing ? "Редактировать шаблон" : "Новый шаблон сделки"}</span>
                {!templateEditing && (
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>
                    Шаг {tplWizardStep === "type" ? "1" : "2"} из 2
                  </span>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => setTemplateModalOpen(false)}>Отмена</button>
            </div>

            {/* ── ШАГ 1: выбор типа схемы ── */}
            {tplWizardStep === "type" && !templateEditing && (
              <div className="card-body" style={{ display: "grid", gap: 20 }}>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  Выберите, как будут считаться деньги в сделках по этому шаблону:
                </div>

                {/* Карточка 1: схема посредника */}
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
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>💸</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Схема с посредником, AI и сотрудниками</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                      Подходит если деньги идут по цепочке:
                    </div>
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {["Сумма завода", "→ вычет посредника %", "→ вычет AI %", "→ зарплатный фонд %", "→ прибыль офиса"].map((s, i) => (
                        <span key={i} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 20, background: i === 0 ? "var(--accent)" : "var(--bg-metric)", color: i === 0 ? "#fff" : "var(--text-secondary)", fontWeight: i === 0 ? 700 : 400 }}>{s}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-tertiary)" }}>
                      Система сама считает сколько кому достаётся. Вам остаётся только вводить суммы и проценты.
                    </div>
                  </div>
                </div>

                {/* Карточка 2: простая схема */}
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
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--bg-metric)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📋</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Произвольная форма</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                      Вы сами добавляете нужные поля — текст, числа, списки, флажки. Подходит для любой структуры данных.
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-tertiary)" }}>
                      Расчёт зарплаты сотрудников по одному выбранному числовому полю.
                    </div>
                  </div>
                </div>

                <div style={{ paddingTop: 4, textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>
                  Нажмите на карточку чтобы продолжить
                </div>
              </div>
            )}

            {/* ── ШАГ 2: настройка полей ── */}
            {(tplWizardStep === "fields" || templateEditing) && (
              <div className="card-body" style={{ display: "grid", gap: 18 }}>

                {/* Название */}
                <div>
                  <div className="form-label">Название шаблона *</div>
                  <input className="form-input" value={tplName} onChange={(e) => setTplName(e.target.value)}
                    placeholder="Например: Обменник PLN, Крипто-схема…" autoFocus />
                </div>

                {/* Схема — краткий блок, только если MEDIATOR_AI */}
                {tplCalcPreset === CALC_MEDIATOR_AI_PAYROLL && (
                  <div style={{ display: "grid", gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid var(--accent)33" }}>
                    <div style={{ background: "var(--accent)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>💸</span>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>Схема: посредник → AI → зарплатный фонд → прибыль</span>
                    </div>
                    <div style={{ padding: "12px 16px", background: "var(--accent)06", display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        Три поля расчёта уже добавлены (выделены цветом и заблокированы). Вам нужно только задать <strong>% зарплатного фонда</strong> — сколько процентов от оставшейся суммы идёт на зарплаты сотрудников.
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>% зарплатного фонда</div>
                        <input
                          className="form-input"
                          value={tplPayrollPoolPct}
                          onChange={(e) => setTplPayrollPoolPct(e.target.value)}
                          type="number" min={0} max={100} step="1"
                          style={{ width: 90, fontFamily: "'JetBrains Mono', monospace" }}
                        />
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          Пример: при 20% — если осталось 70, то 14 идёт сотрудникам, 56 — прибыль офиса
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI-парсер */}
                <div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setAiParseOpen(p => !p)}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, width: "100%", justifyContent: "center" }}
                  >
                    <span>🤖</span> {aiParseOpen ? "Скрыть AI-помощника" : "Создать поля через AI (вставить строки из таблицы)"}
                  </button>
                  {aiParseOpen && (
                    <div style={{ marginTop: 10, border: "1px solid var(--accent)44", borderRadius: 12, padding: 16, background: "var(--accent)08" }}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
                        Вставьте 2–5 строк из вашей таблицы. AI сам определит колонки и типы полей.
                      </div>
                      <textarea
                        className="form-input"
                        value={aiParseSample}
                        onChange={e => setAiParseSample(e.target.value)}
                        style={{ height: 90, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", paddingTop: 10 }}
                        placeholder={"21,04  Ди+олх(Н)  75/25  DP  eurocom  6838\n22.04  Ди+Вл+Бо  45/30/25  DP  eurocom  5809"}
                      />
                      {aiParseError && <div style={{ marginTop: 6, fontSize: 12, color: "var(--red)" }}>{aiParseError}</div>}
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => { setAiParseOpen(false); setAiParseSample(""); setAiParseError(null); }}>Отмена</button>
                        <button className="btn btn-primary" onClick={aiParseTemplate} disabled={aiParsing || !aiParseSample.trim()}>
                          {aiParsing ? "Анализирую..." : "Определить поля →"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Список полей */}
                <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "var(--bg-metric)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Поля сделки</span>
                      {tplCalcPreset === CALC_MEDIATOR_AI_PAYROLL && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>Первые 3 поля — расчётные (нельзя удалить)</span>
                      )}
                      {tplCalcPreset !== CALC_MEDIATOR_AI_PAYROLL && tplHasWorkers && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>Нажмите 💰 у числового поля — на его основе будет считаться зарплата</span>
                      )}
                    </div>
                    <button className="btn btn-secondary" onClick={addTplField}>+ Добавить поле</button>
                  </div>

                  {tplFields.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                      Нажмите «+ Добавить поле» — например: ФИО, Телефон, Банк, Валюта, Метод
                    </div>
                  ) : (
                    <div style={{ display: "grid" }}>
                      {tplFields.map((f, i) => {
                        const fieldKey = f.key || slugifyFieldKey(f.label, i);
                        const isIncomeField = tplIncomeFieldKey === fieldKey;
                        const canBeIncome = f.type === "NUMBER" || f.type === "PERCENT";
                        const isFixed = ["fixed_gross", "fixed_mediator", "fixed_ai"].includes(f._id);
                        const fixedLabel: Record<string, string> = {
                          fixed_gross: "Сумма завода — число, сколько денег зашло",
                          fixed_mediator: "% посредника — сколько % забирает посредник",
                          fixed_ai: "% AI — сколько % уходит на AI (от суммы после посредника)",
                        };
                        return (
                          <div key={f._id} style={{
                            padding: "12px 16px",
                            borderTop: i > 0 ? "1px solid var(--border-light)" : undefined,
                            background: isFixed ? "var(--accent)06" : isIncomeField ? "var(--accent)08" : undefined,
                          }}>
                            {isFixed ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 16 }}>{f._id === "fixed_gross" ? "💰" : f._id === "fixed_mediator" ? "🏦" : "🤖"}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{fixedLabel[f._id]}</div>
                                </div>
                                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--accent)22", color: "var(--accent)", fontWeight: 600 }}>зафиксировано</span>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px auto 32px", gap: 10, alignItems: "end" }}>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Название поля</div>
                                    <input className="form-input" value={f.label} placeholder="ФИО, Телефон, Банк, Метод…"
                                      onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))} />
                                  </div>
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Тип ввода</div>
                                    <select className="form-input" value={f.type}
                                      onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, type: e.target.value as FieldType } : x))}>
                                      <option value="TEXT">Текст (любой)</option>
                                      <option value="NUMBER">Число / сумма</option>
                                      <option value="PERCENT">Процент (0–100)</option>
                                      <option value="CURRENCY">Валюта (USD/EUR/UAH…)</option>
                                      <option value="SELECT">Список вариантов</option>
                                      <option value="DATE">Дата</option>
                                      <option value="CHECKBOX">Да / Нет</option>
                                    </select>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 1 }}>
                                    {tplHasWorkers && canBeIncome && tplCalcPreset !== CALC_MEDIATOR_AI_PAYROLL && (
                                      <button
                                        title="Зарплата считается от этого поля"
                                        onClick={() => setTplIncomeFieldKey(isIncomeField ? "" : fieldKey)}
                                        style={{ height: 38, width: 38, borderRadius: 8, border: isIncomeField ? "2px solid var(--accent)" : "1px solid var(--border)", background: isIncomeField ? "var(--accent)" : "var(--bg-card)", cursor: "pointer", fontSize: 18, transition: "all 0.15s" }}
                                      >💰</button>
                                    )}
                                  </div>
                                  <div style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 20, borderRadius: 8 }}
                                    onClick={() => { setTplFields(p => p.filter((_, xi) => xi !== i)); if (isIncomeField) setTplIncomeFieldKey(""); }}>×</div>
                                </div>
                                {f.type === "SELECT" && (
                                  <div style={{ marginTop: 8 }}>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Варианты для выбора (через запятую)</div>
                                    <input className="form-input" value={f.options} placeholder="Нал, Безнал, Карта, USDT…"
                                      onChange={(e) => setTplFields(p => p.map((x, xi) => xi === i ? { ...x, options: e.target.value } : x))} />
                                  </div>
                                )}
                                {isIncomeField && (
                                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--accent)" }}>
                                    💰 Зарплата сотрудников считается как % от этого поля
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

                {/* ── Расчётная цепочка ── */}
                {(() => {
                  const numericFields = tplFields.filter(f => f.type === "NUMBER" || f.type === "PERCENT");
                  const allFieldKeys = tplFields.map((f, i) => ({ key: f.key || slugifyFieldKey(f.label, i), label: f.label }));

                  return (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", background: "var(--bg-metric)", borderBottom: tplCalcSteps.length > 0 ? "1px solid var(--border)" : undefined, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>📊 Расчётная цепочка</span>
                          <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                            {tplCalcSteps.length > 0 ? `${tplCalcSteps.length} шаг(ов)` : "необязательно — для автоматического распределения денег"}
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
                        >+ Добавить шаг</button>
                      </div>

                      {tplCalcSteps.length === 0 ? (
                        <div style={{ padding: "16px", fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                          Цепочка позволяет описать как деньги делятся по шагам: каждый шаг берёт сумму из предыдущего остатка или из поля, и вычитает % или фиксированную сумму. Один шаг можно пометить как «зарплатный фонд» — он будет распределяться между сотрудниками.
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
                                    placeholder="Название шага (кому идут деньги)"
                                    style={{ flex: 1, fontWeight: 600 }}
                                  />
                                  <button
                                    style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", fontSize: 16, color: "var(--text-tertiary)" }}
                                    onClick={() => setTplCalcSteps(p => p.filter(s => s.id !== step.id))}
                                  >×</button>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                  {/* Source */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Взять сумму из</div>
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
                                        <option key={`field:${f.key}`} value={`field:${f.key}`}>📋 {f.label}</option>
                                      ))}
                                      {prevSteps.map(ps => (
                                        <option key={`step:${ps.id}`} value={`step:${ps.id}`}>↩ Остаток: {ps.resultLabel || ps.label || `Шаг ${tplCalcSteps.indexOf(ps) + 1}`}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {/* Deduct field */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Вычесть поле</div>
                                    <select
                                      className="form-input"
                                      value={step.deductFieldKey}
                                      onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, deductFieldKey: e.target.value } : s))}
                                    >
                                      <option value="">— выберите поле —</option>
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
                                    <div className="form-label" style={{ marginBottom: 3 }}>Тип вычитания</div>
                                    <select
                                      className="form-input"
                                      value={step.deductType}
                                      onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, deductType: e.target.value as "percent"|"fixed" } : s))}
                                    >
                                      <option value="percent">% от источника</option>
                                      <option value="fixed">Фиксированная сумма</option>
                                    </select>
                                  </div>
                                  {/* Result label */}
                                  <div>
                                    <div className="form-label" style={{ marginBottom: 3 }}>Название остатка</div>
                                    <input
                                      className="form-input"
                                      value={step.resultLabel}
                                      onChange={e => setTplCalcSteps(p => p.map(s => s.id === step.id ? { ...s, resultLabel: e.target.value } : s))}
                                      placeholder="Например: После посредника (R1)"
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
                                    👥 Это зарплатный фонд — вычитаемая сумма распределяется между сотрудниками
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

                {/* Для простой схемы — есть ли воркеры */}
                {tplCalcPreset !== CALC_MEDIATOR_AI_PAYROLL && tplCalcSteps.length === 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={tplHasWorkers} onChange={(e) => setTplHasWorkers(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Распределять зарплату сотрудникам по этой сделке</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Если включено — при создании сделки нужно будет указать кому и сколько %</div>
                    </div>
                  </label>
                )}

                {/* Кнопки */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                  {!templateEditing ? (
                    <button className="btn btn-secondary" onClick={() => setTplWizardStep("type")}>← Назад</button>
                  ) : <div />}
                  <button className="btn btn-primary" onClick={saveTemplate}>
                    {templateEditing ? "Сохранить изменения" : "Создать шаблон →"}
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
