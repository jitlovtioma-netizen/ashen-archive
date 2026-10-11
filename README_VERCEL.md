# Деплой «Архива Пепельной Длани» на Git + Supabase + Vercel

Этот гайд — как поднять сайт на связке **GitHub (Git) + Supabase (база) + Vercel (хостинг)**,
и что для этого уже подготовлено в коде.

> Для самостоятельного хостинга (VPS + SQLite) есть отдельный [README_DEPLOY.md](README_DEPLOY.md).

---

## 🚨 Быстрый фикс: «Не удалось получить данные http 500» на всех разделах

**Симптом:** сайт открывается, интерфейс живёт, но герои/лор/профиль пустые,
везде ошибка HTTP 500. Часто появляется после загрузки в git файлов из
старого seed.zip (до v4.3.2).

**Причина №1 (99% случаев): в `prisma/schema.prisma` стоял `provider = "sqlite"`
при postgres-ссылке в `DATABASE_URL`.** На Vercel база — Supabase PostgreSQL;
Prisma-клиент, собранный под SQLite, не может открыть postgres-ссылку → каждый
запрос в БД падает.

**Начиная с v4.3.2 это невозможно в принципе:** скрипт
`scripts/sync-db-provider.mjs` читает `DATABASE_URL` и сам ставит правильный
provider. Он запускается автоматически из `postinstall`, `dev` и `build` —
на Vercel при деплое, на своём сервере при `bun install` / `bun run dev`.
Если задан `DIRECT_URL`, в схему добавляется `directUrl` (нужен для
`prisma db push` / сида мимо pooler'а); не задан — строка убирается.

**Что сделать на старой версии (фикс за 1 минуту, прямо на GitHub):**
1. Обнови файлы до v4.3.2+ (залей свежий seed.zip в репозиторий) — и всё,
   дальше провайдер подстраивается сам.
2. Либо вручную: `prisma/schema.prisma` → Edit →
   ```diff
   - provider = "sqlite"
   + provider = "postgresql"
   ```
   → Commit → Vercel пересоберёт сам.

**Причина №2: не задана/неверна `DATABASE_URL`.**
Vercel → Settings → Environment Variables:
`DATABASE_URL` = Supabase **transaction pooler** (порт 6543) с параметрами
`?pgbouncer=true&connection_limit=1`. После смены — Redeploy.

**Причина №3: в Supabase нет таблиц** (новый проект).
Локально: в `.env` — direct-ссылка (5432), затем
`bunx prisma db push && bun run db:seed && bun run prisma/bind-characters.ts`
(подробно — шаг 2 ниже).

---

## Итог аудита совместимости (что уже готово, а что нельзя)

| Часть | Vercel + Supabase | Комментарий |
|---|---|---|
| Next.js 16 (страницы, API-роуты) | ✅ работает | API-роуты не пишут на диск — serverless-совместимы |
| База: Prisma + SQLite | ❌ → ✅ заменено | У Vercel ФС read-only, SQLite не выживает. Провайдер подстраивается автоматически: `sync-db-provider.mjs` в postinstall/dev/build ставит `postgresql` для postgres-ссылок |
| Картинки из `public/` | ✅ работает | Vercel раздаёт `public/` статику как есть. Supabase Storage — опция |
| Прогресс стражей (achievements, загадки…) | ✅ работает | Хранится в БД (модель Progress), никуда не денется |
| Авторизация, админ-права (dnd / pf2e) | ✅ работает | Всё через БД |
| Хоткей `W` (смена мира) | ✅ только админам | Игроки Эларии не видят Голарион и наоборот |
| **presence-сервис (socket.io, порт 3003)** | ⚠️ **не работает на Vercel** | Это отдельный долгоживущий процесс — serverless его не умеет. Сайт **работает без него** (онлайн/вещание/изгнание отключаются). Хочешь онлайн — хости сервис отдельно (Railway/Render/Fly, см. ниже) |
| `seed.zip` в public | ⚠️ не заливать | Внутри пароли аккаунтов. В git он не входит (.gitignore) |

---

## Шаг 0. Что нужно

- Аккаунт **GitHub** (репозиторий с кодом архива)
- Аккаунт **Supabase** (бесплатного тарифа хватит)
- Аккаунт **Vercel** (бесплатного Hobby-тарифа хватит)
- Локально: **Bun** (`curl -fsSL https://bun.sh/install | bash`) — для одноразового
  залива данных в Supabase

---

## Шаг 1. Создай проект Supabase

1. [supabase.com](https://supabase.com) → **New project**.
2. Придумай пароль БД (database password) — сохрани его.
3. Регион выбери ближе к игрокам (например, Frankfurt).
4. Когда проект создастся, открой **Project Settings → Database**. Оттуда нужны
   две строки подключения (кнопка **Connection string**):

**Direct connection** (порт 5432) — для залива таблиц и данных с твоей машины:
```
postgresql://postgres:ПАРОЛЬ@db.ПРОЕКТ_REF.supabase.co:5432/postgres
```

**Transaction pooler** (порт 6543) — для рантайма на Vercel:
```
postgresql://postgres.ПРОЕКТ_REF:ПАРОЛЬ@aws-0-РЕГИОН.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```
> Параметр `?pgbouncer=true&connection_limit=1` обязателен: serverless-функции
> Vercel открывают много коротких соединений, без пулера упрёшься в лимит Supabase.

---

## Шаг 2. Залей базу архива в Supabase (один раз, с твоей машины)

В папке проекта локально:

```bash
# 1. Установи зависимости
bun install

# 2. Убедись, что Prisma настроен на PostgreSQL.
#    В свежем seed.zip схема УЖЕ postgresql — команда ниже только для
#    старых версий архива (когда в схеме было sqlite):
bun run db:use-postgres   # или проверь: grep provider prisma/schema.prisma

# 3. В .env поставь DIRECT-ссылку (порт 5432) из Шага 1
#    DATABASE_URL=postgresql://postgres:ПАРОЛЬ@db.ПРОЕКТ_REF.supabase.co:5432/postgres

# 4. Создай таблицы в Supabase
bunx prisma db push

# 5. Залей данные архива: аккаунты, героев, лор, богов, локации, хроники
bun run db:seed

# 6. Примени привязки персонажей к аккаунтам
bun run prisma/bind-characters.ts

# 7. Пересобери Prisma-клиент под postgres
bunx prisma generate
```

Проверка: в Supabase → **Table Editor** должны появиться таблицы `User`,
`Character`, `Lore`, `Progress`… с данными.

---

## Шаг 3. Залей код в Git

```bash
git add prisma/schema.prisma
git commit -m "postgres provider для Supabase/Vercel"
git push
```

Важно:
- **`schema.prisma` с `provider = "postgresql"` должен быть в git** — по нему
  Vercel сгенерирует правильный клиент при сборке (`postinstall: prisma generate`
  уже прописан в package.json).
- `.env` в git не входит (.gitignore) — пароли не утекут.
- Вернуться на локальную SQLite можно в любой момент: `bun run db:use-sqlite`.

---

## Шаг 4. Подключи Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → импортируй свой
   Git-репозиторий.
2. Framework Preset определится как **Next.js**. Настройки сборки можно не
   трогать (`postinstall` сам синхронизирует prisma-провайдера и соберёт
   клиент). Для гарантии (v4.3.6+) поставь в **Settings → General →
   Build Command**: `bun run build` — тогда перед `next build` всегда
   прогоняются проверка зависимостей и авто-синк провайдера из
   package.json, независимо от того, выполнился ли postinstall.
3. **Environment Variables** добавь:

   | Имя | Значение |
   |---|---|
   | `DATABASE_URL` | **Transaction pooler**-ссылка (порт 6543, с `?pgbouncer=true&connection_limit=1`) из Шага 1 |

4. Жми **Deploy**. Через пару минут сайт живой на `твой-проект.vercel.app`.

Проверка: открой сайт, войти как `dnd` / `ashen` — должны подгрузиться герои,
лор и профиль. Если 500 — почти всегда неверный `DATABASE_URL` (взят порт 5432
вместо 6543 или забыт `pgbouncer=true`).

---

## Шаг 5. Картинки

**Вариант 1 (простой): лежат в репозитории.** Папка `public/heroes`, `public/gods`,
`public/videos` коммитится в git и раздаётся Vercel'ом как статика. Ничего делать
не надо. Бесплатный лимит Vercel Hobby — ~100 ГБ трафика/мес, для партии хватит.

**Вариант 2 (Supabase Storage):**
1. Supabase → Storage → создай **public**-бакет с именем `images`.
2. Locally в `.env` добавь `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`
   (Settings → API), затем `bun run upload-images` — скрипт зальёт все портреты.
3. В Vercel добавь env `NEXT_PUBLIC_SUPABASE_URL` — картинки начнут браться из
   `${SUPABASE_URL}/storage/v1/object/public/images/...`.

> Замена конкретного портрета: просто перезаписи файл в `public/heroes/…`
> (вариант 1) или в Storage (вариант 2) — имя файла не меняй.

---

## Шаг 6 (опционально). Онлайн-стражи, вещание, изгнание

Сайт **полностью работает без этого шага**: без presence просто не показывается
«кто в сети», админ-вещание и изгнание; статус-бар честно пишет «ОФЛАЙН».

Если фичи нужны — presence-сервис надо хостить отдельно от Vercel
(Railway / Render / Fly.io — у всех есть бесплатные тарифы):

1. Залей папку `mini-services/presence-service` как отдельный сервис
   (Railway: New Project → Deploy from GitHub repo, root directory =
   `mini-services/presence-service`).
2. В настройках сервиса задай переменные:

   | Имя | Значение |
   |---|---|
   | `PRESENCE_DB_URL` | Supabase transaction pooler (6543, `?pgbouncer=true&connection_limit=1&sslmode=require`) |
   | `PRESENCE_SOCKET_PATH` | `/socket.io` |

   Схема сервиса уже переключена на postgres вместе с основной (`db:use-postgres`
   правит обе) — на Railway просто выполни в сервисе `bun install && bunx prisma generate`.
3. В Vercel добавь env: `NEXT_PUBLIC_PRESENCE_URL=https://presence-твой-домен`
   и сделай **Redeploy** (переменная вшивается в сборку).
4. Проверка: открой сайт в двух вкладках под разными логинами — в профиле
   у обоих горит «в архиве».

> Railway/Render дают публичный HTTPS-домен из коробки — сокет будет ходить
> напрямую с домена Vercel на домен сервиса (CORS на сервике уже открыт).

---

## Аккаунты (из сида)

| Логин | Пароль | Мир | Роль |
|---|---|---|---|
| dnd | ashen | Элария (D&D 5e) | **АДМИН** |
| pf2e | ashen | Голарион (PF2e) | **АДМИН** |
| GTT_EDMI | EldMaster | Голарион | страж |
| sashakarev1809, IlyaKazakhStrong, NiT, ps1x0k1d | ashen | Элария | стражи |
| xlov21, EvaMoon, Mira | ashen | Голарион | стражи |

Горячие клавиши: `1–7` — секции, `Ctrl+K` — палитра, `?` — справка,
`W` — смена мира **(только админы)**, `G` — сброс Взгляда.

---

## Частые вопросы

**Обязательно ли Supabase для картинок?** — Нет. Достаточно `public/` в git.

**Прогресс игроков сохранится при передеплое?** — Да, он в таблице `Progress`
в Supabase, а не на сервере Vercel.

**Можно ли оставить SQLite и не использовать Supabase?** — На Vercel нет:
там файловая система read-only, файл базы нельзя открыть на запись.
SQLite — только для своего сервера (README_DEPLOY.md).

**Vercel пишет "P1001: Can't reach database"?** — Проверь `DATABASE_URL`:
на Vercel нужен **pooler** (порт 6543) с `?pgbouncer=true`, а не прямой 5432.

**Хочу вернуть разработку локально на SQLite.** — `bun run db:use-sqlite`,
в `.env` верни `DATABASE_URL=file:...`, затем `bunx prisma generate`.

**Безопасность.** — Пароли в БД лежат открытым текстом (осознанный выбор для
настольной партии). Не переиспользуй пароль Supabase где-то ещё и не выкладывай
`seed.zip` в public боевого сайта — внутри пароли аккаунтов.
