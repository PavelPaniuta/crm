import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExchangeRatesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.exchangeRate.findMany({ orderBy: { code: 'asc' } });
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
