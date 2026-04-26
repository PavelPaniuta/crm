import { Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { StaffService } from './staff.service';

@Controller('staff')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StaffController {
  constructor(private staff: StaffService) {}

  @Get()
  list(@Req() req: any) {
    if (req.user.role === 'SUPER_ADMIN') {
      return this.staff.listAllGrouped();
    }
    return this.staff.listForAdmin(req.user.activeOrganizationId);
  }

  @Get(':id')
  getMember(@Req() req: any, @Param('id') id: string) {
    return this.staff.getMember(id);
  }
}
