# Деплой «Архива Пепельной Длани» на Git + Supabase + Vercel

Этот гайд — как поднять сайт на связке **GitHub (Git) + Supabase (база) + Vercel (хостинг)**,
и что для этого уже подготовлено в коде.

> Для самостоятельного хостинга (VPS + SQLite) есть отдельный [README_DEPLOY.md](README_DEPLOY.md).

---

## Итог аудита совместимости (что уже готово, а что нельзя)

| Часть | Vercel + Supabase | Комментарий |
|---|---|---|
| Next.js 16 (страницы, API-роуты) | ✅ работает | API-роуты не пишут на диск — serverless-совместимы |
| База: Prisma + SQLite | ❌ → ✅ заменено | У Vercel ФС read-only, SQLite не выживает. Скрипт `db:use-postgres` переключает схему на Supabase PostgreSQL |
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

# 2. Переключи Prisma на PostgreSQL (правит prisma/schema.prisma)
bun run db:use-postgres

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
2. Framework Preset определится как **Next.js** — настройки сборки не трогай
   (скрипт `build` = `next build`, Vercel-совместимый).
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
