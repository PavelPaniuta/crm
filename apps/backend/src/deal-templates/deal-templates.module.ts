import { Module } from '@nestjs/common';
import { DealTemplatesController } from './deal-templates.controller';
import { DealTemplatesService } from './deal-templates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DealTemplatesController],
  providers: [DealTemplatesService],
})
export class DealTemplatesModule {}
