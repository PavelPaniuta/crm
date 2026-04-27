import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DealStatus, OperationType, Role } from '@prisma/client';
import { DealsService } from './deals.service';
import { LegacyImportService } from './legacy-import.service';

type AmountBody = {
  amountIn: number;
  currencyIn: string;
  amountOut: number;
  currencyOut: string;
  bank: string;
  operationType: OperationType;
  shopName?: string | null;
};

@Controller('deals')
@UseGuards(AuthGuard)
export class DealsController {
  constructor(
    private deals: DealsService,
    private legacyImport: LegacyImportService,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.deals.list(req.user.activeOrganizationId);
  }

  @Post('import-legacy')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  async importLegacy(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('year') yearQ?: string,
    @Query('currency') currencyQ?: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Файл не загружен');
    const year = Math.min(2100, Math.max(2000, parseInt(yearQ ?? '2026', 10) || 2026));
    const currency = (currencyQ || 'PLN').toUpperCase().slice(0, 8);
    return this.legacyImport.importXlsx(req.user.activeOrganizationId, file.buffer, year, currency);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.deals.get(req.user.activeOrganizationId, id);
  }

  @Post()
  create(
    @Req() req: any,
    @Body() body: { title: string; clientId?: string | null; dealDate?: string; status?: DealStatus; comment?: string | null; templateId?: string | null; dataRows?: Array<{ data: Record<string, unknown>; order?: number }> },
  ) {
    return this.deals.create(req.user.activeOrganizationId, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.deals.delete(req.user.activeOrganizationId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      status?: DealStatus;
      clientId?: string | null;
      dealDate?: string;
      comment?: string | null;
    },
  ) {
    return this.deals.update(req.user.activeOrganizationId, id, body);
  }

  @Post(':id/amounts')
  addAmount(@Req() req: any, @Param('id') id: string, @Body() body: AmountBody) {
    return this.deals.addAmount(req.user.activeOrganizationId, id, body);
  }

  @Put(':id/amounts')
  replaceAmounts(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { amounts: AmountBody[] },
  ) {
    return this.deals.replaceAmounts(req.user.activeOrganizationId, id, body.amounts);
  }

  @Post(':id/participants')
  setParticipants(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { participants: Array<{ userId: string; pct: number }> },
  ) {
    return this.deals.setParticipants(req.user.activeOrganizationId, id, body.participants);
  }
}
