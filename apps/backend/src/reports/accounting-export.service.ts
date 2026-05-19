import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getDealPayoutBreakdown, getEffectiveRates, breakdownToUsd } from '../deals/deal-payout.util';
import * as XLSX from 'xlsx';

const TEMPLATE_SHEET = 'Учет сделок';

/** Шапка как в «Шаблон отчетности.xlsx» */
const HEADER_ROW_1 = [
  'Дата',
  'Мен 1',
  'Мен 2',
  'Мен 3',
  'Мен 4',
  'Инфо',
  'ОЛХ',
  'ИИ',
  'Мен 1',
  'Мен 2',
  'Мен 3',
  'Мен 4',
  'Инфо',
  'ОЛХ',
  'ИИ',
  'Сумма \nсделки',
  'Валюта',
  'Курс',
  'Сумма \nсделки долл',
  '% \nвыгруза',
  'Себестоимость\nвыгруза',
  'Поступление',
  'Инфо',
  'ОЛХ',
  'ИИ',
  'Ост сделки',
  'ЗП\nфонд',
  'Мен 1',
  'Мен 2',
  'Мен 3',
  'Мен 4',
];

const HEADER_ROW_2 = [
  '',
  'Менеджер',
  '',
  '',
  '',
  '',
  '',
  '',
  'Бонус',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  'Бонус',
  '',
  '',
  '',
];

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function toUsd(amount: number, currency: string, rates: Record<string, number>): number {
  if (!amount) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = rates[currency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function getDealCurrency(
  tpl: { fields?: Array<{ key: string; type: string }> } | null,
  data: Record<string, unknown> | undefined,
): string {
  if (!tpl?.fields || !data) return 'USD';
  const cf = tpl.fields.find((f) => f.type === 'CURRENCY');
  if (!cf) return 'USD';
  return String(data[cf.key] ?? 'USD').toUpperCase();
}

function dataFieldNumber(data: Record<string, unknown>, pattern: RegExp): number | null {
  for (const [key, raw] of Object.entries(data)) {
    if (!pattern.test(key)) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Доля 0.13 или 13 → 0.13 */
function asFraction(n: number | null): number {
  if (n == null || !Number.isFinite(n) || n <= 0) return 0;
  if (n > 0 && n <= 1) return n;
  if (n <= 100) return n / 100;
  return n / 100;
}

type DealRow = {
  dealDate: Date;
  dataRows: Array<{ data: unknown }>;
  template: {
    incomeFieldKey: string | null;
    payrollPoolPct?: unknown;
    calcSteps?: unknown;
    fields?: Array<{ key: string; type: string }>;
  } | null;
  amounts: Array<{ amountOut: unknown; currencyOut?: string }>;
  participants: Array<{
    pct: number;
    user: { name: string | null; email: string };
  }>;
  mediatorLink?: { pct: unknown; mediator: { name: string } } | null;
  olxLink?: { pct: unknown; olx: { name: string } } | null;
  rateSnapshot?: unknown;
};

@Injectable()
export class AccountingExportService {
  constructor(private prisma: PrismaService) {}

  async buildXlsx(organizationId: string, from?: string, to?: string): Promise<Buffer> {
    const now = new Date();
    const fromDate = from
      ? startOfDay(new Date(from))
      : startOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const toDate = to ? endOfDay(new Date(to)) : endOfDay(now);

    const [deals, rateRows, infoPartner] = await Promise.all([
      this.prisma.deal.findMany({
        where: { organizationId, dealDate: { gte: fromDate, lte: toDate } },
        include: {
          amounts: true,
          dataRows: { orderBy: { order: 'asc' } },
          template: { include: { fields: { orderBy: { order: 'asc' } } } },
          participants: {
            include: { user: { select: { name: true, email: true } } },
            orderBy: { pct: 'desc' },
          },
          mediatorLink: { include: { mediator: true } },
          olxLink: { include: { olx: true } },
        },
        orderBy: { dealDate: 'asc' },
      }),
      this.prisma.exchangeRate.findMany(),
      this.prisma.organizationInfoPartner.findUnique({ where: { organizationId } }),
    ]);

    const orgInfoPct =
      infoPartner?.defaultPct != null ? Number(infoPartner.defaultPct) : null;

    const currentRates: Record<string, number> = {};
    for (const r of rateRows) currentRates[r.code] = Number(r.rateToUsd);

    const dataRows: unknown[][] = [HEADER_ROW_1, HEADER_ROW_2];
    for (const deal of deals) {
      dataRows.push(this.dealToRow(deal as DealRow, currentRates, orgInfoPct));
    }

    // Пустые строки как в шаблоне (до ~900 строк для привычного вида)
    const minRows = Math.max(dataRows.length + 50, 100);
    while (dataRows.length < minRows) {
      dataRows.push(new Array(HEADER_ROW_1.length).fill(null));
    }

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, TEMPLATE_SHEET);
    return Buffer.from(
      XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true }) as ArrayBuffer,
    );
  }

  private dealToRow(
    deal: DealRow,
    currentRates: Record<string, number>,
    organizationInfoPct: number | null,
  ): unknown[] {
    const row: unknown[] = new Array(HEADER_ROW_1.length).fill(null);
    const first = deal.dataRows[0]?.data as Record<string, unknown> | undefined;
    const tpl = deal.template;
    const currency = getDealCurrency(tpl, first);
    const effectiveRates = getEffectiveRates(deal, currentRates);
    const rateToUsd = effectiveRates[currency] ?? currentRates[currency] ?? 1;

    const breakdown = getDealPayoutBreakdown({
      ...(deal as Parameters<typeof getDealPayoutBreakdown>[0]),
      organizationInfoPct,
    });
    const usd = breakdownToUsd(breakdown, currency, effectiveRates);
    const grossLocal = breakdown.gross;
    const grossUsd = usd.gross;
    const mediatorUsd = usd.mediator;
    const aiUsdFinal = usd.ai;
    const olxUsd = usd.olx;
    const infoUsd = usd.info;
    const receiptUsd = usd.receipt;
    const payrollUsd = usd.payrollPool;
    const workerFundUsd = usd.workerPool;
    const officeRemainderUsd = usd.office;

    const mediatorPctFrac = grossUsd > 0 ? mediatorUsd / grossUsd : 0;
    const olxPct =
      receiptUsd > 0 && olxUsd > 0
        ? olxUsd / receiptUsd
        : deal.olxLink
          ? Number(deal.olxLink.pct) / 100
          : asFraction(dataFieldNumber(first ?? {}, /олх/i));
    const infoPct = payrollUsd > 0 && infoUsd > 0 ? infoUsd / payrollUsd : 0;

    // A — дата
    row[0] = deal.dealDate;

    // B–E менеджеры (имя)
    const parts = [...deal.participants].slice(0, 4);
    for (let i = 0; i < 4; i++) {
      const p = parts[i];
      row[1 + i] = p ? (p.user.name?.trim() || p.user.email) : null;
    }

    // F–H подписи партнёров
    row[5] = infoPct > 0 ? 'Инфо' : null;
    row[6] =
      olxUsd > 0
        ? (deal.olxLink?.olx?.name ?? String(first?.['supplier'] ?? 'ОЛХ').slice(0, 40))
        : null;
    row[7] = aiUsdFinal > 0 ? 'ИИ' : null;

    // I–L доли менеджеров (дроби)
    for (let i = 0; i < 4; i++) {
      const p = parts[i];
      row[8 + i] = p ? round2(p.pct / 100) : null;
    }

    // M–O % партнёров (дроби от поступления / фонда для инфо)
    row[12] = infoPct > 0 ? infoPct : null;
    row[13] = olxPct > 0 ? olxPct : null;
    row[14] =
      receiptUsd > 0 && aiUsdFinal > 0 ? round2(aiUsdFinal / receiptUsd) : null;

    // P–S сумма, валюта, курс, USD
    row[15] = round2(grossLocal);
    row[16] = currency.toLowerCase();
    row[17] = round2(rateToUsd);
    row[18] = round2(grossUsd);

    // T–V выгруз (посредник)
    row[19] = mediatorPctFrac > 0 ? round2(mediatorPctFrac) : 0;
    row[20] = round2(mediatorUsd);
    row[21] = round2(receiptUsd);

    // W–Y партнёры ($): Инфо — от ЗП фонда; ОЛХ/ИИ — от поступления
    row[22] = infoUsd > 0 ? infoUsd : 0;
    row[23] = olxUsd > 0 ? olxUsd : 0;
    row[24] = aiUsdFinal > 0 ? aiUsdFinal : 0;

    // Z остаток до/после фонда
    row[25] = officeRemainderUsd;

    // AA ЗП фонд
    row[26] = payrollUsd;

    // AB–AE бонусы менеджеров ($)
    for (let i = 0; i < 4; i++) {
      const p = parts[i];
      row[27 + i] = p ? round2(workerFundUsd * (p.pct / 100)) : null;
    }

    return row;
  }
}
