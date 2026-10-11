# Что изменилось (v4.3.7 — build:standalone на Windows, фикс «cp: illegal option»)

## Изменённые файлы:
1. scripts/copy-standalone.mjs — НОВЫЙ скрипт: кроссплатформенное
   копирование .next/static и public в .next/standalone (fs.cpSync).
2. package.json — build:standalone: Unix-команды `cp -r …` заменены
   на Node-скрипт (обёртка node || bun).
3. README_FIRST.txt — секция под ошибку «cp: illegal option -- r» +
   уточнение: на Vercel build:standalone не нужен вообще.
4. README_VERCEL.md — рекомендация Build Command = `bun run build`.

## Если у тебя ОСТРЫЙ случай — build:standalone упал на
   «cp: illegal option -- r» (архив v4.3.6 или старее)

ХОРОШАЯ НОВОСТЬ: сборка УЖЕ прошла успешно (compile + генерация
роутов в логе выше ошибки) — упало только копирование статики в
standalone-папку. Причина: в конце скрипта стояли Unix-команды
`cp -r .next/static … && cp -r public …` — на Windows cp в PATH либо
нет, либо он не умеет -r.

ФИКС зависит от твоего сетапа:
- Продакшен на Vercel (Git + Supabase + Vercel): build:standalone на
  твоей машине НЕ НУЖЕН ВООБЩЕ — Vercel сам собирает при пуше.
  Просто запушь обновлённые файлы в репозиторий. Для гарантии
  авто-синка провайдера поставь на Vercel: Settings → General →
  Build Command = `bun run build`.
- Локальная прод-проверка на Windows:
    bun run build
    bun run start:next
- В архиве v4.3.7+ `bun run build:standalone` работает на любой ОС:
  копирование делает scripts/copy-standalone.mjs (Node/fs.cpSync,
  без shell-команд). Запуск после сборки: `bun run start` (порт 3000).

## Что сделано в v4.3.7 (для будущих установок)
- Новый scripts/copy-standalone.mjs (engine-agnostic: node или bun,
  без зависимостей): копирует .next/static → .next/standalone/.next/
  static и public → .next/standalone/public; внятные ошибки, если
  .next/standalone или источники не найдены.
- Цепочка build:standalone: check-deps → sync-db-provider →
  next build → copy-standalone — ни одной Unix-only команды.
- Проверено: под node и под bun, повторный запуск идемпотентен,
  отсутствие .next/standalone даёт понятную ошибку (exit 1).

## v4.3.6 — сборка сама доустанавливает зависимости

## Изменённые файлы:
1. scripts/check-deps.mjs — НОВЫЙ скрипт: сверяет dependencies из
   package.json с node_modules и доустанавливает недостающее.
2. package.json — check-deps встроен в dev / build / build:standalone
   (первым шагом, перед синком провайдера и next …).
3. README_FIRST.txt / CHANGES.md — секция под ошибку «Module not found».

## Если у тебя ОСТРЫЙ случай — `bun run build:standalone` (или build /
   dev) падает с «Module not found: Can't resolve 'socket.io-client'»
(архив v4.3.5 или старее; в v4.3.6 исправлено)

ПРИЧИНА: файлы проекта обновлены поверх старой установки, а node_modules —
нет. Зависимости ставятся ТОЛЬКО командой install (bun install / npm
install) — простая замена файлов их НЕ обновляет. Новые версии проекта
импортируют пакеты, которых не было в старой установке (presence-модуль
онлайн-стражей добавил socket.io-client) — next build падает посреди
сборки с «Module not found».

ФИКС (1 команда, затем повтори сборку):
  1. bun install
  2. bun run build:standalone
После этого сайт на своём сервере: `bun run start` (порт 3000).
Presence («кто в сети») без запущенного mini-service просто выключен —
это не ошибка; включается переменной NEXT_PUBLIC_PRESENCE_URL (см.
README_DEPLOY.md).

## Что сделано в v4.3.6 (для будущих установок)
- Новый scripts/check-deps.mjs (engine-agnostic: node или bun, без
  зависимостей): читает dependencies, проверяет node_modules/<pkg>/
  package.json для каждого; при нехватке — печатает внятную причину и
  доустанавливает (bun install, при его отсутствии — npm install),
  затем перепроверяет. Флаги: --quiet, --check-only (CI: только
  проверить, код 1 при нехватке), --include-dev (проверять и devDeps —
  по умолчанию НЕ проверяются: для build они не нужны, а на боевых
  серверах их осознанно не ставят).
- Цепочки dev / build / build:standalone начинаются с check-deps —
  класс ошибок «файлы новые, node_modules старый» больше не роняет
  сборку, а самолечится.
- Проверено матрицей из 7 тестов: чистый прогон (68 пакетов) под
  node/bun; детект отсутствующего socket.io-client с понятным
  сообщением; полный цикл авто-доустановки под node и под bun на
  изолированном проекте; повторный прогон — no-op; CI-режим --check-only.

## v4.3.5 — db:seed без npx, фикс для Windows + bun

## Изменённые файлы:
1. scripts/sync-db-provider.mjs — запуск `prisma generate` переписан на
   цепочку стратегий, не зависящую от npx и от вида .bin-шимов.

## Если у тебя ОСТРЫЙ случай — `bun run db:seed` падает с
   «'npx' is not recognized as an internal or external command»
(архив v4.3.4 или старее; в v4.3.5 исправлено)

ПРИЧИНА: перед заливкой сида скрипт пересобирает prisma-клиент. На
Windows он искал node_modules\.bin\prisma.cmd — этот шим создаёт npm,
а при установке зависимостей через bun в .bin лежит prisma.exe. Не
найдя .cmd, скрипт откатывался к буквальному `npx prisma generate` —
а на машинах, где npm/npx нет в PATH (только node + bun), это давало
«'npx' is not recognized» и ронило db:seed ещё до записи данных.

ФИКС (2 команды, файлы менять не нужно):
  1. bun run db:generate     (пересборка клиента — bun сам найдёт шим)
  2. bun run prisma/seed.ts  (заливка данных)
Итог сида: users 10 · factions 14 · characters 41 · lore 77 ·
locations 13 · chronicles 6 · achievements 6.

## Что исправлено в v4.3.5 (для будущих установок)
- `prisma generate` запускается по цепочке (до первого успеха):
  1) node node_modules/prisma/build/index.js — прямой вызов CLI;
  2) bun node_modules/prisma/build/index.js — смена интерпретатора;
  3) локальные .bin-шимы: prisma.cmd (npm) / prisma.exe (bun, Windows);
  4) bunx / `bun x`;
  5) npx — последней, с предварительной проверкой, что раннер есть.
- «Команда не найдена» (ENOENT / 127 / 9009) аккуратно пропускается —
  никаких «'npx' is not recognized» и дублирования ошибок; при реальном
  сбое prisma ретраится только смена интерпретатора node ↔ bun.
- Проверено в матрице: под node, под bun, чисто-bun-машина (без node
  в PATH), сломанный/переименованный CLI + .bin, пустой PATH; плюс
  полный end-to-end `bun run db:seed` (users 10 / characters 41 /
  lore 77).

## v4.3.4 — фикс авто-синка провайдера

## Изменённые файлы:
1. scripts/sync-db-provider.mjs — регулярка поиска provider привязана к
   началу строки (только standalone-строка внутри datasource).
2. prisma/schema.prisma — из комментариев шапки убран ложный паттерн
   `provider = "…"` (теперь «провайдер postgresql» текстом) — регулярка
   в принципе не может зацепиться за комментарий.
3. README_FIRST.txt — секция под ошибку «SQLite database error» при
   db:push (для архивов v4.3.3 и старее) с ручным фиксом на 1 правку.

## Если у тебя ОСТРЫЙ случай — db:push падает с
   «SQLite database error … unable to open database file: postgresql://…»
(архив v4.3.3 или старее; в v4.3.4 исправлено автоматически)

ПРИЧИНА: в prisma\schema.prisma в блоке datasource db стоит
`provider = "sqlite"`, а DATABASE_URL — postgres (Supabase). Prisma
пытается открыть postgres-ссылку как sqlite-файл. Авто-синк из v4.3.3
должен был переключить провайдер сам, но его регулярка первым делом
цеплялась за строку-КОММЕНТАРИЙ в шапке схемы (там был текст
`// postgresql://… → provider = "postgresql"`) — «переключал» комментарий,
а настоящий провайдер оставался sqlite.

ФИКС (1 правка + 3 команды):
  1. Открой prisma\schema.prisma, найди блок:
       datasource db {
         provider = "sqlite"     ← замени ТОЛЬКО эту строку
         url      = env("DATABASE_URL")
       }
     Постав provider = "postgresql" (строки с // — не трогай).
  2. bun run db:generate
  3. bun run db:push
  4. bun run db:seed
Итог сида: users 10 · factions 14 · characters 41 · lore 77 ·
locations 13 · chronicles 6 · achievements 6.

## Что исправлено в v4.3.4 (для будущих установок)
- Регулярка скрипта теперь `^([ \t]*)provider[ \t]*= … $m` — матчится
  ТОЛЬКО на настоящую строку провайдера в datasource.
- Ложные паттерны убраны из комментариев обеих схем.
- Переключение проверено матрицей из 6 сценариев: sqlite↔postgresql,
  ±DIRECT_URL (добавление/снятие directUrl), no-op — все зелёные.

## После сида
- Сайт на своём сервере: `bun run build:standalone` + перезапуск
  (prisma-клиент запекается в бандл при сборке).
- Сайт на Vercel: закоммить исправленную схему в репозиторий и
  задеплой — иначе Vercel соберёт sqlite-клиент и разделы упадут с 500.

## Прошлые версии
- v4.3.3 — самолечение сида: db:seed/db:push сами пересобирают
  prisma-клиент (фикс «Unknown argument `role`»), летопись сессий и
  стаж в досье стража, сортировка реестра стражей.
- v4.3.2 — авто-синк провайдера (postinstall/dev/build), .env.example.
