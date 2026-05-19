import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { OlxService } from './olx.service';

@Controller('olx')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
export class OlxController {
  constructor(private olx: OlxService) {}

  @Get()
  list(@Req() req: any, @Query('all') all?: string) {
    return this.olx.list(req.user.activeOrganizationId, all !== '1');
  }

  @Post()
  create(
    @Req() req: any,
    @Body() body: { name: string; phone?: string; note?: string; defaultPct?: number },
  ) {
    return this.olx.create(req.user.activeOrganizationId, body);
  }

  @Get(':id')
  detail(
    @Req() req: any,
    @Param('id') id: string,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.olx.getDetail(req.user.activeOrganizationId, id, { period, from, to });
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
    return this.olx.update(req.user.activeOrganizationId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.olx.delete(req.user.activeOrganizationId, id);
  }
}
