import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ExchangeRatesService } from './exchange-rates.service';

@Controller('exchange-rates')
@UseGuards(AuthGuard)
export class ExchangeRatesController {
  constructor(private svc: ExchangeRatesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Get('meta')
  meta() {
    return { lastSyncedAt: this.svc.getLastSyncedAt() };
  }

  @Post('sync')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  sync() {
    return this.svc.syncRates();
  }

  @Put(':code')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('code') code: string,
    @Body() body: { rateToUsd: number; symbol?: string; name?: string },
  ) {
    return this.svc.upsert(code, body.rateToUsd, body.symbol, body.name);
  }
}
