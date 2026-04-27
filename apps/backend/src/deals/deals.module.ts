import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { LegacyImportService } from './legacy-import.service';

@Module({
  controllers: [DealsController],
  providers: [DealsService, LegacyImportService],
})
export class DealsModule {}

