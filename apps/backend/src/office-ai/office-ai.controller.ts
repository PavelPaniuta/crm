import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { OfficeAiService } from './office-ai.service';

@Controller('office-ai')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
export class OfficeAiController {
  constructor(private officeAi: OfficeAiService) {}

  @Get()
  get(@Req() req: any) {
    return this.officeAi.getForOrganization(req.user.activeOrganizationId);
  }

  @Patch()
  update(@Req() req: any, @Body() body: { name?: string }) {
    return this.officeAi.updateName(req.user.activeOrganizationId, body.name ?? 'AI');
  }
}
