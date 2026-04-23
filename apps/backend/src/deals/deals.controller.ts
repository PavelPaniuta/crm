import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DealsService } from './deals.service';
import { DealStatus } from '@prisma/client';

@Controller('deals')
@UseGuards(AuthGuard)
export class DealsController {
  constructor(private deals: DealsService) {}

  @Get()
  list(@Req() req: any) {
    return this.deals.list(req.user.activeOrganizationId);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.deals.get(req.user.activeOrganizationId, id);
  }

  @Post()
  create(
    @Req() req: any,
    @Body() body: { title: string; clientId?: string | null; dealDate?: string },
  ) {
    return this.deals.create(req.user.activeOrganizationId, body);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { title?: string; status?: DealStatus; clientId?: string | null; dealDate?: string },
  ) {
    return this.deals.update(req.user.activeOrganizationId, id, body);
  }

  @Post(':id/amounts')
  addAmount(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      currency: string;
      mediatorPct: number;
      rateToUsdt: number;
      branchPct: number;
      payoutUsdt?: number;
    },
  ) {
    return this.deals.addAmount(req.user.activeOrganizationId, id, body);
  }

  @Put(':id/amounts')
  replaceAmounts(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      amounts: Array<{
        amount: number;
        currency: string;
        mediatorPct: number;
        rateToUsdt: number;
        branchPct: number;
        payoutUsdt?: number;
      }>;
    },
  ) {
    return this.deals.replaceAmounts(req.user.activeOrganizationId, id, body.amounts);
  }

  @Post(':id/participants')
  setParticipants(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { participants: Array<{ userId: string; pct: number }> },
  ) {
    return this.deals.setParticipants(req.user.activeOrganizationId, id, body.participants);
  }
}

