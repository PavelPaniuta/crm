import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { AccountingExportService } from './accounting-export.service';
import { AccountingImportService } from './accounting-import.service';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(
    private reports: ReportsService,
    private accountingExport: AccountingExportService,
    private accountingImport: AccountingImportService,
  ) {}

  @Get('workers')
  workers(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.workersPayouts(req.user.activeOrganizationId, from, to);
  }

  @Get('accounting/export')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  async exportAccounting(
    @Req() req: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const buffer = await this.accountingExport.buildXlsx(
      req.user.activeOrganizationId,
      from,
      to,
    );
    const fromPart = from?.slice(0, 10) ?? 'start';
    const toPart = to?.slice(0, 10) ?? 'end';
    const filename = `uchet-sdelok_${fromPart}_${toPart}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('accounting/import')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  async importAccounting(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRun?: string,
    @Query('templateId') templateId?: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Файл не загружен');
    return this.accountingImport.importXlsx(req.user.activeOrganizationId, file.buffer, {
      dryRun: dryRun === '1',
      templateId: templateId || undefined,
    });
  }
}

