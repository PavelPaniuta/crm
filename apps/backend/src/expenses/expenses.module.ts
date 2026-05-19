import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpenseOrgSettingsService } from './expense-org-settings.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseSuppliersController } from './expense-suppliers.controller';
import { ExpenseFilesService } from './expense-files.service';

@Module({
  controllers: [ExpensesController, ExpenseCategoriesController, ExpenseSuppliersController],
  providers: [ExpensesService, ExpenseOrgSettingsService, ExpenseFilesService],
  exports: [ExpenseOrgSettingsService],
})
export class ExpensesModule {}
