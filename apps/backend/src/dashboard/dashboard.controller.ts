import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  summary(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboard.getSummary(req.user.activeOrganizationId, from, to);
  }

  @Get('global')
  globalSummary(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.dashboard.getGlobalSummary(from, to);
  }
}

