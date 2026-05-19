import type { CSSProperties } from "react";

export type ClientFormState = {
  name: string;
  phone: string;
  note: string;
  statusId: string;
  bank: string;
  assistantName: string;
  callSummary: string;
  callStartedAt: string;
};

export function emptyClientForm(): ClientFormState {
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
export function parseClientLeadPaste(text: string): Partial<ClientFormState> {
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

export function clientFormSectionStyle(muted?: boolean): CSSProperties {
  return {
    border: "1px solid var(--border-light)",
    borderRadius: 12,
    padding: "16px 18px",
    background: muted ? "var(--bg-metric)" : "var(--bg-card)",
    display: "grid",
    gap: 14,
  };
}
