import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AccountingExportService } from './accounting-export.service';
import { AccountingImportService } from './accounting-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, AccountingExportService, AccountingImportService],
})
export class ReportsModule {}

