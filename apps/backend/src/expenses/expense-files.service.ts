import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_EXPENSE = 10;

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
  'image/heic',
  'image/heif',
]);

@Injectable()
export class ExpenseFilesService {
  private readonly uploadRoot: string;

  constructor(private prisma: PrismaService) {
    this.uploadRoot = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const expenseDir = join(this.uploadRoot, 'expenses');
    if (!existsSync(expenseDir)) {
      mkdirSync(expenseDir, { recursive: true });
    }
  }

  private expenseDir() {
    return join(this.uploadRoot, 'expenses');
  }

  private async getExpenseInOrg(organizationId: string, expenseId: string) {
    const e = await this.prisma.expense.findFirst({
      where: { id: expenseId, organizationId },
    });
    if (!e) throw new NotFoundException();
    return e;
  }

  async upload(
    organizationId: string,
    expenseId: string,
    userId: string,
    file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Файл не загружен');
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('Максимальный размер файла — 10 МБ');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('Допустимые форматы: PNG, JPG, PDF, HEIC');
    }

    const expense = await this.getExpenseInOrg(organizationId, expenseId);
    if (expense.status !== 'DRAFT') {
      throw new BadRequestException('Файлы можно добавлять только к черновику');
    }

    const count = await this.prisma.expenseFile.count({ where: { expenseId } });
    if (count >= MAX_FILES_PER_EXPENSE) {
      throw new BadRequestException(`Не более ${MAX_FILES_PER_EXPENSE} файлов на расход`);
    }

    const ext = extname(file.originalname || '') || this.extFromMime(mime);
    const storageName = `${expenseId}_${randomBytes(8).toString('hex')}${ext}`;
    const fullPath = join(this.expenseDir(), storageName);
    writeFileSync(fullPath, file.buffer);

    const relPath = `expenses/${storageName}`;
    return this.prisma.expenseFile.create({
      data: {
        expenseId,
        uploadedById: userId,
        fileUrl: relPath,
        fileName: file.originalname || storageName,
        fileSize: file.size,
        mimeType: mime,
      },
    });
  }

  async remove(organizationId: string, expenseId: string, fileId: string) {
    const expense = await this.getExpenseInOrg(organizationId, expenseId);
    if (expense.status !== 'DRAFT') {
      throw new BadRequestException('Файлы можно удалять только у черновика');
    }
    const row = await this.prisma.expenseFile.findFirst({
      where: { id: fileId, expenseId },
    });
    if (!row) throw new NotFoundException();
    const fullPath = join(this.uploadRoot, row.fileUrl);
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath);
      } catch {
        /* ignore */
      }
    }
    await this.prisma.expenseFile.delete({ where: { id: fileId } });
    return { ok: true };
  }

  async download(organizationId: string, expenseId: string, fileId: string) {
    await this.getExpenseInOrg(organizationId, expenseId);
    const row = await this.prisma.expenseFile.findFirst({
      where: { id: fileId, expenseId },
    });
    if (!row) throw new NotFoundException();
    const fullPath = join(this.uploadRoot, row.fileUrl);
    if (!existsSync(fullPath)) throw new NotFoundException('Файл не найден на диске');
    const stream = createReadStream(fullPath);
    return new StreamableFile(stream, {
      type: row.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(row.fileName)}"`,
    });
  }

  private extFromMime(mime: string) {
    if (mime.includes('png')) return '.png';
    if (mime.includes('pdf')) return '.pdf';
    if (mime.includes('heic') || mime.includes('heif')) return '.heic';
    return '.jpg';
  }
}
