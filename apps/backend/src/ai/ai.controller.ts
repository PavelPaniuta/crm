import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private ai: AiService) {}

  @Get('status')
  status() {
    return { configured: this.ai.isConfigured() };
  }

  @Post('parse-template')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async parseTemplate(@Body() body: { sampleRows: string }) {
    if (!this.ai.isConfigured()) {
      return { error: 'AI не настроен. Добавьте OPENAI_API_KEY в переменные окружения.' };
    }
    try {
      return await this.ai.parseTemplate(body.sampleRows);
    } catch (e: any) {
      return { error: e.message ?? 'Ошибка AI' };
    }
  }

  @Post('chat')
  async chat(@Req() req: any, @Body() body: { question: string; history?: { role: 'user' | 'assistant'; content: string }[] }) {
    if (!this.ai.isConfigured()) {
      return { answer: 'AI не настроен. Добавьте OPENAI_API_KEY в переменные окружения.' };
    }
    try {
      const answer = await this.ai.chat(
        req.user.activeOrganizationId,
        req.user.role,
        body.question,
        body.history ?? [],
      );
      return { answer };
    } catch (e: any) {
      return { answer: `Ошибка: ${e.message ?? 'неизвестная ошибка'}` };
    }
  }

  @Post('agent')
  async agent(@Req() req: any, @Body() body: { message: string; history?: { role: 'user' | 'assistant'; content: string }[] }) {
    if (!this.ai.isConfigured()) {
      return { text: 'AI не настроен. Добавьте OPENAI_API_KEY в переменные окружения.' };
    }
    try {
      return await this.ai.agentChat(
        req.user.activeOrganizationId,
        req.user.role,
        body.message,
        body.history ?? [],
      );
    } catch (e: any) {
      return { text: `Ошибка: ${e.message ?? 'неизвестная ошибка'}` };
    }
  }
}
