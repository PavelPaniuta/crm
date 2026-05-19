import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OfficeAiController } from './office-ai.controller';
import { OfficeAiService } from './office-ai.service';

@Module({
  imports: [PrismaModule],
  controllers: [OfficeAiController],
  providers: [OfficeAiService],
  exports: [OfficeAiService],
})
export class OfficeAiModule {}
