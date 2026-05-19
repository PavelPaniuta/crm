import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ExpenseOrgSettingsService } from './expense-org-settings.service';

@Controller('expense-categories')
@UseGuards(AuthGuard, RolesGuard)
export class ExpenseCategoriesController {
  constructor(private settings: ExpenseOrgSettingsService) {}

  @Get()
  list(@Req() req: any, @Query('activeOnly') activeOnly?: string) {
    const onlyActive = activeOnly === '1' || activeOnly === 'true';
    return this.settings.listCategories(req.user.activeOrganizationId, {
      activeOnly: onlyActive ? true : undefined,
    });
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Req() req: any, @Body() body: { name: string; color?: string | null }) {
    return this.settings.createCategory(req.user.activeOrganizationId, body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string | null; isActive?: boolean; sortOrder?: number },
  ) {
    return this.settings.updateCategory(req.user.activeOrganizationId, id, body);
  }
}
