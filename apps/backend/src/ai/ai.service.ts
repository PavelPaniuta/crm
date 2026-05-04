import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { ClientOrgSettingsService } from '../clients/client-org-settings.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private openai: OpenAI | null = null;

  constructor(
    private prisma: PrismaService,
    private clientOrgSettings: ClientOrgSettingsService,
  ) {
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
    const doneDeals = deals.filter(d => d.status === 'CLOSED').length;

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

  // ─── AI Agent with Function Calling ───────────────────────────────────────

  async agentChat(
    orgId: string,
    role: string,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ text: string; pendingAction?: Record<string, unknown> }> {
    if (!this.openai) throw new Error('AI не настроен');

    await this.clientOrgSettings.ensureDefaults(orgId);

    // Load context: workers + templates for this org
    const [workers, templates, recentDeals, clientStatuses] = await Promise.all([
      this.prisma.user.findMany({
        where: role === 'SUPER_ADMIN' ? {} : { organizationId: orgId },
        select: { id: true, name: true, email: true, position: true, organizationId: true,
          organization: { select: { name: true } } },
      }),
      this.prisma.dealTemplate.findMany({
        where: role === 'SUPER_ADMIN' ? {} : { organizationId: orgId },
        include: { fields: { orderBy: { order: 'asc' } } },
      }),
      this.prisma.deal.findMany({
        where: role === 'SUPER_ADMIN' ? {} : { organizationId: orgId },
        select: { id: true, title: true, status: true, dealDate: true,
          participants: { select: { pct: true, user: { select: { id: true, name: true, email: true } } } },
          amounts: { select: { amountOut: true, currencyOut: true } },
          template: { select: { name: true } },
        },
        orderBy: { dealDate: 'desc' },
        take: 30,
      }),
      this.prisma.clientStatus.findMany({
        where: { organizationId: orgId },
        orderBy: { sortOrder: 'asc' },
        select: { slug: true, label: true },
      }),
    ]);

    const workersCtx = workers.map(w =>
      `- ${w.name || w.email} | ID: ${w.id}${w.position ? ` | должность: ${w.position}` : ''}${(w as any).organization ? ` | офис: ${(w as any).organization.name}` : ''}`
    ).join('\n');

    const templatesCtx = templates.map(t =>
      `- "${t.name}" | ID: ${t.id} | поля: ${t.fields.map(f => f.label).join(', ')}`
    ).join('\n');

    const dealsCtx = recentDeals.slice(0, 10).map(d => {
      const income = d.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0);
      const parts = d.participants.map(p => `${p.user.name || p.user.email} ${p.pct}%`).join('+');
      return `ID:${d.id.slice(-6)} | ${d.status} | ${income || '—'}${d.amounts[0]?.currencyOut || ''} | ${parts || 'нет'} | ${d.dealDate ? new Date(d.dealDate).toLocaleDateString('ru-RU') : '—'}`;
    }).join('\n');

    const statusesCtx = clientStatuses.map(s => `- slug: "${s.slug}" — ${s.label}`).join('\n');

    const systemPrompt = `Ты — AI ассистент CRM системы. Отвечай на русском языке.

ВОРКЕРЫ (сотрудники):
${workersCtx || 'нет данных'}

ШАБЛОНЫ СДЕЛОК:
${templatesCtx || 'нет шаблонов'}

ПОСЛЕДНИЕ СДЕЛКИ:
${dealsCtx || 'нет сделок'}

СТАТУСЫ КАРТОЧКИ КЛИЕНТА (для поля statusSlug; по умолчанию new — «Новый»):
${statusesCtx || 'нет статусов'}

ПРАВИЛА:
1. При создании сделки — используй точные ID из списка воркеров выше
2. Если имя неоднозначно — уточни у пользователя
3. Перед созданием — покажи summary и используй tool confirm_create_deal
4. Дату "вчера" = ${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}, "сегодня" = ${new Date().toISOString().slice(0, 10)}
5. Если чего-то не знаешь (ID, шаблон) — спроси
6. Для статистики — используй get_stats tool
7. Если пользователь вставил уведомление о новом звонке (Telegram/бот: «Новый звонок», строки с банком, клиентом, телефоном, summary, временем) — извлеки имя клиента, телефон, банк, имя ассистента, краткое содержание звонка, время начала. Обязательные поля для карточки: name (клиент), phone (нормализуй в международный формат с + если возможно). Вызови confirm_create_client. statusSlug обычно "new", если не указано иное.
8. Время начала из текста вида «04.05.2026, 11:31» переводи в callStartedAt как ISO 8601 (например 2026-05-04T11:31:00) в локальной интерпретации как указано в сообщении.`;

    const tools: ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'confirm_create_deal',
          description: 'Подготовить сделку для подтверждения пользователем. Вызывай ТОЛЬКО когда у тебя есть все данные.',
          parameters: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Дата в формате YYYY-MM-DD' },
              templateId: { type: 'string', description: 'ID шаблона или null для классической сделки' },
              participants: {
                type: 'array',
                items: { type: 'object', properties: { userId: { type: 'string' }, pct: { type: 'number' } }, required: ['userId', 'pct'] },
                description: 'Участники с процентами',
              },
              amounts: {
                type: 'array',
                items: { type: 'object', properties: { amountOut: { type: 'number' }, currencyOut: { type: 'string' }, bank: { type: 'string' } } },
                description: 'Суммы для классической сделки',
              },
              dataRows: {
                type: 'array',
                items: { type: 'object' },
                description: 'Данные для шаблонной сделки (массив объектов с ключами из шаблона)',
              },
              title: { type: 'string', description: 'Заголовок/описание сделки' },
              status: { type: 'string', enum: ['NEW', 'IN_PROGRESS', 'CLOSED'], description: 'Статус сделки' },
              comment: { type: 'string', description: 'Комментарий' },
            },
            required: ['date', 'status'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'confirm_create_expense',
          description: 'Подготовить расход для подтверждения пользователем.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Название расхода (аренда, зарплата, оборудование...)' },
              amount: { type: 'number', description: 'Сумма' },
              currency: { type: 'string', description: 'Валюта (USD, EUR, UAH...) — по умолчанию USD' },
              payMethod: { type: 'string', description: 'Способ оплаты (Наличные, Карта, Криптo...) — по умолчанию Наличные' },
            },
            required: ['title', 'amount'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'confirm_create_client',
          description:
            'Подготовить карточку клиента из текста уведомления о звонке или явного запроса пользователя. Вызывай когда есть имя и телефон.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Имя клиента' },
              phone: { type: 'string', description: 'Телефон клиента' },
              bank: { type: 'string', description: 'Банк или null' },
              assistantName: { type: 'string', description: 'Ассистент (кто вёл звонок) или null' },
              callSummary: { type: 'string', description: 'Краткое содержание / summary звонка или null' },
              callStartedAt: {
                type: 'string',
                description: 'Время начала звонка ISO 8601 или null',
              },
              note: { type: 'string', description: 'Доп. заметка или null' },
              statusSlug: {
                type: 'string',
                description: 'Slug статуса из списка СТАТУСЫ КАРТОЧКИ КЛИЕНТА (часто new)',
              },
            },
            required: ['name', 'phone'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_stats',
          description: 'Получить текущую статистику по сделкам и воркерам',
          parameters: {
            type: 'object',
            properties: {
              period: { type: 'string', enum: ['today', 'week', 'month', 'all'], description: 'Период' },
            },
            required: [],
          },
        },
      },
    ];

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content } as ChatCompletionMessageParam)),
      { role: 'user', content: message },
    ];

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.3,
    });

    const msg = response.choices[0].message;

    // Handle tool calls
    if (msg.tool_calls?.length) {
      const call = msg.tool_calls[0] as OpenAI.Chat.ChatCompletionMessageToolCall & { function: { name: string; arguments: string } };
      const args = JSON.parse(call.function.arguments);

      if (call.function.name === 'confirm_create_deal') {
        // Build human-readable preview
        const partsText = (args.participants || []).map((p: any) => {
          const w = workers.find(x => x.id === p.userId);
          return `${w?.name || w?.email || p.userId} (${p.pct}%)`;
        }).join(' + ');
        const amountText = (args.amounts || []).map((a: any) => `${a.amountOut} ${a.currencyOut || 'USD'}`).join(', ');
        const tpl = args.templateId ? templates.find(t => t.id === args.templateId) : null;

        const preview = [
          `📅 Дата: ${args.date}`,
          tpl ? `📋 Шаблон: ${tpl.name}` : '',
          partsText ? `👥 Участники: ${partsText}` : '',
          amountText ? `💰 Сумма: ${amountText}` : '',
          args.title ? `📝 ${args.title}` : '',
          `✅ Статус: ${{ NEW: 'Новая', IN_PROGRESS: 'В работе', CLOSED: 'Закрыта' }[args.status as string] || args.status}`,
          args.comment ? `💬 ${args.comment}` : '',
        ].filter(Boolean).join('\n');

        return {
          text: `Создаю сделку:\n\n${preview}\n\nПодтвердить?`,
          pendingAction: { type: 'create_deal', params: args, workersMap: Object.fromEntries(workers.map(w => [w.id, w.name || w.email])) },
        };
      }

      if (call.function.name === 'confirm_create_expense') {
        return {
          text: `Записываю расход:\n\n💸 ${args.title}\n💰 ${args.amount} ${args.currency || 'USD'}\n💳 ${args.payMethod || 'Наличные'}\n\nПодтвердить?`,
          pendingAction: { type: 'create_expense', params: args },
        };
      }

      if (call.function.name === 'confirm_create_client') {
        const sum = args.callSummary ? String(args.callSummary) : '';
        const sumShort = sum.length > 400 ? `${sum.slice(0, 400)}…` : sum;
        const preview = [
          `👤 ${args.name || '—'}`,
          `☎️ ${args.phone || '—'}`,
          args.bank ? `🏦 ${args.bank}` : '',
          args.assistantName ? `Ассистент: ${args.assistantName}` : '',
          sumShort ? `📝 ${sumShort}` : '',
          args.callStartedAt ? `⏰ ${args.callStartedAt}` : '',
          args.statusSlug ? `Статус: ${args.statusSlug}` : '',
        ].filter(Boolean).join('\n');
        return {
          text: `Создаю карточку клиента:\n\n${preview}\n\nПодтвердить?`,
          pendingAction: { type: 'create_client', params: args },
        };
      }

      if (call.function.name === 'get_stats') {
        const stats = await this.getStatsForAgent(orgId, role, args.period || 'all');
        // Continue conversation with stats
        const followUp = await this.openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            ...messages,
            { role: 'assistant', content: null, tool_calls: msg.tool_calls } as ChatCompletionMessageParam,
            { role: 'tool', tool_call_id: call.id, content: JSON.stringify(stats) } as ChatCompletionMessageParam,
          ],
          temperature: 0.3,
        });
        return { text: followUp.choices[0].message.content ?? 'Нет ответа' };
      }
    }

    return { text: msg.content ?? 'Нет ответа' };
  }

  private async getStatsForAgent(orgId: string, role: string, period: string) {
    const now = new Date();
    let fromDate: Date | undefined;
    if (period === 'today') fromDate = new Date(now.toISOString().slice(0, 10));
    else if (period === 'week') { fromDate = new Date(now); fromDate.setDate(now.getDate() - 7); }
    else if (period === 'month') { fromDate = new Date(now); fromDate.setMonth(now.getMonth() - 1); }

    const where: any = role === 'SUPER_ADMIN' ? {} : { organizationId: orgId };
    if (fromDate) where.dealDate = { gte: fromDate };

    const [deals, expenses] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        include: { amounts: true, participants: { include: { user: { select: { name: true, email: true } } } }, template: { select: { incomeFieldKey: true } }, dataRows: { select: { data: true } } },
      }),
      this.prisma.expense.findMany({ where: role === 'SUPER_ADMIN' ? (fromDate ? { createdAt: { gte: fromDate } } : {}) : (fromDate ? { organizationId: orgId, createdAt: { gte: fromDate } } : { organizationId: orgId }) }),
    ]);

    const income = deals.reduce((s, d) => {
      const classic = d.amounts.reduce((a, x) => a + Number(x.amountOut || 0), 0);
      const tpl = d.template?.incomeFieldKey ? d.dataRows.reduce((a, r) => a + (Number((r.data as Record<string,unknown>)[d.template!.incomeFieldKey!]) || 0), 0) : 0;
      return s + classic + tpl;
    }, 0);

    const expTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    const wMap: Record<string, { name: string; deals: number; payout: number }> = {};
    for (const d of deals) {
      const base = d.amounts.reduce((s, a) => s + Number(a.amountOut || 0), 0) ||
        (d.template?.incomeFieldKey ? d.dataRows.reduce((s, r) => s + (Number((r.data as Record<string,unknown>)[d.template!.incomeFieldKey!]) || 0), 0) : 0);
      for (const p of d.participants) {
        const uid = p.user.name || p.user.email;
        if (!wMap[uid]) wMap[uid] = { name: uid, deals: 0, payout: 0 };
        wMap[uid].deals++;
        wMap[uid].payout += Math.round(base * p.pct / 100 * 100) / 100;
      }
    }

    return {
      period,
      totalDeals: deals.length,
      closedDeals: deals.filter(d => d.status === 'CLOSED').length,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expTotal * 100) / 100,
      profit: Math.round((income - expTotal) * 100) / 100,
      workers: Object.values(wMap).sort((a, b) => b.payout - a.payout),
    };
  }
}
