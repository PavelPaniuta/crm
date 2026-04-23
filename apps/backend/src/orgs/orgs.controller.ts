import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
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
    return this.orgs.listForUser(req.user.id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: { name: string }) {
    // MVP: allow any logged-in user to create org; later restrict to ADMIN/global
    const org = await this.orgs.create(body.name);
    // Keep user in their original org; switching is explicit
    return org;
  }

  @Post('switch')
  async switchOrg(@Req() req: any, @Body() body: { organizationId: string }) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'biscrm_sid';
    const token = req.cookies?.[cookieName] as string | undefined;
    if (!token) return { ok: false };

    // MVP security: user can only switch to their org (since no membership table yet)
    await this.orgs.assertOrgExists(body.organizationId);
    await this.auth.switchOrganization(token, body.organizationId);
    return { ok: true };
  }
}

