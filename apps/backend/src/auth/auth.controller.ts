import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, expiresAt, user } = await this.auth.login(
      body.email,
      body.password,
    );

    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'biscrm_sid';
    const secure = (process.env.COOKIE_SECURE ?? 'false') === 'true';
    const domain = process.env.COOKIE_DOMAIN || undefined;

    res.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      domain,
      expires: expiresAt,
      path: '/',
    });

    return { ok: true, user: { id: user.id, email: user.email, role: user.role } };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'biscrm_sid';
    const token = req.cookies?.[cookieName] as string | undefined;
    if (token) await this.auth.logout(token);
    res.clearCookie(cookieName, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: any) {
    return { user: req.user };
  }
}

