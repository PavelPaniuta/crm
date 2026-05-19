# Постепенный рефакторинг `page.tsx`

Цель: вынести UI в модули без изменения поведения. После каждого этапа — `npm run build` (web) и `npm test` (backend).

## Сделано

| Этап | Файлы |
|------|--------|
| Расчёты сделок | `apps/web/src/lib/deal-payout.ts` |
| Посредники | `components/mediators/MediatorsTab.tsx`, `MediatorFormModal.tsx` |
| Валюты | `lib/currencies.ts` |
| Сотрудники (таблица) | `components/staff/StaffTable.tsx` |
| Курсы (модалка) | `components/modals/ExchangeRatesModal.tsx` |
| Тесты payout | `apps/backend/src/deals/deal-payout.util.spec.ts` |
| Зарплата (модалки) | `components/salary/SalaryConfigModal.tsx`, `SalaryPaymentModal.tsx`, `lib/salary-constants.ts` |
| Клиенты (утилиты форм) | `lib/clients.ts` |
| Расходы (модалка) | `components/expenses/ExpenseDetailModal.tsx` |
| Отчёты (вкладка) | `components/reports/ReportsTab.tsx`, `lib/reports.ts` |
| Excel «Учет сделок» | `apps/backend/src/reports/accounting-export.service.ts` |
| Клиенты (канбан) | `components/clients/ClientsKanbanBoard.tsx`, `buildClientKanbanColumns` в `lib/clients.ts` |

## Дальше (по одному PR/коммиту)

1. Вкладка **Clients** — модалки создания/просмотра/редактирования
2. **Импорт** Excel «Учет сделок» (зеркало экспорта)
3. Сущность **ОЛХ** (как посредники) + **Инфо** (% от ЗП фонда)
4. **Deals** / **Dashboard** (крупные, в конце)
5. Шаблон сделок (wizard) — отдельно, самый большой блок

## VPS

Обычный деплой без миграций, если менялся только фронт:

```bash
cd ~/crm && git pull && docker compose build web && docker compose up -d web nginx
```
