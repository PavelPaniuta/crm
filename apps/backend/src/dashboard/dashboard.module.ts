import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MediatorsModule } from '../mediators/mediators.module';
import { OlxModule } from '../olx/olx.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule, MediatorsModule, OlxModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

