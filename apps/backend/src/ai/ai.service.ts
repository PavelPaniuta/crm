import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private openai: OpenAI | null = null;

  constructor(private prisma: PrismaService) {
    const key = process.env.OPENAI_API_KEY;
    if (key) {
      this.openai = new OpenAI({
        apiKey: key,
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      });
    }
  }

  isConfigured() {
    return !!this.openai;
  }

  async parseTemplate(sampleRows: string): Promise<{
    name: string;
    hasWorkers: boolean;
    incomeFieldKey: string;
    fields: Array<{ label: string; type: string; required: boolean; options?: string }>;
  }> {
    if (!this.openai) throw new Error('AI not configured');

    const system = `Ты — ассистент CRM-системы. Анализируй строки из таблицы учёта сделок и создавай структуру шаблона сделки.

Правила:
- Определи каждую колонку: название (на русском языке), тип поля
- Типы полей: TEXT, NUMBER, SELECT, DATE, PERCENT, CHECKBOX
- Если в строках видны имена людей с процентами (например "Ди+олх 75/25") — это воркеры, НЕ отдельное поле шаблона
- Дата в начале строки тоже не поле шаблона (она задаётся отдельно в CRM)
- Числовое поле, которое выглядит как сумма денег — отметь как incomeField (база для расчёта выплат)
- incomeFieldKey должен быть slug от label: строчные буквы, подчёркивание вместо пробелов

Ответь ТОЛЬКО валидным JSON (без markdown, без комментариев):
{
  "name": "название шаблона",
  "hasWorkers": true/false,
  "incomeFieldKey": "ключ_поля_дохода или пустая строка",
  "fields": [
    { "label": "Название поля", "type": "TEXT|NUMBER|SELECT|DATE|PERCENT|CHECKBOX", "required": true/false }
  ]
}`;

    const completion = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Строки из таблицы:\n${sampleRows}` },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      throw new Error('AI returned invalid JSON: ' + raw);
    }
  }

  async chat(orgId: string, role: string, question: string, history: { role: 'user' | 'assistant'; content: string }[]) {
    if (!this.openai) throw new Error('AI not configured');

    // Gather context
    const [deals, expenses, users] = await Promise.all([
      this.prisma.deal.findMany({
        where: role === 'SUPER_ADMIN' ? {} : { organizationId: orgId },
        include: {
          amounts: true,
          participants: { include: { user: { select: { id: true, name: true, email: true } } } },
          template: { select: { name: true, incomeFieldKey: true } },
          dataRows: { select: { data: true } },
          organization: { select: { name: true } },
        },
        orderBy: { dealDate: 'desc' },
        take: 200,
      }),
      this.prisma.expense.findMany({
        where: role === 'SUPER_ADMIN' ? {} : { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.user.findMany({
        where: role === 'SUPER_ADMIN' ? {} : { organizationId: orgId },
        select: { id: true, name: true, email: true, role: true, position: true, organizationId: true },
      }),
    ]);

    // Build stats summary
    const totalDeals = deals.length;
    const doneDeals = deals.filter(d => d.status === 'DONE' || d.status === 'CLOSED').length;

    const classicIncome = deals.reduce((s, d) => {
      return s + d.amounts.reduce((as, a) => as + Number(a.amountOut || 0), 0);
    }, 0);

    const templateIncome = deals.reduce((s, d) => {
      if (!d.template?.incomeFieldKey || !d.dataRows.length) return s;
      const key = d.template.incomeFieldKey;
      return s + d.dataRows.reduce((rs, r) => {
        const val = (r.data as Record<string, unknown>)[key];
        return rs + (Number(val) || 0);
      }, 0);
    }, 0);

    const totalIncome = classicIncome + templateIncome;
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    // Worker stats
    const workerMap: Record<string, { name: string; deals: number; payout: number }> = {};
    for (const deal of deals) {
      let incomeForDeal = deal.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
      if (!incomeForDeal && deal.template?.incomeFieldKey && deal.dataRows.length) {
        const key = deal.template.incomeFieldKey;
        incomeForDeal = deal.dataRows.reduce((s, r) => s + (Number((r.data as Record<string, unknown>)[key]) || 0), 0);
      }
      for (const p of deal.participants) {
        const uid = p.user.id;
        if (!workerMap[uid]) workerMap[uid] = { name: p.user.name || p.user.email, deals: 0, payout: 0 };
        workerMap[uid].deals++;
        workerMap[uid].payout += Math.round(incomeForDeal * p.pct / 100 * 100) / 100;
      }
    }
    const topWorkers = Object.values(workerMap).sort((a, b) => b.payout - a.payout).slice(0, 10);

    // Recent deals summary
    const recentSummary = deals.slice(0, 20).map(d => {
      const org = (d as any).organization?.name ?? '';
      const income = d.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0) ||
        (d.template?.incomeFieldKey ? d.dataRows.reduce((s, r) => s + (Number((r.data as Record<string, unknown>)[d.template!.incomeFieldKey!]) || 0), 0) : 0);
      const parts = d.participants.map(p => `${p.user.name || p.user.email} (${p.pct}%)`).join(', ');
      return `${d.dealDate ? new Date(d.dealDate).toLocaleDateString('ru-RU') : '—'} | ${d.status} | ${org} | ${income} | ${parts || 'нет участников'}`;
    }).join('\n');

    const contextMsg = `
Данные CRM (актуальные):

Сводка:
- Всего сделок: ${totalDeals} (закрыто: ${doneDeals})
- Общий доход: ${totalIncome.toFixed(2)}
- Расходы: ${totalExpenses.toFixed(2)}
- Прибыль: ${(totalIncome - totalExpenses).toFixed(2)}
- Сотрудников: ${users.length}

Топ воркеров по выплатам:
${topWorkers.map((w, i) => `${i + 1}. ${w.name} — ${w.deals} сделок, выплачено ${w.payout.toFixed(2)}`).join('\n')}

Последние 20 сделок (дата | статус | офис | сумма | участники):
${recentSummary}
`.trim();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `Ты — умный аналитик CRM-системы. Отвечай кратко и по делу на русском языке. Используй данные из контекста для анализа. Если спрашивают о конкретных сделках или воркерах — ищи в данных. Форматируй ответы красиво: используй числа, проценты, сравнения.`,
      },
      { role: 'user', content: contextMsg },
      { role: 'assistant', content: 'Понял, данные загружены. Готов отвечать на вопросы по аналитике.' },
      ...history.map(h => ({ role: h.role, content: h.content } as OpenAI.Chat.ChatCompletionMessageParam)),
      { role: 'user', content: question },
    ];

    const completion = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.4,
      max_tokens: 1500,
    });

    return completion.choices[0]?.message?.content ?? 'Нет ответа';
  }
}
