import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClientOrgSettingsService } from './client-org-settings.service';

@Controller('client-statuses')
@UseGuards(AuthGuard, RolesGuard)
export class ClientStatusesController {
  constructor(private settings: ClientOrgSettingsService) {}

  @Get()
  list(@Req() req: any) {
    return this.settings.listStatuses(req.user.activeOrganizationId);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Req() req: any, @Body() body: { slug: string; label: string; sortOrder?: number; color?: string | null; isTerminal?: boolean }) {
    return this.settings.createStatus(req.user.activeOrganizationId, body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { label?: string; sortOrder?: number; color?: string | null; isTerminal?: boolean },
  ) {
    return this.settings.updateStatus(req.user.activeOrganizationId, id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.settings.deleteStatus(req.user.activeOrganizationId, id);
  }
}
