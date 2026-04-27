import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ExpensesService } from './expenses.service';
import { ExpenseStatus } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';

@Controller('expenses')
@UseGuards(AuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get()
  list(@Req() req: any) {
    return this.expenses.list(req.user.activeOrganizationId);
  }

  @Post()
  create(
    @Req() req: any,
    @Body() body: { title: string; amount: number; currency: string; payMethod: string },
  ) {
    return this.expenses.create(req.user.activeOrganizationId, body);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      amount: number;
      currency: string;
      payMethod: string;
      status: ExpenseStatus;
    }>,
  ) {
    return this.expenses.update(req.user.activeOrganizationId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.expenses.delete(req.user.activeOrganizationId, id);
  }

  @Post(':id/submit')
  submit(@Req() req: any, @Param('id') id: string) {
    return this.expenses.update(req.user.activeOrganizationId, id, { status: ExpenseStatus.SUBMITTED });
  }

  @Post(':id/approve')
  @Roles(Role.ADMIN)  // ADMIN + SUPER_ADMIN via hierarchy
  approve(@Req() req: any, @Param('id') id: string) {
    return this.expenses.update(req.user.activeOrganizationId, id, { status: ExpenseStatus.APPROVED });
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN)
  reject(@Req() req: any, @Param('id') id: string) {
    return this.expenses.update(req.user.activeOrganizationId, id, { status: ExpenseStatus.REJECTED });
  }
}

