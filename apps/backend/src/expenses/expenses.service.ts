import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseStatus } from '@prisma/client';
import { ExpenseOrgSettingsService } from './expense-org-settings.service';

const expenseInclude = {
  category: { select: { id: true, name: true, color: true, isActive: true } },
  supplier: { select: { id: true, name: true } },
  files: {
    select: { id: true, fileName: true, fileSize: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private orgSettings: ExpenseOrgSettingsService,
  ) {}

  list(organizationId: string) {
    return this.prisma.expense.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: expenseInclude,
    });
  }

  async create(
    organizationId: string,
    data: {
      title: string;
      amount: number;
      currency: string;
      payMethod: string;
      categoryId: string;
      supplierId?: string | null;
      comment?: string | null;
    },
  ) {
    await this.orgSettings.assertCategoryInOrg(organizationId, data.categoryId);
    await this.orgSettings.assertSupplierForCategory(
      organizationId,
      data.categoryId,
      data.supplierId,
    );
    return this.prisma.expense.create({
      data: {
        organizationId,
        title: data.title.trim(),
        amount: data.amount,
        currency: data.currency,
        payMethod: data.payMethod,
        categoryId: data.categoryId,
        supplierId: data.supplierId || null,
        comment: data.comment?.trim() || null,
      },
      include: expenseInclude,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
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
    const existing = await this.prisma.expense.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException();

    if (existing.status !== ExpenseStatus.DRAFT && (data.title !== undefined || data.amount !== undefined || data.currency !== undefined || data.payMethod !== undefined || data.categoryId !== undefined || data.supplierId !== undefined || data.comment !== undefined)) {
      throw new BadRequestException('Редактировать можно только черновик');
    }

    const categoryId = data.categoryId ?? existing.categoryId;
    if (data.categoryId !== undefined) {
      await this.orgSettings.assertCategoryInOrg(organizationId, categoryId);
    }
    const supplierId =
      data.supplierId !== undefined ? data.supplierId : existing.supplierId;
    if (data.supplierId !== undefined || data.categoryId !== undefined) {
      await this.orgSettings.assertSupplierForCategory(organizationId, categoryId, supplierId);
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.payMethod !== undefined ? { payMethod: data.payMethod } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.supplierId !== undefined ? { supplierId: data.supplierId } : {}),
        ...(data.comment !== undefined ? { comment: data.comment?.trim() || null } : {}),
      },
      include: expenseInclude,
    });
  }

  async delete(organizationId: string, id: string) {
    const existing = await this.prisma.expense.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException();
    await this.prisma.expense.delete({ where: { id } });
    return { ok: true };
  }
}
