import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
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
  @Roles(Role.ADMIN)
  list(@Req() req: any) {
    return this.users.list(req.user.activeOrganizationId);
  }

  @Get('public')
  listPublic() {
    return this.users.listPublic();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(
    @Req() req: any,
    @Body() body: { email: string; password: string; role: Role },
  ) {
    return this.users.create(req.user.activeOrganizationId, body);
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
}

