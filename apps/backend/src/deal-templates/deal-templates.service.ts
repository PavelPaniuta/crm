import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FieldType } from '@prisma/client';

type FieldInput = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  order?: number;
  options?: string | null;
};

type TemplateInput = {
  name: string;
  hasWorkers?: boolean;
  incomeFieldKey?: string | null;
  fields?: FieldInput[];
};

@Injectable()
export class DealTemplatesService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.dealTemplate.findMany({
      where: { organizationId },
      include: { fields: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async get(organizationId: string, id: string) {
    const t = await this.prisma.dealTemplate.findFirst({
      where: { id, organizationId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!t) throw new NotFoundException();
    return t;
  }

  async create(organizationId: string, data: TemplateInput) {
    return this.prisma.dealTemplate.create({
      data: {
        organizationId,
        name: data.name,
        hasWorkers: data.hasWorkers ?? true,
        incomeFieldKey: data.incomeFieldKey ?? null,
        fields: data.fields
          ? {
              create: data.fields.map((f, i) => ({
                key: f.key,
                label: f.label,
                type: f.type,
                required: f.required ?? false,
                order: f.order ?? i,
                options: f.options ?? null,
              })),
            }
          : undefined,
      },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
  }

  async update(organizationId: string, id: string, data: TemplateInput) {
    const existing = await this.prisma.dealTemplate.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException();

    await this.prisma.dealTemplate.update({
      where: { id },
      data: {
        name: data.name,
        hasWorkers: data.hasWorkers ?? undefined,
        incomeFieldKey: data.incomeFieldKey === undefined ? undefined : data.incomeFieldKey,
      },
    });

    if (data.fields !== undefined) {
      await this.prisma.dealTemplateField.deleteMany({ where: { templateId: id } });
      if (data.fields.length > 0) {
        await this.prisma.dealTemplateField.createMany({
          data: data.fields.map((f, i) => ({
            templateId: id,
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required ?? false,
            order: f.order ?? i,
            options: f.options ?? null,
          })),
        });
      }
    }

    return this.get(organizationId, id);
  }

  async delete(organizationId: string, id: string) {
    const existing = await this.prisma.dealTemplate.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException();
    await this.prisma.dealTemplate.delete({ where: { id } });
    return { ok: true };
  }
}
