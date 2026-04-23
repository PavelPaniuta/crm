import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('workers')
  workers(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.workersPayouts(req.user.activeOrganizationId, from, to);
  }
}

