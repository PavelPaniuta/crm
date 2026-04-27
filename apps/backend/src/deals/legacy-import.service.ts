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

export type LegacyImportResult = {
  created: number;
  skipped: number;
  templateId: string;
  errors: string[];
  deals: Array<{ row: number; id: string; title: string }>;
};

@Injectable()
export class LegacyImportService {
  private readonly log = new Logger(LegacyImportService.name);

  constructor(private prisma: PrismaService) {}

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
    const deals: Array<{ row: number; id: string; title: string }> = [];
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

      const comment =
        `Импорт из Excel. Воркеры: ${codes || '—'} | Доли: ${split || '—'}. ` +
        `Участников в сделке не проставлено — настройте вручную по % из таблицы.`;

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
        created++;
        deals.push({ row: ri + 1, id: deal.id, title });
      } catch (e: any) {
        this.log.warn(e);
        errors.push(`Строка ${ri + 1}: ${e?.message ?? e}`);
        skipped++;
      }
    }

    return { created, skipped, templateId: tpl.id, errors, deals };
  }
}
