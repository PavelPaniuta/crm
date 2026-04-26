import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { OrgsService } from './orgs.service';
import { AuthService } from '../auth/auth.service';

@Controller('orgs')
@UseGuards(AuthGuard)
export class OrgsController {
  constructor(
    private orgs: OrgsService,
    private auth: AuthService,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.orgs.listForUser(req.user.id, req.user.role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async create(@Body() body: { name: string }) {
    return this.orgs.create(body.name);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  deleteOrg(@Req() req: any, @Param('id') id: string) {
    return this.orgs.deleteOrg(id, req.user.id);
  }

  @Post('switch')
  async switchOrg(@Req() req: any, @Body() body: { organizationId: string }) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'biscrm_sid';
    const token = req.cookies?.[cookieName] as string | undefined;
    if (!token) return { ok: false };

    // Only SUPER_ADMIN can switch between orgs
    if (req.user.role !== 'SUPER_ADMIN') {
      if (body.organizationId !== req.user.organizationId) {
        return { ok: false, error: 'Access denied' };
      }
    }

    await this.orgs.assertOrgExists(body.organizationId);
    await this.auth.switchOrganization(token, body.organizationId);
    return { ok: true };
  }
}
