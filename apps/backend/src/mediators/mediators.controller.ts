import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { MediatorsService } from './mediators.service';

@Controller('mediators')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
export class MediatorsController {
  constructor(private mediators: MediatorsService) {}

  @Get()
  list(@Req() req: any, @Query('all') all?: string) {
    return this.mediators.list(req.user.activeOrganizationId, all !== '1');
  }

  @Post()
  create(
    @Req() req: any,
    @Body() body: { name: string; phone?: string; note?: string; defaultPct?: number },
  ) {
    return this.mediators.create(req.user.activeOrganizationId, body);
  }

  @Get(':id')
  detail(
    @Req() req: any,
    @Param('id') id: string,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.mediators.getDetail(req.user.activeOrganizationId, id, { period, from, to });
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      phone?: string | null;
      note?: string | null;
      defaultPct?: number | null;
      isActive?: boolean;
    },
  ) {
    return this.mediators.update(req.user.activeOrganizationId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.mediators.delete(req.user.activeOrganizationId, id);
  }
}
