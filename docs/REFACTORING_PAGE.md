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

## Дальше (по одному PR/коммиту)

1. `SalaryConfigModal` + `SalaryPaymentModal` → `components/salary/`
2. `parseClientLeadPaste` + формы клиента → `lib/clients.ts`
3. Вкладка **Expenses** или **Profile** (меньше связей)
4. **Deals** / **Dashboard** (крупные, в конце)
5. Шаблон сделок (wizard) — отдельно, самый большой блок

## VPS

Обычный деплой без миграций, если менялся только фронт:

```bash
cd ~/crm && git pull && docker compose build web && docker compose up -d web nginx
```
