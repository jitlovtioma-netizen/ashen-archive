# Что изменилось (v4.5 — живые коррупты, пасхалка Создателя, бесплатный онлайн)

## Главное в v4.5

1. **Живые коррупты (искажённый текст 2.0).** Слова, тронутые порчей, теперь
   не просто глитч-блоки: каждый ~0.6с несколько искажённых слов перетекают
   в новые символы (блоки помех + древние руны), а изредка сквозь помехи
   на миг проступает НАСТОЯЩЕЕ слово — «призрак смысла» — и растворяется.
   При каждом открытии досье порча выбирает СЛУЧАЙНЫЕ слова (узор каждый
   раз новый). Над текстом — строка «СИНХРОНИЗАЦИЯ ПАМЯТИ… NN%» с живым
   процентом (никогда не доходит до 100). Наведение на слово — искажение
   «сопротивляется» чтению. Досье Кали — фиолетовая тема: zalgo-фрагменты
   из БД оживлены, шесть якорей-слов (Лицимерие, Двуличность, Враг,
   Никчёмность, Смерть, Боль) остаются читаемыми всегда. Превью в карточках
   сетки — статичная порча (без таймеров, чтобы не грузить десятки карточек).
   Скринридеры читают исходные слова (sr-only), пунктуация остаётся читаемой.
   Уважается prefers-reduced-motion.
2. **Пасхалка «Божественная мощь».** Щёлкни «ЗВУК: ВКЛ/ВЫКЛ» 6 раз за 6
   секунд — Создатель откроет прямой канал связи и красивыми словами
   попросит не дёргать извечный выключатель (гром + зловещий пульс,
   автозакрытие через 12с, повтор не раньше чем через минуту).
3. **Бесплатный онлайн стражей (Supabase Realtime).** Новый режим presence
   без единого платного сервиса: на твоём же Supabase включаются каналы
   Realtime — «кто онлайн», «в архиве с…», «⚑ был в сети» (heartbeat
   раз в минуту пишет User.lastSeenAt в основную БД). Настройка — 2
   переменных окружения, рецепт в README_VERCEL.md → Шаг 6, вариант А.
   Socket.io-сервис остался для админ-вещания и изгнания (вариант Б).
   Для v4.5 один раз выполни `bun run db:push` (добавит nullable-колонку
   User.lastSeenAt, данные не трогает).
4. **Мелочи:** версия UI → v4.5 в тайтлбаре; фикс React-ворнинга
   «animation/animationDelay» в оверлее ОТРАЖЕНИЕ досье Кали; devkeeper
   песочницы теперь проверяет dev-сервер каждые 20с (переживает рестарты
   после смены схемы Prisma).

## Изменённые файлы:
1. src/components/crt/CorruptedText.tsx — НОВЫЙ: компонент живых корруптов
   (глифы+руны, дрейф, призраки смысла, zalgo-детект, protect-якоря,
   sync-строка, live/static режимы, доступность).
2. src/components/crt/DivineWarning.tsx — НОВЫЙ: пасхалка-предупреждение
   Создателя (оверлей, звук, автозакрытие).
3. src/components/crt/RecordModal.tsx — досье рендерит CorruptedText
   (Кали: zalgoAware+violet+якоря; обычные искажённые: red, ratio 0.42);
   старый censorText удалён; фикс animation/animationDelay.
4. src/components/crt/RecordCard.tsx — превью карточек через CorruptedText
   (live=false); censorText удалён.
5. src/components/crt/TitleBar.tsx — счётчик частых кликов ЗВУК + портал
   DivineWarning; версия v4.5; тултип-намёк на кнопке звука.
6. src/lib/presence.ts — три режима: socket.io → Supabase Realtime → выкл;
   heartbeat /api/presence; экспорт presenceBackend.
7. src/app/api/presence/route.ts — НОВЫЙ: GET (карта lastSeen за 30 дней)
   + POST (heartbeat стража).
8. prisma/schema.prisma — User.lastSeenAt DateTime? (nullable).
9. src/app/globals.css — CSS-слой v4.5: .corrupt-word (аберрация, дыхание,
   hover-сопротивление), .corrupt-ghost, .corrupt-sync, .divine-* (карточка,
   глаз, пульсации), доступность reduced-motion.
10. mini-services/presence-service/devkeeper.ts — интервальный дозор (20с).
11. README_VERCEL.md — Шаг 6 переписан: вариант А БЕСПЛАТНО (Supabase
    Realtime, 2 env), вариант Б socket.io (Railway/Render/Fly/Koyeb).

## Как обновиться (прод: Git + Supabase + Vercel)
1. Забери изменения, запушь в Git — Vercel пересоберёт сам.
2. Один раз локально: `bun run db:push` (колонка lastSeenAt).
3. (Опционально) Включи бесплатный онлайн: README_VERCEL.md → Шаг 6,
   вариант А — ключ anon public в Vercel env + Redeploy.

---

# История: v4.3.7 — build:standalone на Windows, фикс «cp: illegal option»

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
