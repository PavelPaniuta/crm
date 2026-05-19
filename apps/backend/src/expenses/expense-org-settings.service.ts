import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_CATEGORIES: { name: string; color: string; sortOrder: number }[] = [
  { name: 'Телефония', color: '#6366F1', sortOrder: 0 },
  { name: 'Офис', color: '#059669', sortOrder: 1 },
  { name: 'Сервисы', color: '#8B5CF6', sortOrder: 2 },
  { name: 'Другое', color: '#64748B', sortOrder: 3 },
];

@Injectable()
export class ExpenseOrgSettingsService {
  constructor(private prisma: PrismaService) {}

  async ensureDefaults(organizationId: string) {
    const n = await this.prisma.expenseCategory.count({ where: { organizationId } });
    if (n === 0) {
      await this.prisma.$transaction(
        DEFAULT_CATEGORIES.map((c) =>
          this.prisma.expenseCategory.create({
            data: { organizationId, name: c.name, color: c.color, sortOrder: c.sortOrder },
          }),
        ),
      );
    }
  }

  async listCategories(organizationId: string, opts?: { activeOnly?: boolean }) {
    await this.ensureDefaults(organizationId);
    const where: { organizationId: string; isActive?: boolean } = { organizationId };
    if (opts?.activeOnly) where.isActive = true;
    return this.prisma.expenseCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(organizationId: string, body: { name: string; color?: string | null }) {
    await this.ensureDefaults(organizationId);
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Название обязательно');
    const maxOrder = await this.prisma.expenseCategory.aggregate({
      where: { organizationId },
      _max: { sortOrder: true },
    });
    return this.prisma.expenseCategory.create({
      data: {
        organizationId,
        name,
        color: body.color?.trim() || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateCategory(
    organizationId: string,
    id: string,
    body: { name?: string; color?: string | null; isActive?: boolean; sortOrder?: number },
  ) {
    const row = await this.prisma.expenseCategory.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException();
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw new BadRequestException('Название обязательно');
    }
    return this.prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.color !== undefined ? { color: body.color?.trim() || null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
  }

  async listSuppliers(
    organizationId: string,
    opts?: { categoryId?: string; activeOnly?: boolean },
  ) {
    await this.ensureDefaults(organizationId);
    const where: {
      category: { organizationId: string; isActive?: boolean };
      isActive?: boolean;
      categoryId?: string;
    } = {
      category: { organizationId },
    };
    if (opts?.categoryId) where.categoryId = opts.categoryId;
    if (opts?.activeOnly) {
      where.isActive = true;
      where.category.isActive = true;
    }
    return this.prisma.expenseSupplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true, isActive: true } } },
    });
  }

  async createSupplier(organizationId: string, body: { categoryId: string; name: string }) {
    const categoryId = body.categoryId?.trim();
    const name = body.name?.trim();
    if (!categoryId || !name) throw new BadRequestException('Категория и название обязательны');
    const cat = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!cat) throw new BadRequestException('Категория не найдена');
    if (!cat.isActive) throw new BadRequestException('Категория деактивирована');
    return this.prisma.expenseSupplier.create({
      data: { categoryId, name },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async updateSupplier(
    organizationId: string,
    id: string,
    body: { name?: string; isActive?: boolean },
  ) {
    const row = await this.prisma.expenseSupplier.findFirst({
      where: { id, category: { organizationId } },
    });
    if (!row) throw new NotFoundException();
    if (body.name !== undefined && !body.name.trim()) {
      throw new BadRequestException('Название обязательно');
    }
    return this.prisma.expenseSupplier.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
  }

  async assertCategoryInOrg(organizationId: string, categoryId: string) {
    const c = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, organizationId, isActive: true },
    });
    if (!c) throw new BadRequestException('Недопустимая категория');
    return c;
  }

  async assertSupplierForCategory(
    organizationId: string,
    categoryId: string,
    supplierId: string | null | undefined,
  ) {
    if (!supplierId) return null;
    const s = await this.prisma.expenseSupplier.findFirst({
      where: {
        id: supplierId,
        categoryId,
        isActive: true,
        category: { organizationId, isActive: true },
      },
    });
    if (!s) throw new BadRequestException('Недопустимый поставщик');
    return s;
  }

  async getOtherCategoryId(organizationId: string) {
    await this.ensureDefaults(organizationId);
    const c = await this.prisma.expenseCategory.findFirst({
      where: { organizationId, name: 'Другое' },
    });
    if (!c) throw new BadRequestException('Категории не настроены');
    return c.id;
  }
}
