import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT ?? '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP not configured — password reset emails will not be sent');
    }
  }

  isConfigured() {
    return !!this.transporter;
  }

  async sendPasswordReset(to: string, resetUrl: string, appUrl: string) {
    if (!this.transporter) {
      this.logger.warn(`[MOCK] Reset email to ${to}: ${resetUrl}`);
      return;
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await this.transporter.sendMail({
      from: `MyCRM <${from}>`,
      to,
      subject: 'Восстановление пароля — MyCRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #6366f1; margin-bottom: 8px;">MyCRM</h2>
          <h3 style="margin-top: 0;">Восстановление пароля</h3>
          <p>Вы запросили сброс пароля для вашего аккаунта.</p>
          <p>Нажмите на кнопку ниже чтобы задать новый пароль:</p>
          <a href="${resetUrl}" 
             style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
            Сменить пароль
          </a>
          <p style="color:#888;font-size:13px;">Ссылка действительна 30 минут.<br>
          Если вы не запрашивали сброс пароля — проигнорируйте это письмо.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#bbb;font-size:12px;">${appUrl}</p>
        </div>
      `,
    });
  }
}
