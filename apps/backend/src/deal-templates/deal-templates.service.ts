import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FieldType } from '@prisma/client';
import { MEDIATOR_AI_PAYROLL } from '../deals/deal-payout.util';

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
  calcPreset?: string | null;
  payrollPoolPct?: number | null;
  calcGrossFieldKey?: string | null;
  calcMediatorPctKey?: string | null;
  calcAiPctKey?: string | null;
  calcSteps?: unknown | null;
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
    const calcPreset = data.calcPreset === MEDIATOR_AI_PAYROLL ? MEDIATOR_AI_PAYROLL : null;
    const calcFields = calcPreset
      ? {
          calcPreset,
          payrollPoolPct:
            data.payrollPoolPct != null
              ? new Prisma.Decimal(String(data.payrollPoolPct))
              : new Prisma.Decimal('20'),
          calcGrossFieldKey: data.calcGrossFieldKey ?? null,
          calcMediatorPctKey: data.calcMediatorPctKey ?? null,
          calcAiPctKey: data.calcAiPctKey ?? null,
        }
      : {};

    return this.prisma.dealTemplate.create({
      data: {
        organizationId,
        name: data.name,
        hasWorkers: data.hasWorkers ?? true,
        incomeFieldKey: data.incomeFieldKey ?? null,
        ...calcFields,
        ...(Array.isArray(data.calcSteps) && (data.calcSteps as unknown[]).length > 0
          ? { calcSteps: data.calcSteps }
          : {}),
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

    const nextPreset =
      data.calcPreset === undefined
        ? undefined
        : data.calcPreset === MEDIATOR_AI_PAYROLL
          ? MEDIATOR_AI_PAYROLL
          : null;

    const calcUpdate =
      data.calcPreset === undefined
        ? {}
        : nextPreset === null
          ? { calcPreset: null, payrollPoolPct: null, calcGrossFieldKey: null, calcMediatorPctKey: null, calcAiPctKey: null }
          : {
              calcPreset: nextPreset,
              payrollPoolPct:
                data.payrollPoolPct != null
                  ? new Prisma.Decimal(String(data.payrollPoolPct))
                  : new Prisma.Decimal('20'),
              calcGrossFieldKey: data.calcGrossFieldKey ?? null,
              calcMediatorPctKey: data.calcMediatorPctKey ?? null,
              calcAiPctKey: data.calcAiPctKey ?? null,
            };

    await this.prisma.dealTemplate.update({
      where: { id },
      data: {
        name: data.name,
        hasWorkers: data.hasWorkers ?? undefined,
        incomeFieldKey: data.incomeFieldKey === undefined ? undefined : data.incomeFieldKey,
        ...calcUpdate,
        ...(Array.isArray(data.calcSteps) && (data.calcSteps as unknown[]).length > 0
          ? { calcSteps: data.calcSteps }
          : data.calcSteps === null ? { calcSteps: Prisma.JsonNull } : {}),
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
