import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)  // ADMIN and SUPER_ADMIN (guard uses hierarchy)
  list(@Req() req: any) {
    return this.users.list(req.user.activeOrganizationId);
  }

  @Get('public')
  listPublic(@Req() req: any) {
    return this.users.listPublicForOrg(req.user.activeOrganizationId, req.user.role);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(
    @Req() req: any,
    @Body() body: { email: string; password: string; role: Role; position?: string | null; targetOrgId?: string | null },
  ) {
    return this.users.create(req.user.activeOrganizationId, body, req.user.role);
  }

  @Patch('role')
  @Roles(Role.ADMIN)
  setRole(
    @Req() req: any,
    @Body() body: { userId: string; role: Role },
  ) {
    return this.users.setRole(req.user.activeOrganizationId, body.userId, body.role, req.user.role);
  }

  @Patch('password')
  @Roles(Role.ADMIN)
  resetPassword(
    @Req() req: any,
    @Body() body: { userId: string; password: string },
  ) {
    return this.users.resetPassword(req.user.activeOrganizationId, body.userId, body.password, req.user.role);
  }

  @Patch('position')
  @Roles(Role.ADMIN)
  setPosition(
    @Req() req: any,
    @Body() body: { userId: string; position: string | null },
  ) {
    return this.users.setPosition(req.user.activeOrganizationId, body.userId, body.position, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.users.deleteUser(req.user.activeOrganizationId, id, req.user.id, req.user.role);
  }
}
