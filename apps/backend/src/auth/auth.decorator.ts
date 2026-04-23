import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | null => {
    const req = ctx.switchToHttp().getRequest();
    return req.user ?? null;
  },
);

