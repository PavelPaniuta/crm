import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClientOrgSettingsService } from './client-org-settings.service';

type CustomData = Record<string, unknown>;

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private orgSettings: ClientOrgSettingsService,
  ) {}

  private clientInclude = { status: true } as const;

  async list(organizationId: string, q?: string) {
    await this.orgSettings.ensureDefaults(organizationId);
    return this.prisma.client.findMany({
      where: {
        organizationId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { bank: { contains: q, mode: 'insensitive' } },
                { assistantName: { contains: q, mode: 'insensitive' } },
                { callSummary: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: this.clientInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      phone: string;
      note?: string | null;
      statusId?: string | null;
      bank?: string | null;
      assistantName?: string | null;
      callSummary?: string | null;
      callStartedAt?: string | Date | null;
      customData?: CustomData | null;
    },
  ) {
    await this.orgSettings.ensureDefaults(organizationId);
    let statusId = data.statusId ?? undefined;
    if (statusId) {
      await this.orgSettings.assertStatusInOrg(organizationId, statusId);
    } else {
      const first = await this.prisma.clientStatus.findFirst({
        where: { organizationId },
        orderBy: { sortOrder: 'asc' },
      });
      statusId = first?.id;
    }
    const customData = this.sanitizeCustomData(data.customData) ?? {};
    return this.prisma.client.create({
      data: {
        organizationId,
        name: data.name.trim(),
        phone: data.phone.trim(),
        note: data.note?.trim() || null,
        statusId: statusId ?? null,
        bank: data.bank?.trim() || null,
        assistantName: data.assistantName?.trim() || null,
        callSummary: data.callSummary?.trim() || null,
        callStartedAt: this.parseDate(data.callStartedAt),
        customData: customData as Prisma.InputJsonValue,
      },
      include: this.clientInclude,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: {
      name?: string;
      phone?: string;
      note?: string | null;
      statusId?: string | null;
      bank?: string | null;
      assistantName?: string | null;
      callSummary?: string | null;
      callStartedAt?: string | Date | null;
      customData?: CustomData | null;
    },
  ) {
    const existing = await this.prisma.client.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException();
    if (data.statusId !== undefined && data.statusId !== null) {
      await this.orgSettings.assertStatusInOrg(organizationId, data.statusId);
    }
    const patch: Prisma.ClientUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.phone !== undefined) patch.phone = data.phone.trim();
    if (data.note !== undefined) patch.note = data.note?.trim() || null;
    if (data.statusId !== undefined) {
      patch.status = data.statusId
        ? { connect: { id: data.statusId } }
        : { disconnect: true };
    }
    if (data.bank !== undefined) patch.bank = data.bank?.trim() || null;
    if (data.assistantName !== undefined) patch.assistantName = data.assistantName?.trim() || null;
    if (data.callSummary !== undefined) patch.callSummary = data.callSummary?.trim() || null;
    if (data.callStartedAt !== undefined) patch.callStartedAt = this.parseDate(data.callStartedAt);
    if (data.customData !== undefined) {
      const merged = { ...((existing.customData as object) ?? {}), ...(data.customData ?? {}) };
      patch.customData = this.sanitizeCustomData(merged) as Prisma.InputJsonValue;
    }
    return this.prisma.client.update({
      where: { id },
      data: patch,
      include: this.clientInclude,
    });
  }

  private parseDate(v: string | Date | null | undefined): Date | null | undefined {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private sanitizeCustomData(data: CustomData | null | undefined): CustomData | null {
    if (data == null) return null;
    const out: CustomData = {};
    for (const [k, v] of Object.entries(data)) {
      if (!/^[a-z][a-z0-9_]*$/i.test(k)) continue;
      if (v === null || v === undefined) {
        out[k] = '';
        continue;
      }
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        out[k] = JSON.stringify(v);
      } else {
        out[k] = String(v);
      }
    }
    return out;
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.prisma.client.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }
}
