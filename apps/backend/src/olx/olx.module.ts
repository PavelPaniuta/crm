import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OlxController } from './olx.controller';
import { OlxService } from './olx.service';

@Module({
  imports: [PrismaModule],
  controllers: [OlxController],
  providers: [OlxService],
  exports: [OlxService],
})
export class OlxModule {}
