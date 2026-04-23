import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request & { user?: any }, _res: Response, next: NextFunction) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'biscrm_sid';
    const token = (req.cookies?.[cookieName] as string | undefined) ?? undefined;
    if (!token) return next();

    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session) return next();
    if (session.expiresAt.getTime() <= Date.now()) return next();

    const activeOrgId =
      session.activeOrganizationId ?? session.user.organizationId;

    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      organizationId: session.user.organizationId,
      activeOrganizationId: activeOrgId,
    };

    return next();
  }
}

