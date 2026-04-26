import { Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService, getIp, getUa } from './audit.service';
import { Request } from 'express';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class AuditController {
  constructor(private audit: AuditService) {}

  /** My active sessions */
  @Get('sessions')
  @Roles(Role.WORKER)
  mySessions(@Req() req: { user: { id: string } }) {
    return this.audit.getUserSessions(req.user.id);
  }

  /** Revoke a specific session */
  @Delete('sessions/:id')
  @Roles(Role.WORKER)
  async revokeSession(
    @Req() req: Request & { user: { id: string; activeOrganizationId: string } },
    @Param('id') id: string,
  ) {
    const result = await this.audit.revokeSession(id, req.user.id);
    if (result.ok) {
      void this.audit.log({
        userId: req.user.id,
        organizationId: req.user.activeOrganizationId,
        action: 'SESSION_REVOKED',
        entityType: 'session',
        entityId: id,
        ip: getIp(req),
        userAgent: getUa(req),
      });
    }
    return result;
  }

  /** Revoke all other sessions (sign out everywhere) */
  @Post('sessions/revoke-all')
  @Roles(Role.WORKER)
  async revokeAllSessions(@Req() req: Request & { user: { id: string; activeOrganizationId: string } }) {
    // Keep the current token alive
    const currentToken = (req as any).cookies?.session_token ?? '';
    await this.audit.revokeAllSessions(req.user.id, currentToken);
    void this.audit.log({
      userId: req.user.id,
      organizationId: req.user.activeOrganizationId,
      action: 'SESSION_REVOKED',
      entityType: 'session',
      details: { note: 'revoke_all_others' },
      ip: getIp(req),
      userAgent: getUa(req),
    });
    return { ok: true };
  }

  /** Org audit log — admin only */
  @Get('audit-log')
  @Roles(Role.ADMIN)
  getAuditLog(
    @Req() req: { user: { activeOrganizationId: string } },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.getOrgLogs(
      req.user.activeOrganizationId,
      limit ? Math.min(Number(limit), 200) : 100,
      offset ? Number(offset) : 0,
    );
  }
}
