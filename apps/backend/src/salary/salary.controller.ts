import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { SalaryService } from './salary.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('salary')
@UseGuards(AuthGuard, RolesGuard)
export class SalaryController {
  constructor(private salary: SalaryService) {}

  /** GET /salary/overview?organizationId=&period=2026-04 */
  @Get('overview')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getOverview(
    @Query('organizationId') organizationId: string,
    @Query('period') period: string,
    @Request() req: any,
  ) {
    const orgId = organizationId || req.user?.organizationId;
    const p = period || new Date().toISOString().slice(0, 7);
    return this.salary.getOrgOverview(orgId, p);
  }

  /** PUT /salary/config/:userId */
  @Put('config/:userId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  upsertConfig(
    @Param('userId') userId: string,
    @Body() body: { baseAmount: number; currency: string; payDay: number; note?: string },
  ) {
    return this.salary.upsertConfig(userId, body);
  }

  /** POST /salary/payments */
  @Post('payments')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createPayment(@Body() body: {
    userId: string;
    organizationId: string;
    amount: number;
    currency: string;
    period: string;
    type: string;
    note?: string;
    isPaid?: boolean;
  }) {
    return this.salary.createPayment(body);
  }

  /** PATCH /salary/payments/:id/paid */
  @Patch('payments/:id/paid')
  @Roles('ADMIN', 'SUPER_ADMIN')
  setPaymentPaid(
    @Param('id') id: string,
    @Body() body: { isPaid: boolean },
  ) {
    return this.salary.setPaymentPaid(id, body.isPaid);
  }

  /** PUT /salary/payments/:id */
  @Put('payments/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updatePayment(
    @Param('id') id: string,
    @Body() body: { amount?: number; currency?: string; note?: string; type?: string; isPaid?: boolean },
  ) {
    return this.salary.updatePayment(id, body);
  }

  /** DELETE /salary/payments/:id */
  @Delete('payments/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  deletePayment(@Param('id') id: string) {
    return this.salary.deletePayment(id);
  }
}
