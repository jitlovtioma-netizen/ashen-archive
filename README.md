# Архив Пепельной Длани

Сайт-архив лора настольной кампании: герои, фракции, боги, второстепенные
персонажи, локации и запечатанные секреты, плюс загадки, осколки памяти,
достижения и «Мастерская Созидателя» для правки архива без кода.

Два мира, у каждого своя подача:

| Мир | Система | Подача |
|---|---|---|
| **Элария** | D&D 5e | «Хроника Созидателя»: книга, фиолет и золото, рассказ от автора мира, генеративная фэнтези-музыка |
| **Голарион** | Pathfinder 2e | CRT-терминал: фосфор, сканлайны, гул |

Мир определяется аккаунтом стража (админ может переключаться клавишей `W`).

## Стек

Next.js 16 (App Router) · React 19 · Tailwind 4 · Prisma 6 · Supabase
(PostgreSQL + Storage) · Vercel · bun.

## Быстрый старт (локально)

```bash
bun install
cp .env.example .env      # и впиши DATABASE_URL
bun run dev               # http://localhost:3000
```

`DATABASE_URL` может указывать на Supabase (`postgresql://…`) или на
локальную SQLite (`file:…`). Провайдер Prisma подстраивается сам
(`scripts/sync-db-provider.mjs` запускается из install/dev/build).

> ⚠ Если в `.env` боевая база Supabase, локальный сайт работает с живыми
> данными игроков.

## Деплой (git → Vercel, база в Supabase)

Пуш в `main` → Vercel собирает и выкатывает сайт.

Переменные окружения в Vercel:

| Переменная | Зачем |
|---|---|
| `DATABASE_URL` | Supabase pooler (порт 6543, `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | прямое соединение (порт 5432) — для `db:push` и сида |
| `SESSION_SECRET` | секрет подписи сессий (длинная случайная строка) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | картинки в Supabase Storage (загрузка из Мастерской) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *необязательно*: онлайн через Supabase Realtime вместо опроса сервера |
| `NEXT_PUBLIC_PRESENCE_URL` | *необязательно*: socket.io-сервис (`mini-services/presence-service`) — даёт вещание и изгнание |

Если схема БД менялась: `bun run db:push` (с `DIRECT_URL` в `.env`).
Новые записи из сида: `bun run db:seed` (merge: правки из Мастерской не трогает).

## Команды

| Команда | Что делает |
|---|---|
| `bun run dev` | локальный сервер |
| `bun run build` | сборка (с проверкой TypeScript) |
| `bun run lint` | ESLint |
| `bun run db:push` | применить схему к БД |
| `bun run db:seed` | залить/обновить записи архива (merge) |
| `bun run set-password <login> <пароль>` | сменить пароль стража |
| `bun run upload-images` | залить `public/` картинки в Supabase Storage |
| `bun scripts/data-fixes.ts` | разовые правки данных v5.8 (Кали, Тей-Мегьдос) |

## Безопасность

- Вход — по паролю; сервер выдаёт подписанную httpOnly-cookie. Права
  (админ / владелец досье) проверяются только по ней.
- Пароли хранятся хешами (scrypt). Старые открытые пароли перехешируются
  при первом входе.
- Пароли в коде не хранятся: новые аккаунты из сида получают случайный
  пароль (печатается в консоль) или `SEED_PW_<login>` из окружения.

## Устройство проекта

```
src/app/                 страница, API-маршруты, стили
  globals.css            CRT-тема (PF2e) и общие стили
  world-dnd.css          тема «Хроника Эларии» (D&D)
src/lib/
  auth.ts                сессии и хеши паролей
  world.ts               миры и тексты Созидателя (главы, вступление)
  audio.ts               синтез звука: гул CRT / музыка Хроники
  presence.ts            онлайн-стражи (опрос / Realtime / socket.io)
  store.ts               состояние клиента (zustand)
src/components/crt/      интерфейс архива
  admin/                 части Мастерской Созидателя
  profile/               части профиля
  record/                части окна досье
prisma/
  schema.prisma          модели БД
  seed.ts                наполнение архива (merge)
scripts/                 служебные скрипты
```

Горячие клавиши: `1–7` — разделы, `0` — Мастерская (админы),
`Ctrl+K` — поиск, `?` — справка, `W` — смена мира (админы),
`G` — сброс Взгляда.

История изменений — [CHANGELOG.md](CHANGELOG.md).
