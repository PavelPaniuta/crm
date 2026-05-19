import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ExpenseOrgSettingsService } from './expense-org-settings.service';

@Controller('expense-suppliers')
@UseGuards(AuthGuard, RolesGuard)
export class ExpenseSuppliersController {
  constructor(private settings: ExpenseOrgSettingsService) {}

  @Get()
  list(
    @Req() req: any,
    @Query('categoryId') categoryId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const onlyActive =
      activeOnly === 'false' || activeOnly === '0'
        ? false
        : activeOnly === 'true' || activeOnly === '1' || !!categoryId;
    return this.settings.listSuppliers(req.user.activeOrganizationId, {
      categoryId: categoryId || undefined,
      activeOnly: onlyActive,
    });
  }

  @Post()
  create(@Req() req: any, @Body() body: { categoryId: string; name: string }) {
    return this.settings.createSupplier(req.user.activeOrganizationId, body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
  ) {
    return this.settings.updateSupplier(req.user.activeOrganizationId, id, body);
  }
}
