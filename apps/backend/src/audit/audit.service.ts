import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

export type AuditAction =
  | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED'
  | 'CREATE_DEAL' | 'UPDATE_DEAL' | 'DELETE_DEAL'
  | 'CREATE_CLIENT' | 'UPDATE_CLIENT' | 'DELETE_CLIENT'
  | 'CREATE_EXPENSE' | 'UPDATE_EXPENSE' | 'DELETE_EXPENSE'
  | 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK'
  | 'CREATE_USER' | 'UPDATE_USER' | 'DELETE_USER'
  | 'SESSION_REVOKED' | 'PASSWORD_CHANGED' | 'PASSWORD_RESET';

export function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip.trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export function getUa(req: Request): string {
  return (req.headers['user-agent'] ?? 'unknown').slice(0, 300);
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId: string;
    organizationId?: string;
    action: AuditAction;
    entityType?: string;
    entityId?: string;
    details?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          organizationId: params.organizationId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          details: params.details as any,
          ip: params.ip,
          userAgent: params.userAgent,
        },
      });
    } catch (e) {
      // Never crash the main flow because of audit logging
      console.error('[AuditService] log failed', e);
    }
  }

  async getOrgLogs(organizationId: string, limit = 100, offset = 0) {
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where: { organizationId } }),
    ]);
    return { rows, total };
  }

  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
      select: { id: true, createdAt: true, lastActiveAt: true, ip: true, userAgent: true, activeOrganizationId: true },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) return { ok: false };
    await this.prisma.session.delete({ where: { id: sessionId } });
    return { ok: true };
  }

  async revokeAllSessions(userId: string, exceptToken?: string) {
    const where = exceptToken
      ? { userId, token: { not: exceptToken } }
      : { userId };
    await this.prisma.session.deleteMany({ where });
    return { ok: true };
  }
}
