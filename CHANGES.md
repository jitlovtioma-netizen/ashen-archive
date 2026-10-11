# Что изменилось (v4.3.2 — фикс HTTP 500 на проде)

## Изменённые файлы:
1. scripts/sync-db-provider.mjs — НОВЫЙ: авто-синхронизация провайдера Prisma.
2. scripts/set-db-provider.ts — удалён (заменён авто-синком).
3. package.json — sync встроен в postinstall / dev / build / build:standalone.
4. prisma/schema.prisma (+ presence-service) — postgres-first в git, авто-комментарий.
5. .env.example — НОВЫЙ: все варианты настроек + объяснение авто-синка.
6. README_VERCEL.md, README_DEPLOY.md, README_FIRST.txt — обновлены под авто-синк.
7. mini-services/presence-service/devkeeper.ts — НОВЫЙ: сторож dev-сервера
   (активен только в песочнице z.ai; на твоём сервере молча не работает).

## Что нового:

### ⚗ Авто-синхронизация провайдера БД (главное)
Скрипт читает DATABASE_URL и сам ставит правильный provider в схему Prisma:
- postgresql://… (Supabase) → provider = "postgresql"
- file:… (SQLite) → provider = "sqlite"
Запускается автоматически при bun install (postinstall), bun run dev и build.
Если задан DIRECT_URL — добавляет directUrl в схему (нужен для prisma db push
и сида мимо pooler'а); не задан — убирает.
Причина инцидента (schema=sqlite + postgres-ссылка → HTTP 500 на всех
разделах) теперь невозможна в принципе.

### Проверено на живой базе
Конфигурация «postgresql + DIRECT_URL + pooler 6543» (как в твоём .env)
проверена чтением напрямую из твоей Supabase: 10 стражей, 41 персонаж,
77 записей лора, 14 фракций, 13 локаций, 6 хроник — все данные на месте.

## Как применить (1 минута)
1. Залей файлы из архива в репозиторий (поверх старых).
2. git push → Vercel пересоберёт сам: при деплое провайдер подстроится
   под DATABASE_URL автоматически.
3. Если сайт на своём сервере: перезапусти (bun install && bun run build
   && перезапуск) — тоже подстроится сам.
4. Проверь: https://твой-сайт/api/stats?system=DND — должны прийти цифры
   (totalRecords и т.д.), а не ошибка.
