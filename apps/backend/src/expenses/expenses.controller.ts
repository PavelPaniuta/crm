import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { ExpensesService } from './expenses.service';
import { ExpenseFilesService } from './expense-files.service';
import { ExpenseStatus, Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('expenses')
@UseGuards(AuthGuard, RolesGuard)
export class ExpensesController {
  constructor(
    private expenses: ExpensesService,
    private files: ExpenseFilesService,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.expenses.list(req.user.activeOrganizationId);
  }

  @Post()
  create(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      amount: number;
      currency: string;
      payMethod: string;
      categoryId: string;
      supplierId?: string | null;
      comment?: string | null;
    },
  ) {
    return this.expenses.create(req.user.activeOrganizationId, body);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      amount: number;
      currency: string;
      payMethod: string;
      status: ExpenseStatus;
      categoryId: string;
      supplierId: string | null;
      comment: string | null;
    }>,
  ) {
    return this.expenses.update(req.user.activeOrganizationId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.expenses.delete(req.user.activeOrganizationId, id);
  }

  @Post(':id/submit')
  submit(@Req() req: any, @Param('id') id: string) {
    return this.expenses.update(req.user.activeOrganizationId, id, { status: ExpenseStatus.SUBMITTED });
  }

  @Post(':id/approve')
  @Roles(Role.ADMIN)
  approve(@Req() req: any, @Param('id') id: string) {
    return this.expenses.update(req.user.activeOrganizationId, id, { status: ExpenseStatus.APPROVED });
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN)
  reject(@Req() req: any, @Param('id') id: string) {
    return this.expenses.update(req.user.activeOrganizationId, id, { status: ExpenseStatus.REJECTED });
  }

  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadFile(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.files.upload(req.user.activeOrganizationId, id, req.user.id, file);
  }

  @Get(':id/files/:fileId')
  downloadFile(@Req() req: any, @Param('id') id: string, @Param('fileId') fileId: string) {
    return this.files.download(req.user.activeOrganizationId, id, fileId);
  }

  @Delete(':id/files/:fileId')
  deleteFile(@Req() req: any, @Param('id') id: string, @Param('fileId') fileId: string) {
    return this.files.remove(req.user.activeOrganizationId, id, fileId);
  }
}
