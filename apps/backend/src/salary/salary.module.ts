import { Module } from '@nestjs/common';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OfficeAiModule } from '../office-ai/office-ai.module';

@Module({
  imports: [PrismaModule, OfficeAiModule],
  controllers: [SalaryController],
  providers: [SalaryService],
})
export class SalaryModule {}
