import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

// Hierarchy: SUPER_ADMIN > ADMIN > MANAGER > WORKER
const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  MANAGER: 2,
  WORKER: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    // User passes if their level is >= the minimum required level
    const requiredLevel = Math.min(...roles.map((r) => ROLE_LEVEL[r] ?? 0));
    const userLevel = ROLE_LEVEL[user.role] ?? 0;

    if (userLevel < requiredLevel) throw new ForbiddenException();
    return true;
  }
}
