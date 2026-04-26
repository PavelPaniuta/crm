import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService, getIp, getUa } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
    private mail: MailService,
    private audit: AuditService,
  ) {}

  private sendLoginAlert(user: { email: string; name?: string | null }, ip: string, ua: string) {
    const appUrl = process.env.APP_URL || 'https://my-crm.live';
    this.mail.sendLoginAlert(user.email, {
      name: user.name ?? null,
      ip,
      userAgent: ua,
      time: new Date(),
      appUrl,
    }).catch(() => undefined);
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = getIp(req);
    const ua = getUa(req);

    let loginResult: Awaited<ReturnType<AuthService['login']>>;
    try {
      loginResult = await this.auth.login(body.email, body.password, ip, ua);
    } catch (err) {
      // Log failed login attempt (no userId available, use email as detail)
      const user = await this.prisma.user.findFirst({ where: { email: body.email } });
      if (user) {
        void this.audit.log({
          userId: user.id,
          organizationId: user.organizationId,
          action: 'LOGIN_FAILED',
          ip,
          userAgent: ua,
          details: { email: body.email },
        });
      }
      throw err;
    }
    const { token, expiresAt, user } = loginResult;

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

    void this.audit.log({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'LOGIN',
      ip,
      userAgent: ua,
    });

    this.sendLoginAlert(user, ip, ua);

    return { ok: true, user: { id: user.id, email: user.email, role: user.role } };
  }

  @Post('logout')
  async logout(
    @Req() req: Request & { user?: { id: string; activeOrganizationId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'biscrm_sid';
    const token = req.cookies?.[cookieName] as string | undefined;
    if (token) {
      await this.auth.logout(token);
      if (req.user) {
        void this.audit.log({
          userId: req.user.id,
          organizationId: req.user.activeOrganizationId,
          action: 'LOGOUT',
          ip: getIp(req),
          userAgent: getUa(req),
        });
      }
    }
    res.clearCookie(cookieName, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: any) {
    return { user: req.user };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    const email = body.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email обязателен');

    const user = await this.prisma.user.findFirst({ where: { email } });
    // Always return ok to avoid user enumeration
    if (!user) return { ok: true };

    // Invalidate old tokens
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const appUrl = process.env.APP_URL || 'https://my-crm.live';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    if (this.mail.isConfigured()) {
      await this.mail.sendPasswordReset(user.email, resetUrl, appUrl);
    } else {
      // Log the reset URL so admin can share it manually
      console.log(`[RESET] ${user.email} → ${resetUrl}`);
    }

    return { ok: true };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body.token) throw new BadRequestException('Токен обязателен');
    if (!body.password || body.password.length < 6)
      throw new BadRequestException('Пароль должен быть минимум 6 символов');

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: body.token },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      throw new NotFoundException('Ссылка недействительна или истекла');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    return { ok: true };
  }

  @Get('check-reset-token')
  async checkResetToken(@Req() req: Request) {
    const token = req.query.token as string;
    if (!token) throw new BadRequestException('Токен обязателен');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used || record.expiresAt < new Date()) {
      return { valid: false };
    }
    return { valid: true };
  }
}

