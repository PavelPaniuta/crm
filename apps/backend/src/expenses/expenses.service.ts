import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseStatus } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.expense.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(
    organizationId: string,
    data: {
      title: string;
      amount: number;
      currency: string;
      payMethod: string;
    },
  ) {
    return this.prisma.expense.create({
      data: { organizationId, ...data },
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
    }>,
  ) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException();
    return this.prisma.expense.update({ where: { id }, data });
  }

  async delete(organizationId: string, id: string) {
    const existing = await this.prisma.expense.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException();
    await this.prisma.expense.delete({ where: { id } });
    return { ok: true };
  }
}

