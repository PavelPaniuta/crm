import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FieldType } from '@prisma/client';
import * as XLSX from 'xlsx';

const TEMPLATE_NAME = 'Легаси (импорт)';

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ё/g, 'е');
}

/** Map header label -> internal key */
function headerToKey(h: string): string | null {
  const n = norm(h);
  if (n.includes('дата')) return 'date';
  if (n === 'имя' || n.startsWith('имя ')) return 'codes';
  if (n.includes('% работ') || n.includes('работник')) return 'split';
  if (n === 'сумма' || n.startsWith('сумма')) return 'sum_app';
  if (n.includes('сняли')) return 'sum_actual';
  if (n.includes('банк')) return 'bank';
  if (n.includes('способ')) return 'method';
  if (n.includes('магаз')) return 'store';
  if (n.includes('type') && n.includes('%')) return 'mediator_pct';
  if (n.includes('постав')) return 'supplier';
  return null;
}

function parseDayMonthNumber(v: number, year: number): Date {
  const day = Math.floor(v);
  const frac = v - day;
  const month = Math.round(frac * 100);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Некорректная дата: ${v}`);
  }
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function parseDateCell(v: unknown, defaultYear: number): Date {
  if (v == null) throw new Error('Пустая дата');
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === 'number') {
    if (v > 40000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      return new Date(epoch.getTime() + (v - 1) * 86400000);
    }
    return parseDayMonthNumber(v, defaultYear);
  }
  if (typeof v === 'string') {
    const s = v.trim().replace(/\s+/g, '');
    const parts = s.split(/[./-]/).map((p) => Number(p));
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const d = parts[0];
      const m = parts[1];
      const y = parts[2] ?? defaultYear;
      const yy = y < 100 ? 2000 + y : y;
      return new Date(Date.UTC(yy, m - 1, d, 12, 0, 0));
    }
  }
  throw new Error(`Не удалось разобрать дату: ${String(v)}`);
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 0.13 в Excel → 13% для поля PERCENT */
function parseMediatorPct(v: unknown): string {
  const n = num(v);
  if (n == null) return '';
  if (n > 0 && n < 1) return String(Math.round(n * 10000) / 100);
  return String(n);
}

type OrgUserLite = { id: string; name: string | null; email: string };

export type LegacyImportResult = {
  created: number;
  skipped: number;
  templateId: string;
  errors: string[];
  deals: Array<{
    row: number;
    id: string;
    title: string;
    participantsAssigned?: boolean;
    participantNote?: string;
  }>;
};

/** Match by display name = code (e.g. «М», «Со», «Ди2») or unambiguous prefix / email local part */
function matchUserByCode(orgUsers: OrgUserLite[], code: string): OrgUserLite | null {
  const c = code.trim();
  if (!c) return null;
  const withName = orgUsers.filter((u) => u.name != null && String(u.name).trim().length > 0);

  for (const u of withName) {
    if (u.name!.trim() === c) return u;
  }
  for (const u of withName) {
    if (u.name!.trim().toLowerCase() === c.toLowerCase()) return u;
  }

  const starts = withName.filter((u) => u.name!.startsWith(c));
  if (starts.length === 1) return starts[0];
  if (starts.length > 1) {
    const ex = starts.find((u) => u.name === c);
    if (ex) return ex;
    // Prefer the shortest name (e.g. «М» over «Михаил») when the code is a prefix
    return [...starts].sort((a, b) => a.name!.length - b.name!.length)[0];
  }

  for (const u of orgUsers) {
    const local = u.email?.split('@')[0]?.toLowerCase();
    if (local && local === c.toLowerCase()) return u;
  }

  return null;
}

type ResolveOut =
  | { ok: true; parts: { userId: string; pct: number }[] }
  | { ok: false; message: string };

function resolveWorkerParticipants(orgUsers: OrgUserLite[], codes: string, split: string): ResolveOut {
  const codeList = codes
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  const pctsRaw = split
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length)
    .map((s) => {
      const n = parseFloat(s.replace(',', '.'));
      return Number.isFinite(n) ? n : NaN;
    })
    .filter((n) => !Number.isNaN(n));

  if (codeList.length === 0) return { ok: false, message: 'Пусто в колонке воркеров' };
  if (pctsRaw.length === 0) return { ok: false, message: 'Пусто в колонке долей %' };
  if (codeList.length !== pctsRaw.length) {
    return { ok: false, message: `Кодов: ${codeList.length}, долей: ${pctsRaw.length} (должно совпадать)` };
  }

  const parts: { userId: string; pct: number }[] = [];
  for (let i = 0; i < codeList.length; i++) {
    const u = matchUserByCode(orgUsers, codeList[i]);
    if (!u) {
      return { ok: false, message: `Не найден сотрудник с кодом/именем «${codeList[i]}» в этом офисе` };
    }
    parts.push({ userId: u.id, pct: Math.round(pctsRaw[i]) });
  }

  let sum = parts.reduce((a, p) => a + p.pct, 0);
  if (sum !== 100) {
    if (sum <= 0) return { ok: false, message: 'Сумма долей 0' };
    const scaled = parts.map((p) => ({ userId: p.userId, pct: Math.max(0, Math.round((p.pct / sum) * 100)) }));
    sum = scaled.reduce((a, p) => a + p.pct, 0);
    if (sum !== 100) {
      scaled[scaled.length - 1].pct += 100 - sum;
    }
    return { ok: true, parts: scaled };
  }
  return { ok: true, parts };
}

@Injectable()
export class LegacyImportService {
  private readonly log = new Logger(LegacyImportService.name);

  constructor(private prisma: PrismaService) {}

  /** Пользователи основного офиса + внешние по membership (как в staff) */
  private async loadOrgUsersForMatching(organizationId: string): Promise<OrgUserLite[]> {
    const primary = await this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, email: true },
    });
    const memIds = await this.prisma.userMembership.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    if (memIds.length === 0) return primary;
    const extra = await this.prisma.user.findMany({
      where: { id: { in: memIds.map((m) => m.userId) } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map<string, OrgUserLite>();
    for (const u of primary) byId.set(u.id, u);
    for (const u of extra) {
      if (!byId.has(u.id)) byId.set(u.id, u);
    }
    return Array.from(byId.values());
  }

  private async ensureTemplate(organizationId: string) {
    const existing = await this.prisma.dealTemplate.findFirst({
      where: { organizationId, name: TEMPLATE_NAME },
      include: { fields: true },
    });
    if (existing) return existing;

    const fields: Array<{
      key: string;
      label: string;
      type: FieldType;
      order: number;
      required?: boolean;
      options?: string;
    }> = [
      { key: 'sum_actual', label: 'Сняли (зашло)', type: FieldType.NUMBER, order: 0, required: true },
      { key: 'sum_app', label: 'Сумма (заявка)', type: FieldType.NUMBER, order: 1 },
      { key: 'mediator_pct', label: '% посредника', type: FieldType.PERCENT, order: 2 },
      { key: 'currency', label: 'Валюта', type: FieldType.CURRENCY, order: 3, options: 'PLN,USD,EUR,UAH,CHF' },
      { key: 'bank', label: 'Банк', type: FieldType.TEXT, order: 4 },
      { key: 'method', label: 'Способ', type: FieldType.TEXT, order: 5 },
      { key: 'store', label: 'Магазин', type: FieldType.TEXT, order: 6 },
      { key: 'supplier', label: 'Посредник', type: FieldType.TEXT, order: 7 },
      { key: 'workers_codes', label: 'Коды воркеров', type: FieldType.TEXT, order: 8 },
      { key: 'workers_split', label: 'Доли % (как в таблице)', type: FieldType.TEXT, order: 9 },
    ];

    return this.prisma.dealTemplate.create({
      data: {
        name: TEMPLATE_NAME,
        hasWorkers: true,
        incomeFieldKey: 'sum_actual',
        organizationId,
        fields: { create: fields },
      },
      include: { fields: true },
    });
  }

  async importXlsx(
    organizationId: string,
    buffer: Buffer,
    year: number,
    defaultCurrency = 'PLN',
  ): Promise<LegacyImportResult> {
    const tpl = await this.ensureTemplate(organizationId);
    const errors: string[] = [];
    const deals: LegacyImportResult['deals'] = [];
    let created = 0;
    let skipped = 0;

    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch (e: any) {
      throw new BadRequestException('Не удалось прочитать Excel: ' + (e?.message ?? e));
    }
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new BadRequestException('В файле нет листов');
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

    if (rows.length < 2) throw new BadRequestException('Нет строк данных');

    const headerRow = rows[0].map((c) => (c == null ? '' : String(c)));
    const colMap: Record<string, number> = {};
    headerRow.forEach((h, i) => {
      const key = headerToKey(h);
      if (key) colMap[key] = i;
    });
    if (colMap.date === undefined || colMap.sum_actual === undefined) {
      throw new BadRequestException(
        'Нужны колонки «дата» и «сняли» (или «Сняли»). Найдено: ' + headerRow.join(' | '),
      );
    }

    const rateSnapshot: Record<string, number> = {};
    const rateRows = await this.prisma.exchangeRate.findMany();
    for (const r of rateRows) rateSnapshot[r.code] = Number(r.rateToUsd);

    const orgUsers = await this.loadOrgUsersForMatching(organizationId);

    for (let ri = 1; ri < rows.length; ri++) {
      const row = rows[ri];
      if (!row || !row.length) {
        skipped++;
        continue;
      }
      const get = (key: string): unknown => {
        const idx = colMap[key];
        if (idx === undefined) return null;
        return row[idx];
      };

      const rawDate = get('date');
      const sumActual = num(get('sum_actual'));
      if (sumActual == null || sumActual === 0) {
        const allEmpty = row.every((c) => c == null || c === '');
        if (allEmpty) {
          skipped++;
          continue;
        }
        errors.push(`Строка ${ri + 1}: нет суммы «Сняли»`);
        skipped++;
        continue;
      }

      let dealDate: Date;
      try {
        dealDate = parseDateCell(rawDate, year);
      } catch (e: any) {
        errors.push(`Строка ${ri + 1}: ${e?.message ?? e}`);
        skipped++;
        continue;
      }

      const codes = get('codes') != null ? String(get('codes')).trim() : '';
      const split = get('split') != null ? String(get('split')).trim() : '';
      const sumApp = num(get('sum_app'));
      const bank = get('bank') != null ? String(get('bank')).trim() : '';
      const method = get('method') != null ? String(get('method')).trim() : '';
      const store = get('store') != null ? String(get('store')).trim() : '';
      const mediatorPct = parseMediatorPct(get('mediator_pct'));
      const supplier = get('supplier') != null ? String(get('supplier')).trim() : '';

      const title = `Импорт ${codes || 'сделка'} ${dealDate.toISOString().slice(0, 10)}`.slice(0, 200);

      const data: Record<string, string> = {
        sum_actual: String(sumActual),
        currency: defaultCurrency,
        workers_codes: codes,
        workers_split: split,
        bank,
        method,
        store,
        supplier,
        mediator_pct: mediatorPct,
      };
      if (sumApp != null) data.sum_app = String(sumApp);

      let partComment = '';
      let participantsOk: { parts: { userId: string; pct: number }[] } | null = null;
      if (codes && split) {
        const res = resolveWorkerParticipants(orgUsers, codes, split);
        if (res.ok) {
          partComment = `Воркеры: ${codes} → ${res.parts.map((p) => `${p.pct}%`).join('/')}.`;
          participantsOk = { parts: res.parts };
        } else {
          partComment = `Воркеры: ${codes} | %: ${split} — ${res.message}`;
          errors.push(`Строка ${ri + 1} (сделка всё равно создана): ${res.message}`);
        }
      } else {
        partComment = 'Коды/доли воркеров не заданы — участников можно добавить вручную.';
      }

      const comment =
        `Импорт из Excel. ${partComment}`;

      try {
        const deal = await this.prisma.deal.create({
          data: {
            organizationId,
            title,
            templateId: tpl.id,
            status: 'CLOSED',
            dealDate,
            comment,
            rateSnapshot: Object.keys(rateSnapshot).length ? rateSnapshot : undefined,
            dataRows: {
              create: [{ data, order: 0 }],
            },
          },
        });
        if (participantsOk) {
          await this.prisma.dealParticipant.createMany({
            data: participantsOk.parts.map((p) => ({ dealId: deal.id, userId: p.userId, pct: p.pct })),
          });
        }
        created++;
        deals.push({
          row: ri + 1,
          id: deal.id,
          title,
          participantsAssigned: Boolean(participantsOk),
          participantNote: partComment,
        });
      } catch (e: any) {
        this.log.warn(e);
        errors.push(`Строка ${ri + 1}: ${e?.message ?? e}`);
        skipped++;
      }
    }

    return { created, skipped, templateId: tpl.id, errors, deals };
  }
}
