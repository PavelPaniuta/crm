import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OfficeInfoController } from './office-info.controller';
import { OfficeInfoService } from './office-info.service';

@Module({
  imports: [PrismaModule],
  controllers: [OfficeInfoController],
  providers: [OfficeInfoService],
  exports: [OfficeInfoService],
})
export class OfficeInfoModule {}
