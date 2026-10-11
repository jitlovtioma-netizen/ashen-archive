# Деплой «Архива Пепельной Длани» на свой сервер

Инструкция для пакета `seed.zip` (все файлы проекта, кроме `public/`).

> ⚠ Для хостинга на связке **Git + Supabase + Vercel** используй отдельный
> гайд: [README_VERCEL.md](README_VERCEL.md) — там база переключается на
> PostgreSQL, а presence работает опционально.

---

## Что внутри пакета

```
ashen-archive/
├── src/                  ← код сайта (Next.js 16, App Router)
├── prisma/               ← схема БД + seed.ts + утилиты
│   ├── schema.prisma     ← модели: User, Faction, Character, Lore,
│   │                        Location, Chronicle, Achievement, Progress
│   ├── seed.ts           ← полный сид (10 стражей, 41 герой, 77 лора...)
│   ├── bind-characters.ts← привязка персонажей к аккаунтам (идемпотентен)
│   └── backfill-lastseen.ts
├── db/custom.db          ← ГОТОВАЯ SQLite-база со всеми данными и прогрессом
├── mini-services/presence-service/ ← сервис онлайна (socket.io, порт 3003)
├── scripts/              ← sync-db-provider.mjs (авто-провайдер БД),
│                          upload-images.ts (картинки в Supabase, опционально)
├── package.json, bun.lock, конфиги (tailwind, eslint, tsconfig...)
└── README_DEPLOY.md      ← этот файл
```

**Важно:** папки `public/` в пакете НЕТ — картинки и видео положи сам
(герои → `public/heroes/`, боги → `public/gods/`, видео → `public/videos/`).

**Провайдер БД выставляется автоматически** (v4.3.2+): скрипт
`scripts/sync-db-provider.mjs` запускается из `postinstall` / `dev` / `build`,
читает `DATABASE_URL` из `.env` и сам ставит правильный `provider` в
`prisma/schema.prisma` (`postgresql://…` → postgresql, `file:…` → sqlite).
Какой провайдер лежит в git — не важно: при первой же установке/запуске
он подстроится под твою ссылку. Для своего сервера с SQLite достаточно
указать в `.env` файловую ссылку (шаг 3 быстрого старта).

---

## Требования

- **Bun** (рекомендуется): https://bun.sh — `curl -fsSL https://bun.sh/install | bash`
- либо Node.js 20+ (команды: `npm install` / `npm run dev`)

---

## Быстрый старт (5 минут)

```bash
# 1. Распакуй архив и перейди в папку
unzip seed.zip -d ashen-archive && cd ashen-archive

# 2. Установи зависимости
bun install

cd mini-services/presence-service && bun install && cd ../..

# 3. Настрой .env в корне (абсолютный путь к базе на ТВОЁМ сервере!)
#    Провайдер Prisma подстроится под эту ссылку автоматически
#    при bun run dev / bun install (scripts/sync-db-provider.mjs).
echo 'DATABASE_URL=file:/abs/path/to/ashen-archive/db/custom.db' > .env

# 4. Запусти сайт (порт 3000)
#    (схема и Prisma-клиент синхронизируются с .env сами)
bun run dev

# 5. Запусти сервис онлайна (порт 3003) — в отдельном терминале
cd mini-services/presence-service
PRESENCE_DB_URL=file:/abs/path/to/ashen-archive/db/custom.db bun run dev
```

Готово: сайт на `http://localhost:3000`.

> База `db/custom.db` уже засеяна и содержит все аккаунты, записи и прогресс.
> `bun run db:push` / `bun run db:seed` нужны ТОЛЬКО если хочешь начать с чистого листа
> (seed пересоздаст данные; привязки персонажей применит `bun run prisma/bind-characters.ts`).

---

## Сервис онлайна (обязателен для профиля и вещания)

`presence-service` — отдельный процесс на порту **3003**: кто онлайн,
«был в сети», админ-вещание на весь экран, изгнание стража.

Сайт подключается к сокету по адресу из `NEXT_PUBLIC_PRESENCE_URL`.
⚠ Если переменная **не задана — presence выключен** (сокет не открывается,
счётчик «в сети» скрыт, статус-бар показывает «ОФЛАЙН»). Это безопасный
дефолт для деплоя на Vercel, где сервис онлайна жить не может.
На своём сервере задай её явно:

### Вариант А — Caddy (проще всего)

`Caddyfile`:
```
example.com {
    handle /socket.io/* {
        reverse_proxy localhost:3003
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

`.env` в корне сайта:
```
DATABASE_URL=file:/abs/path/to/db/custom.db
NEXT_PUBLIC_PRESENCE_URL=/
```

`.env` рядом с presence-service (`mini-services/presence-service/.env`):
```
PRESENCE_DB_URL=file:/abs/path/to/db/custom.db
PRESENCE_SOCKET_PATH=/socket.io
```

### Вариант Б — nginx

```nginx
server {
    server_name example.com;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```
Переменные окружения — как в варианте А.

> Если на своём сервере не задать `NEXT_PUBLIC_PRESENCE_URL`, presence будет
> выключен — сайт работает, но без «кто в сети»/вещания/изгнания.

---

## Продакшен-режим (вместо dev)

```bash
bun run build:standalone && bun run start   # сайт, порт 3000 (standalone-сборка)
# либо проще:
bun run build && bun run start:next           # обычный next start

cd mini-services/presence-service && bun index.ts   # сервис онлайна
```

> `bun run build` (plain `next build`) совместим с Vercel; копирование
> standalone-файлов вынесено в отдельный скрипт `build:standalone`.

`NEXT_PUBLIC_PRESENCE_URL` читается при сборке — при её смене нужен
пересборка (`bun run build`).

---

## Аккаунты (из сида)

| Логин | Пароль | Мир | Роль |
|---|---|---|---|
| dnd | ashen | Элария (D&D 5e) | **АДМИН** |
| pf2e | ashen | Голарион (PF2e) | **АДМИН** |
| GTT_EDMI | EldMaster | Голарион | страж |
| sashakarev1809, IlyaKazakhStrong, NiT, ps1x0k1d | ashen | Элария | стражи |
| xlov21, EvaMoon, Mira | ashen | Голарион | стражи |

Горячие клавиши: `1–7` — секции, `Ctrl+K` — командная палитра, `?` — справка,
`W` — смена мира **(только админам: dnd / pf2e)**, `G` — сброс Взгляда.
Konami-код (↑↑↓↓←→←→BA) — сам найди, что он делает.

---

## Частые вопросы

**Изображения не грузятся?** — Проверь, что `public/heroes/…`, `public/gods/…`
на месте; у портретов есть fallback-глиф, но лучше положить оригиналы.

**«СТРАЖЕЙ В СЕТИ: 0» при работающем сервисе?** — Сокет не пробрасывается:
проверь прокси на `/socket.io/*` и переменные из вариантов А/Б.

**Как дать игрокам новые пароли?** — Пока только через правку БД
(пароли в seed хранятся открытым текстом — sandbox-уровень безопасности).
