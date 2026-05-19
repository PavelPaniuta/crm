import { BadRequestException, Injectable } from '@nestjs/common';
import { DealStatus, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

const SHEET_NAMES = ['Учет сделок', 'Учёт сделок', 'Sheet1'];

/** Индексы колонок листа «Учет сделок» (0-based), как в export */
const COL = {
  date: 0,
  men1: 1,
  men2: 2,
  men3: 3,
  men4: 4,
  infoLabel: 5,
  olxLabel: 6,
  aiLabel: 7,
  men1Pct: 8,
  men2Pct: 9,
  men3Pct: 10,
  men4Pct: 11,
  infoPct: 12,
  olxPct: 13,
  aiPct: 14,
  gross: 15,
  currency: 16,
  rate: 17,
  grossUsd: 18,
  mediatorPct: 19,
  mediatorCost: 20,
  receipt: 21,
} as const;

function parseDate(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === 'number' && v > 30000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pctFromCell(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  if (n > 0 && n <= 1) return Math.round(n * 10000) / 100;
  if (n <= 100) return n;
  return n;
}

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type AccountingImportResult = {
  created: number;
  skipped: number;
  errors: string[];
};

@Injectable()
export class AccountingImportService {
  constructor(private prisma: PrismaService) {}

  async importXlsx(
    organizationId: string,
    buffer: Buffer,
    opts?: { dryRun?: boolean; templateId?: string },
  ): Promise<AccountingImportResult> {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName =
      SHEET_NAMES.find((n) => wb.SheetNames.includes(n)) ?? wb.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Пустой файл Excel');

    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: false,
    }) as unknown[][];

    if (rows.length < 3) {
      return { created: 0, skipped: 0, errors: ['Нет строк данных (ожидается шапка + данные с 3-й строки)'] };
    }

    const templateId = opts?.templateId ?? (await this.resolveDefaultTemplate(organizationId));
    if (!templateId) {
      throw new BadRequestException(
        'Укажите templateId или создайте шаблон сделки «Учет CRM» для офиса',
      );
    }

    const template = await this.prisma.dealTemplate.findFirst({
      where: { id: templateId, organizationId },
      include: { fields: true },
    });
    if (!template) throw new BadRequestException('Шаблон не найден');

    const [users, mediators, olxList, rateRows] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.mediator.findMany({ where: { organizationId } }),
      this.prisma.olx.findMany({ where: { organizationId } }),
      this.prisma.exchangeRate.findMany(),
    ]);

    const userByName = new Map<string, string>();
    for (const u of users) {
      if (u.name) userByName.set(normName(u.name), u.id);
      userByName.set(normName(u.email), u.id);
    }

    const mediatorByName = new Map(mediators.map((m) => [normName(m.name), m]));
    const olxByName = new Map(olxList.map((o) => [normName(o.name), o]));

    const rates: Record<string, number> = {};
    for (const r of rateRows) rates[r.code] = Number(r.rateToUsd);

    const grossKey =
      template.calcGrossFieldKey ??
      template.incomeFieldKey ??
      template.fields.find((f) => f.type === 'NUMBER')?.key ??
      'сумма_завода';

    const mediatorKey = template.calcMediatorPctKey ?? 'процент_посредника';
    const aiKey = template.calcAiPctKey ?? 'процент_аи';
    const currencyField = template.fields.find((f) => f.type === 'CURRENCY');

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 10) continue;

      const dealDate = parseDate(row[COL.date]);
      const gross = num(row[COL.gross]);
      if (!dealDate || gross == null || gross <= 0) {
        skipped++;
        continue;
      }

      const menNames = [row[COL.men1], row[COL.men2], row[COL.men3], row[COL.men4]]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean);
      const menPcts = [row[COL.men1Pct], row[COL.men2Pct], row[COL.men3Pct], row[COL.men4Pct]]
        .map((x) => pctFromCell(x))
        .filter((x): x is number => x != null && x > 0);

      if (menNames.length === 0 || menPcts.length === 0) {
        errors.push(`Строка ${i + 1}: нет менеджеров или долей`);
        skipped++;
        continue;
      }

      const participants: Array<{ userId: string; pct: number }> = [];
      for (let j = 0; j < Math.min(menNames.length, menPcts.length, 4); j++) {
        const uid = userByName.get(normName(menNames[j]));
        if (!uid) {
          errors.push(`Строка ${i + 1}: менеджер «${menNames[j]}» не найден`);
          continue;
        }
        participants.push({ userId: uid, pct: menPcts[j] });
      }
      if (participants.length === 0) {
        skipped++;
        continue;
      }
      const pctSum = participants.reduce((s, p) => s + p.pct, 0);
      if (Math.abs(pctSum - 100) > 0.5) {
        const scale = 100 / pctSum;
        for (const p of participants) p.pct = Math.round(p.pct * scale * 100) / 100;
      }

      const currency = String(row[COL.currency] ?? 'usd').toUpperCase().slice(0, 8);
      const mediatorPct = pctFromCell(row[COL.mediatorPct]) ?? 0;
      const aiPct = pctFromCell(row[COL.aiPct]) ?? 0;
      const olxPct = pctFromCell(row[COL.olxPct]) ?? 0;
      const infoPct = pctFromCell(row[COL.infoPct]) ?? 0;

      const olxLabel = String(row[COL.olxLabel] ?? '').trim();
      const data: Record<string, unknown> = {
        [grossKey]: gross,
        [mediatorKey]: mediatorPct,
        [aiKey]: aiPct,
      };
      if (currencyField) data[currencyField.key] = currency;

      const title = `Импорт ${dealDate.toISOString().slice(0, 10)} · ${gross} ${currency}`;

      if (opts?.dryRun) {
        created++;
        continue;
      }

      try {
        const deal = await this.prisma.deal.create({
          data: {
            organizationId,
            title,
            dealDate,
            status: DealStatus.CLOSED,
            templateId,
            rateSnapshot: Object.keys(rates).length > 0 ? rates : undefined,
            infoPct:
              infoPct != null && infoPct > 0
                ? new Prisma.Decimal(String(infoPct))
                : null,
            dataRows: { create: [{ data: data as object, order: 0 }] },
            participants: {
              create: participants.map((p) => ({ userId: p.userId, pct: p.pct })),
            },
          },
        });

        if (mediatorPct > 0) {
          const medName = 'Посредник';
          let med = mediatorByName.get(normName(medName));
          if (!med) {
            med = await this.prisma.mediator.create({
              data: { organizationId, name: medName, defaultPct: mediatorPct },
            });
            mediatorByName.set(normName(med.name), med);
          }
          await this.prisma.dealMediator.create({
            data: { dealId: deal.id, mediatorId: med.id, pct: mediatorPct },
          });
        }

        if (olxPct > 0 && olxLabel) {
          let olx = olxByName.get(normName(olxLabel));
          if (!olx) {
            olx = await this.prisma.olx.create({
              data: { organizationId, name: olxLabel, defaultPct: olxPct },
            });
            olxByName.set(normName(olx.name), olx);
          }
          await this.prisma.dealOlx.create({
            data: { dealId: deal.id, olxId: olx.id, pct: olxPct },
          });
        }

        created++;
      } catch (e) {
        errors.push(
          `Строка ${i + 1}: ${e instanceof Error ? e.message : String(e)}`,
        );
        skipped++;
      }
    }

    return { created, skipped, errors: errors.slice(0, 50) };
  }

  private async resolveDefaultTemplate(organizationId: string): Promise<string | null> {
    const tpl = await this.prisma.dealTemplate.findFirst({
      where: {
        organizationId,
        OR: [{ name: { contains: 'Учет', mode: 'insensitive' } }, { name: { contains: 'CRM', mode: 'insensitive' } }],
      },
      orderBy: { updatedAt: 'desc' },
    });
    return tpl?.id ?? null;
  }
}
