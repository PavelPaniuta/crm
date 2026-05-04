import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FieldType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SLUG_RE = /^[a-z][a-z0-9_]*$/;

function assertSlug(slug: string, field: string) {
  if (!SLUG_RE.test(slug)) {
    throw new BadRequestException(
      `${field}: только латиница, цифры и подчёркивание, начинаться с буквы (например new_lead)`,
    );
  }
}

@Injectable()
export class ClientOrgSettingsService {
  constructor(private prisma: PrismaService) {}

  async ensureDefaults(organizationId: string) {
    const n = await this.prisma.clientStatus.count({ where: { organizationId } });
    if (n === 0) {
      await this.prisma.$transaction([
        this.prisma.clientStatus.create({
          data: {
            organizationId,
            slug: 'new',
            label: 'Новый',
            sortOrder: 0,
            color: '#3b82f6',
            isTerminal: false,
          },
        }),
        this.prisma.clientStatus.create({
          data: {
            organizationId,
            slug: 'in_progress',
            label: 'В работе',
            sortOrder: 1,
            color: '#f59e0b',
            isTerminal: false,
          },
        }),
        this.prisma.clientStatus.create({
          data: {
            organizationId,
            slug: 'transferred_close',
            label: 'Передан в Close',
            sortOrder: 2,
            color: '#8b5cf6',
            isTerminal: false,
          },
        }),
        this.prisma.clientStatus.create({
          data: {
            organizationId,
            slug: 'closed',
            label: 'Закрыт',
            sortOrder: 3,
            color: '#64748b',
            isTerminal: true,
          },
        }),
      ]);
    }
    await this.backfillNullClientStatuses(organizationId);
  }

  private async backfillNullClientStatuses(organizationId: string) {
    const first = await this.prisma.clientStatus.findFirst({
      where: { organizationId },
      orderBy: { sortOrder: 'asc' },
    });
    if (!first) return;
    await this.prisma.client.updateMany({
      where: { organizationId, statusId: null },
      data: { statusId: first.id },
    });
  }

  async listStatuses(organizationId: string) {
    await this.ensureDefaults(organizationId);
    return this.prisma.clientStatus.findMany({
      where: { organizationId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createStatus(
    organizationId: string,
    body: { slug: string; label: string; sortOrder?: number; color?: string | null; isTerminal?: boolean },
  ) {
    await this.ensureDefaults(organizationId);
    const slug = body.slug.trim().toLowerCase();
    assertSlug(slug, 'slug');
    if (!body.label?.trim()) throw new BadRequestException('label is required');
    return this.prisma.clientStatus.create({
      data: {
        organizationId,
        slug,
        label: body.label.trim(),
        sortOrder: body.sortOrder ?? 99,
        color: body.color?.trim() || null,
        isTerminal: body.isTerminal ?? false,
      },
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    body: { label?: string; sortOrder?: number; color?: string | null; isTerminal?: boolean },
  ) {
    const row = await this.prisma.clientStatus.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException();
    return this.prisma.clientStatus.update({
      where: { id },
      data: {
        ...(body.label !== undefined ? { label: body.label.trim() } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.color !== undefined ? { color: body.color?.trim() || null } : {}),
        ...(body.isTerminal !== undefined ? { isTerminal: body.isTerminal } : {}),
      },
    });
  }

  async deleteStatus(organizationId: string, id: string) {
    const row = await this.prisma.clientStatus.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException();
    const used = await this.prisma.client.count({ where: { organizationId, statusId: id } });
    if (used > 0) {
      throw new BadRequestException('Нельзя удалить статус: есть клиенты с этим статусом');
    }
    await this.prisma.clientStatus.delete({ where: { id } });
    return { ok: true };
  }

  async listFieldDefinitions(organizationId: string) {
    return this.prisma.clientFieldDefinition.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });
  }

  async createFieldDefinition(
    organizationId: string,
    body: {
      key: string;
      label: string;
      type?: FieldType;
      required?: boolean;
      order?: number;
      options?: string | null;
    },
  ) {
    const key = body.key.trim().toLowerCase();
    assertSlug(key, 'key');
    if (!body.label?.trim()) throw new BadRequestException('label is required');
    return this.prisma.clientFieldDefinition.create({
      data: {
        organizationId,
        key,
        label: body.label.trim(),
        type: body.type ?? FieldType.TEXT,
        required: body.required ?? false,
        order: body.order ?? 99,
        options: body.options?.trim() || null,
      },
    });
  }

  async updateFieldDefinition(
    organizationId: string,
    id: string,
    body: {
      label?: string;
      type?: FieldType;
      required?: boolean;
      order?: number;
      options?: string | null;
    },
  ) {
    const row = await this.prisma.clientFieldDefinition.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException();
    return this.prisma.clientFieldDefinition.update({
      where: { id },
      data: {
        ...(body.label !== undefined ? { label: body.label.trim() } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.required !== undefined ? { required: body.required } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
        ...(body.options !== undefined ? { options: body.options?.trim() || null } : {}),
      },
    });
  }

  async deleteFieldDefinition(organizationId: string, id: string) {
    const row = await this.prisma.clientFieldDefinition.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException();
    await this.prisma.clientFieldDefinition.delete({ where: { id } });
    return { ok: true };
  }

  async assertStatusInOrg(organizationId: string, statusId: string) {
    const s = await this.prisma.clientStatus.findFirst({ where: { id: statusId, organizationId } });
    if (!s) throw new BadRequestException('Недопустимый статус');
    return s;
  }
}
