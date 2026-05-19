import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MediatorsController } from './mediators.controller';
import { MediatorsService } from './mediators.service';

@Module({
  imports: [PrismaModule],
  controllers: [MediatorsController],
  providers: [MediatorsService],
  exports: [MediatorsService],
})
export class MediatorsModule {}
