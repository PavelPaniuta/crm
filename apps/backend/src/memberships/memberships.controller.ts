import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { MembershipsService } from './memberships.service';

@Controller('memberships')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MembershipsController {
  constructor(private svc: MembershipsService) {}

  /** Add user to an additional org */
  @Post()
  add(@Req() req: any, @Body() body: { userId: string; organizationId: string }) {
    return this.svc.addMembership(req.user.role, req.user.activeOrganizationId, body.userId, body.organizationId);
  }

  /** Remove user from an additional org */
  @Delete(':userId/:orgId')
  remove(@Req() req: any, @Param('userId') userId: string, @Param('orgId') orgId: string) {
    return this.svc.removeMembership(req.user.role, req.user.activeOrganizationId, userId, orgId);
  }

  /** Get all memberships for a user */
  @Get(':userId')
  getForUser(@Param('userId') userId: string) {
    return this.svc.getUserMemberships(userId);
  }

  /** Get all workers visible in an org (primary + members) */
  @Get('org/:orgId/workers')
  getOrgWorkers(@Param('orgId') orgId: string) {
    return this.svc.getOrgWorkers(orgId);
  }
}
