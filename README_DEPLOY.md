# Деплой «Архива Пепельной Длани» на Supabase + Vercel

Эта инструкция проведёт тебя по всем шагам — от создания аккаунтов до живого сайта.
**Никакого программирования с твоей стороны не нужно** — только клики в дашбордах и пара команд в терминале.

---

## Что у тебя будет в конце

```
https://твой-проект.vercel.app  ← живой сайт
         │
         ├─ GitHub (код) → автодеплой при пуше
         ├─ Vercel (фронтенд + API, бесплатно)
         ├─ Supabase PostgreSQL (база, 500MB бесплатно)
         └─ Supabase Storage (картинки, 1GB бесплатно)
```

Время: ~25 минут.

---

## Шаг 1. Создай проект Supabase (5 мин)

1. Зайди на [supabase.com](https://supabase.com), нажми **Start your project**, войди через GitHub
2. **New Project**
   - Name: `ashen-archive`
   - Database Password: придумай и **сохрани** (например `MyP3ssw0rd!2024`)
   - Region: `Frankfurt` (ближайший к России/Европе)
   - Plan: Free
3. Дождись создания (~2 минуты)

### Создай bucket для картинок

1. В левом меню Supabase → **Storage**
2. **New bucket**
   - Name: `images` (строго так)
   - Public bucket: ✅ **включи**
3. Создай

### Получи ключи

В Supabase → **Project Settings** (шестерёнка внизу слева) → **API**:

| Что нужно | Где взять |
|-----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, например `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API keys → `service_role` (длинная строка) |

В **Project Settings → Database → Connection string**:

| Что нужно | Где взять |
|-----------|-----------|
| `DATABASE_URL` | Connection pooling (порт 6543) — замени `[YOUR-PASSWORD]` на свой пароль |
| `DIRECT_URL` | Direct connection (порт 5432) — замени `[YOUR-PASSWORD]` |

**Формат будет такой:**
```
DATABASE_URL=postgresql://postgres.abc123:ТВОЙ_ПАРОЛЬ@aws-0-fra1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:ТВОЙ_ПАРОЛЬ@db.abc123.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Сохрани эти 4 строки** — они понадобятся в следующих шагах.

---

## Шаг 2. Подготовь локальный `.env` (2 мин)

В корне проекта скопируй `.env.example` в `.env`:

```bash
cp .env.example .env
```

Открой `.env` в редакторе и вставь свои 4 значения из Шага 1.

> `.env` в `.gitignore` — он не попадёт в GitHub. Это правильно, там секреты.

---

## Шаг 3. Залей картинки в Supabase Storage (2 мин)

Скрипт `scripts/upload-images.ts` берёт все картинки из `public/heroes/` и `public/gods/` и загружает их в твой Supabase Storage bucket `images`.

```bash
bun run upload-images
```

**Ожидаемый вывод:**
```
  ✓ Bucket "images" существует
▸ Загрузка 5 файлов из heroes/ → heroes/
  ✓ heroes/eiri.png → https://abc123.supabase.co/storage/v1/object/public/images/heroes/eiri.png
  ✓ heroes/remi.png → ...
  ...
▸ Загрузка 12 файлов из gods/ → gods/
  ✓ gods/alarus.png → ...
  ...
✓ Готово.
```

Проверь в Supabase → Storage → `images` bucket — там должны быть папки `heroes/` (5 файлов) и `gods/` (12 файлов).

---

## Шаг 4. Создай таблицы и заполни данными (2 мин)

**Одна команда сделает всё:**
- сгенерирует Prisma клиент под PostgreSQL
- создаст все таблицы в Supabase
- заполнит их данными из сида (с правильными URL картинок)

```bash
bun run setup:supabase
```

Это алиас для `db:generate && db:push && upload-images && db:seed`. Если картинки уже залил на Шаге 3 — скрипт их обновит (upsert).

**Проверь, что данные появились:**
- Supabase → **Table Editor** → таблица `Character` — должно быть 48 строк
- таблица `Faction` — 15 строк
- таблица `User` — 2 строки (`dnd`, `pf2e`)

---

## Шаг 5. Проверь локально (1 мин)

```bash
bun run dev
```

Открой `http://localhost:3000`, залогинься:
- `dnd` / `ashen` → мир Эларии
- `pf2e` / `ashen` → мир Голариона

Картинки должны подтягиваться из Supabase Storage (публичные URL). Если работают — локальная часть готова, глуш сервер (`Ctrl+C`).

---

## Шаг 6. Запушь на GitHub (3 мин)

Если ещё не создал репозиторий:

1. Зайди на [github.com](https://github.com), **New repository**
   - Name: `ashen-archive`
   - Private (рекомендую — там твои тексты лора)
   - **НЕ** добавляй README/gitignore (они уже есть)

В терминале, в папке проекта:

```bash
git init
git add .
git status   # проверь, что .env НЕ в списке (должен быть в .gitignore)
git commit -m "Архив Пепельной Длани — миграция на Supabase"
git branch -M main
git remote add origin https://github.com/ТВОЙ_НИК/ashen-archive.git
git push -u origin main
```

> ⚠️ **ВАЖНО:** перед `git add` убедись, что `.env` в `.gitignore`. Проверь:
> ```bash
> git status --ignored | grep ".env"
> ```
> Если `.env` виден как untracked (не ignored) — не коммить, добавь в `.gitignore` сначала.

---

## Шаг 7. Деплой на Vercel (5 мин)

1. Зайди на [vercel.com](https://vercel.com), войди через GitHub
2. **Add New → Project → Import** твой репозиторий `ashen-archive`
3. Vercel сам определит Next.js — **Framework Preset: Next.js**
4. **Environment Variables** — добавь те же 4 переменные из Шага 1:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres.abc123:...:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | `postgresql://postgres:...:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` |

5. **Deploy** — подожди ~2 минуты
6. Получишь URL: `ashen-archive-xxx.vercel.app`

🎉 **Готово!** Зайди на URL, залогинься `dnd` / `ashen` — сайт живёт в облаке.

---

## Дальнейшее обслуживание

### Обновить код (автодеплой)

```bash
git add .
git commit -m "что изменил"
git push
```

Vercel сам пересоберёт и опубликует — через ~1 минуту изменения будут на сайте.

### Добавить нового героя / бога

**Вариант А — через код (рекомендую):**
1. Отредактируй `prisma/seed.ts` — добавь запись
2. Залей картинку: `bun run upload-images` (если новая)
3. `bun run db:seed` — пересоздаст данные
4. `git push` — Vercel задеплоит

**Вариант Б — прямо в Supabase:**
1. Залей картинку в Storage (drag-and-drop в дашборде)
2. Скопируй публичный URL картинки
3. В Table Editor → `Character` → Insert row → вставь URL в `imageUrl`

### Бэкапы

Supabase Free делает **ежедневные бэкапы** (хранятся 7 дней). Для ручного:
```bash
pg_dump "postgresql://postgres:ПАРОЛЬ@db.PROJECT.supabase.co:5432/postgres" > backup-$(date +%Y%m%d).sql
```

### Логи и мониторинг

- **Vercel:** dashboard → твой проект → Logs (виден каждый запрос)
- **Supabase:** dashboard → Logs (SQL-запросы, Storage-доступ)

---

## Если что-то сломалось

| Симптом | Решение |
|---------|---------|
| `P1001: Can't reach database server` | Проверь `DATABASE_URL` — возможно, пароль без спецсимволов или регион в хосте не тот |
| Картинки не грузятся (404) | Проверь, что bucket `images` = **public**. Settings → Storage → Policies |
| `PrismaClientInitializationError` на Vercel | Не задан `DIRECT_URL` в env Vercel |
| Логин не работает | Проверь, что `db:seed` отработал — в Supabase Table Editor → User должны быть 2 строки |
| `STORAGE_NOT_CONFIGURED` при загрузке | Не задан `SUPABASE_SERVICE_ROLE_KEY` |

---

## Чек-лист перед публикацией

- [ ] `.env` НЕ в git (`git status` не показывает его)
- [ ] `.env.example` в git (шаблон для других разработчиков)
- [ ] Картинки загружены в Supabase Storage
- [ ] Таблицы созданы и заполнены (`db:seed` отработал)
- [ ] Локально `bun run dev` работает и картинки подтягиваются
- [ ] Репозиторий на GitHub — private
- [ ] На Vercel введены все 4 env-переменные
- [ ] Первый деплой прошёл успешно
- [ ] Логин `dnd`/`ashen` работает на live-URL

---

## Контакты и поддержка

Если что-то не работает — проверь:
1. Логи Vercel: dashboard → твой проект → Logs
2. Логи Supabase: dashboard → Logs → Database / Storage
3. Этот README — раздел «Если что-то сломалось»

Удачного деплоя! 🐉
