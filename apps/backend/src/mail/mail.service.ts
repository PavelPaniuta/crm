import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.from = process.env.RESEND_FROM || 'onboarding@resend.dev';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set — password reset emails will not be sent');
    }
  }

  isConfigured() {
    return !!this.resend;
  }

  async sendPasswordReset(to: string, resetUrl: string, appUrl: string) {
    if (!this.resend) {
      this.logger.warn(`[MOCK] Reset email to ${to}: ${resetUrl}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: `MyCRM <${this.from}>`,
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

    if (error) {
      this.logger.error(`Failed to send reset email: ${JSON.stringify(error)}`);
      throw new Error(`Email send failed: ${error.message}`);
    }
  }
}
