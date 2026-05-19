import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { AccountingExportService } from './accounting-export.service';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(
    private reports: ReportsService,
    private accountingExport: AccountingExportService,
  ) {}

  @Get('workers')
  workers(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.workersPayouts(req.user.activeOrganizationId, from, to);
  }

  @Get('accounting/export')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  async exportAccounting(
    @Req() req: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const buffer = await this.accountingExport.buildXlsx(
      req.user.activeOrganizationId,
      from,
      to,
    );
    const fromPart = from?.slice(0, 10) ?? 'start';
    const toPart = to?.slice(0, 10) ?? 'end';
    const filename = `uchet-sdelok_${fromPart}_${toPart}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}

