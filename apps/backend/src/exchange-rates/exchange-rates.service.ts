import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

const TRACKED_CURRENCIES: Record<string, { symbol: string; name: string }> = {
  EUR: { symbol: '€', name: 'Euro' },
  UAH: { symbol: '₴', name: 'Ukrainian Hryvnia' },
  PLN: { symbol: 'zł', name: 'Polish Zloty' },
  CHF: { symbol: 'Fr', name: 'Swiss Franc' },
  GBP: { symbol: '£', name: 'British Pound' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar' },
};

@Injectable()
export class ExchangeRatesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private lastFetchedAt: Date | null = null;

  constructor(private prisma: PrismaService) {}

  /** Runs once on app start */
  async onApplicationBootstrap() {
    try {
      await this.syncRates();
    } catch (e) {
      this.logger.warn('Could not sync exchange rates on startup: ' + e?.message);
    }
  }

  /** Runs every day at 06:00 */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async scheduledSync() {
    try {
      await this.syncRates();
    } catch (e) {
      this.logger.warn('Scheduled exchange rate sync failed: ' + e?.message);
    }
  }

  /** Fetch rates from free API and save to DB */
  async syncRates(): Promise<{ updated: number; source: string }> {
    this.logger.log('Syncing exchange rates...');

    const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', {
      timeout: 10_000,
    });

    if (data?.result !== 'success' || !data?.rates) {
      throw new Error('Invalid response from exchange rate API');
    }

    const rates: Record<string, number> = data.rates;
    let updated = 0;

    for (const [code, meta] of Object.entries(TRACKED_CURRENCIES)) {
      const rate = rates[code];
      if (!rate) continue;
      await this.upsert(code, rate, meta.symbol, meta.name);
      updated++;
    }

    this.lastFetchedAt = new Date();
    this.logger.log(`Exchange rates updated: ${updated} currencies`);
    return { updated, source: 'open.er-api.com' };
  }

  list() {
    return this.prisma.exchangeRate.findMany({ orderBy: { code: 'asc' } });
  }

  getLastSyncedAt() {
    return this.lastFetchedAt;
  }

  upsert(code: string, rateToUsd: number, symbol?: string, name?: string) {
    const data = {
      rateToUsd: new Prisma.Decimal(String(rateToUsd)),
      ...(symbol !== undefined && { symbol }),
      ...(name !== undefined && { name }),
    };
    return this.prisma.exchangeRate.upsert({
      where: { code },
      update: data,
      create: { code, symbol: symbol ?? code, name: name ?? code, rateToUsd: new Prisma.Decimal(String(rateToUsd)) },
    });
  }
}
