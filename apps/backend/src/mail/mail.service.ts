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

  async sendTaskAssigned(
    to: string,
    p: { taskTitle: string; description: string | null; dueAt: Date | null; assignerName: string; appUrl: string },
  ) {
    if (!this.resend) {
      this.logger.warn(`[MOCK] task assigned to ${to}: ${p.taskTitle}`);
      return;
    }
    const desc = p.description ? `<p style="color:#6b7280;">${p.description.replace(/</g, '&lt;')}</p>` : '';
    const due = p.dueAt
      ? `<p><strong>Срок:</strong> ${p.dueAt.toLocaleString('ru-RU')}</p>`
      : '';
    const { error } = await this.resend.emails.send({
      from: `MyCRM <${this.from}>`,
      to,
      subject: `Новая задача: ${p.taskTitle} — MyCRM`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #6366f1; margin-bottom: 8px;">MyCRM</h2>
          <h3 style="margin-top: 0;">Вам назначена задача</h3>
          <p><strong>Название:</strong> ${p.taskTitle.replace(/</g, '&lt;')}</p>
          ${desc}
          ${due}
          <p style="color: #6b7280; font-size: 13px;">Назначил: ${p.assignerName.replace(/</g, '&lt;')}</p>
          <a href="${p.appUrl}/app" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">Открыть MyCRM</a>
        </div>
      `,
    });
    if (error) {
      this.logger.error(`Task assigned email: ${JSON.stringify(error)}`);
      throw new Error(`Email send failed: ${error.message}`);
    }
  }

  async sendTaskCompleted(
    to: string,
    p: { taskTitle: string; assigneeName: string; appUrl: string },
  ) {
    if (!this.resend) {
      this.logger.warn(`[MOCK] task done notify ${to}: ${p.taskTitle}`);
      return;
    }
    const { error } = await this.resend.emails.send({
      from: `MyCRM <${this.from}>`,
      to,
      subject: `Задача выполнена: ${p.taskTitle} — MyCRM`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #6366f1; margin-bottom: 8px;">MyCRM</h2>
          <h3 style="margin-top: 0;">Задача отмечена как выполненная</h3>
          <p><strong>${p.taskTitle.replace(/</g, '&lt;')}</strong></p>
          <p>Исполнитель: ${p.assigneeName.replace(/</g, '&lt;')}</p>
          <a href="${p.appUrl}/app" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">Открыть MyCRM</a>
        </div>
      `,
    });
    if (error) {
      this.logger.error(`Task completed email: ${JSON.stringify(error)}`);
      throw new Error(`Email send failed: ${error.message}`);
    }
  }
}
