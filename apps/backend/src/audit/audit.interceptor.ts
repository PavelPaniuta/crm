import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService, getIp, getUa } from './audit.service';
import { Request } from 'express';

const METHOD_ACTION: Record<string, string> = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  PUT: 'UPDATE',
  DELETE: 'DELETE',
};

// Map URL patterns to entity types
function resolveEntity(path: string): { entityType: string; entityId?: string } | null {
  const segments = path.replace(/^\/api\//, '').split('/');
  const entity = segments[0];
  const id = segments[1];

  const MAP: Record<string, string> = {
    deals: 'deal',
    clients: 'client',
    expenses: 'expense',
    tasks: 'task',
    users: 'user',
    staff: 'user',
    'deal-templates': 'deal_template',
    orgs: 'org',
    memberships: 'membership',
  };

  if (!MAP[entity]) return null;

  return { entityType: MAP[entity], entityId: id && id !== 'comments' ? id : undefined };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: { id: string; activeOrganizationId?: string; organizationId?: string } }
    >();

    const method = req.method?.toUpperCase();
    if (!METHOD_ACTION[method]) return next.handle();
    if (!req.user) return next.handle();

    const resolved = resolveEntity(req.path);
    if (!resolved) return next.handle();

    const baseAction = METHOD_ACTION[method];
    const action = `${baseAction}_${resolved.entityType.toUpperCase()}` as any;

    return next.handle().pipe(
      tap(() => {
        void this.audit.log({
          userId: req.user!.id,
          organizationId: req.user!.activeOrganizationId ?? req.user!.organizationId,
          action,
          entityType: resolved.entityType,
          entityId: resolved.entityId,
          ip: getIp(req),
          userAgent: getUa(req),
        });
      }),
    );
  }
}
