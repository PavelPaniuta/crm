import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { OfficeInfoService } from './office-info.service';

@Controller('office-info')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
export class OfficeInfoController {
  constructor(private info: OfficeInfoService) {}

  @Get()
  get(@Req() req: any) {
    return this.info.getForOrganization(req.user.activeOrganizationId);
  }

  @Patch()
  update(
    @Req() req: any,
    @Body() body: { name?: string; defaultPct?: number | null },
  ) {
    return this.info.update(req.user.activeOrganizationId, body);
  }
}
