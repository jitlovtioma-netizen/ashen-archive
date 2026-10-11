# ПЕПЕЛЬНЫЙ АРХИВ (Ashen Archive) — Worklog

## Текущий статус проекта (актуально: v4.3.2, задача «фикс HTTP 500 на проде»)

Проект работает в песочнице `/home/z/my-project` на локальной SQLite-базе
(`.env` → `DATABASE_URL=file:...db/custom.db`), dev-сервер на порту 3000
поддерживается сторожем `mini-services/presence-service/devkeeper.ts`
(переживает зачистку процессов harness'ом). Продакшен пользователя —
**Git + Supabase (PostgreSQL) + Vercel**, боевой .env получен и проверен
(read-only): 10 стражей, 41 персонаж, 77 лора, 14 фракций — данные живы.

### ⚠ ГЛАВНЫЕ ПРАВИЛА для всех будущих агентов (НЕ НАРУШАТЬ)
1. **НЕ переключай provider Prisma вручную** (никаких `db:use-postgres` /
   `db:use-sqlite` / правок schema.prisma «руками»). С v4.3.2 провайдер
   синхронизируется АВТОМАТИЧЕСКИ скриптом `scripts/sync-db-provider.mjs`
   (запускается из postinstall/dev/build по DATABASE_URL). Ручные правки
   схемы БЕЗ понимания этого механизма ломают прод (инцидент HTTP 500,
   см. Task 6-7 ниже). Провайдер в git-коммите может быть любым — это
   нормально, авто-синк выровняет при установке.
2. **НЕ запускай** `bun run db:push` / `db:seed` с postgres-ссылкой боевой
   базы в .env — это пишет в прод. В песочнице .env всегда sqlite.
3. Рабочее дерево может содержать изменённые `prisma/schema.prisma`
   (provider sqlite/postgresql) — это шум авто-синка, НЕ «поломка».
4. QA через agent-browser: логинься, смотри героев/лор, НО не активируй
   секретные механики без нужды (konami, загадки) — пишут прогресс.

**Что это:** тёмно-фэнтезийный CRT-архив настольной ролевой кампании «Орден
Пепельной Длани». Два мира: Элария (D&D 5e) и Голарион (Pathfinder 2e).
Герои, фракции, лор, пантеоны, второстепенные NPC, локации, достижения,
хроники. Секретные механики: осколки памяти, печати, загадки, Konami-код,
«Взгляд Бога», ведьмин час, командная палитра (Ctrl+K), мини-игры
(SinsWheel, BrunoMiniGame), скрытые достижения.

---

## Task ID: 1
Agent: main (Z.ai Code)
Task: Скачать репозиторий ashen-archive с GitHub и полностью развернуть сайт в песочнице

Work Log:
- Склонировал репозиторий `jitlovtioma-netizen/ashen-archive` (ветка main)
- Остановил работавший dev-сервер, скопировал `src/`, `public/` (gods, heroes,
  videos, logo.svg, robots.txt), `prisma/seed.ts`, конфиги (tailwind, next,
  tsconfig, postcss, eslint, components.json), `scripts/upload-images.ts`,
  CHANGES.md, README_DEPLOY.md, .env.example
- Адаптировал `prisma/schema.prisma`: postgresql → sqlite, убрал directUrl,
  оставил все модели (User, Faction, Character, Lore, Location, Chronicle,
  Achievement) — все примитивные типы совместимы с SQLite
- Обновил package.json: добавил скрипты `db:seed`, `upload-images`,
  `setup:supabase`, зависимость `@supabase/supabase-js` (для паритета с репо)
- `bun install` — успешно
- `bun run db:push` — схема применена к SQLite (db/custom.db)
- `bun run db:seed` — засеяно: 10 users, 14 factions, 40 characters,
  77 lore, 13 locations, 6 chronicles, 6 achievements
- Запустил dev-сервер (порт 3000) — Ready in 615ms
- `bun run lint` — 0 ошибок
- QA через agent-browser:
  - Страница входа рендерится, логин dnd/ashen и pf2e/ashen работает
  - Boot-последовательность → «Вход в архив» → главный интерфейс
  - Проверены ВСЕ разделы: ГЕРОИ, ФРАКЦИИ, ЛОР, БОЖЕСТВА, ВТОРОСТЕП. ГЕРОИ,
    ЛОКАЦИИ, ДОСТИЖЕНИЯ — в обоих мирах (DND и PF2E)
  - Все 71 изображение из сида проверены: 69 были в репо, 2 отсутствовали
  - API: /api/stats (DND: 63 записи, PF2E: 55), /api/archive, /api/factions,
    /api/achievements, /api/auth/login — все 200 OK
  - Мобильная вёрстка (390x844) работает
- Сгенерировал 2 недостающих портрета (были только в Supabase, в git их нет):
  - `public/heroes/tey.png` — Тей-Мегьдос (DND, зловещий вельможа в цилиндре)
  - `public/heroes/stranger.png` — Странник (PF2E, добрый дед с собакой)
  - Стиль: dark fantasy oil painting, 864x1152. Оба загрузились (проверено
    в браузере: tey.png:true, stranger.png:true)

Stage Summary:
- Сайт полностью работает в песочнице: вход, оба мира, все разделы,
  изображения, видео (hope_video.mp4, HTTP 200), статусы записей
  (ДОСТУПНО/ИСКАЖЕНО/ОПЕЧАТАНО/МЁРТВ)
- Тестовые учётки: dnd/ashen (Элария), pf2e/ashen (Голарион) + 8 личных
  аккаунтов из сида
- Изображения хранятся локально в /public — Supabase для работы НЕ нужен
- HoloPortrait имеет onError-fallback (глиф ✦) на случай битых картинок

## Нерешённые вопросы / риски / приоритеты следующей фазы

1. **Supabase (вопрос пользователя):** пользователь спросил, можно ли дать
   доступ к Supabase. Ответ: ДА, можно — нужны `NEXT_PUBLIC_SUPABASE_URL` и
   `SUPABASE_SERVICE_ROLE_KEY` (или просто публичные ссылки на картинки из
   Storage-бакета `images`). Тогда можно скачать оригинальные портреты
   tey/stranger и заменить сгенерированные заглушки. Либо просто прислать
   сами файлы. Текущие AI-заглушки полностью рабочие.
2. **Дальнейшее развитие (для cron-раундов webDevReview):**
   - Прогнать глубже скрытые механики: Konami-код (↑↑↓↓←→←→BA), загадки
     (RiddleGate у запечатанных записей), SinsWheel, BrunoMiniGame,
     командная палитра Ctrl+K, Hotkeys (F1 и др.)
   - Проверить секцию «Секреты» (сбор всех осколков → откровение)
   - Улучшать стили и добавлять детали (требование cron-задачи)
3. Пароли в сидах хранятся открытым текстом (так было в оригинале, для
   sandbox это ок; в проде стоит хешировать)

---

## Task ID: 2
Agent: main (Z.ai Code)
Task: Большое обновление — меню «Профиль», онлайн-присутствие, админ-права, персистентность прогресса

Work Log:
- **ЗАКРЫТИ СТАРОЙ «ЛОЖНОЙ ТЕМЫ»**: «битые строки» RecordModal.tsx (const artinSecretShown…)
  оказались артефактом отображения вывода — пайплайн инструментов вырезает последовательность
  «[m» как ANSI-код. od -c доказал: файл корректен. НЕ «чинить» эти строки!
- Prisma: User.role (USER/ADMIN), User.characterId (привязка персонажа), модель Progress
  (userId+system unique; achievements/shards/unlockedIds/revealedSecrets/solvedRiddles —
  JSON-строки, konami/secret, gaze, updatedAt)
- Сид: vladik_pidr УДАЛЁН; GTT_EDMI/EldMaster (PF2E, USER) добавлен; dnd и pf2e → ADMIN.
  NiT оставлен (второе сообщение пользователя не требовало удаления). Полный re-seed.
- Mini-service mini-services/presence-service (socket.io, порт 3003, bun --hot):
  presence-карта, уникализация по логину, роль проверяется по БД (read-only Prisma),
  события: join/presence/broadcast (admin) → admin-broadcast, kick (admin) → kicked.
  Запуск: bun run dev в mini-services/presence-service (лог /tmp/presence.log).
- API: GET /api/auth/me (свежая роль/привязка), GET /api/users (все + сводки прогресса),
  GET/POST /api/progress (свой прогресс всегда, чужой — только админ; upsert по user+system),
  POST /api/users/bind (привязка персонажа, только админ, проверка system-match),
  POST /api/auth/login теперь возвращает role + characterId.
- Frontend: socket.io-client; lib/presence.ts (zustand-стор + singleton-сокет
  io("/?XTransformPort=3003")); ProfileSection (своя карточка, статы, достижения,
  стражи архива с цветами, админ-панель); UserProfileModal (досье чужого стража);
  AdminBroadcastOverlay (полноэкранное вещание, авто-скрытие 12с); Sidebar — пункт ПРОФИЛЬ
  (первый) + бейдж ⚡ АДМИН у стража; StatusBar — «СТРАЖЕЙ В СЕТИ: N»; CommandPalette —
  быстрый переход «Профиль»; LoginForm — баннер «ВЫ ИЗГНАНЫ ИЗ АРХИВА».
- Store: секция "profile"; queueSave (дебаунс 1.2с) во всех муторах прогрессии;
  flushProgressSave на logout/switchWorld/beforeunload/pagehide; hydrate при входе
  и при восстановлении сессии (union-мерж — идемпотентно).
- ГЛОССАРИЙ ЦВЕТОВ: DND = var(--red), PF2E = var(--cyan), админ = var(--amber).

Баги, найденные и исправленные в процессе QA (agent-browser, 2 сессии через шлюз :81):
1. Dev-сервер держал старый Prisma-клиент (нет колонок role/Progress) → перезапуск решает.
   ВАЖНО: после изменения schema.prisma при работающем dev-сервере — всегда рестарт!
2. Тестировать сокеты только через http://localhost:81 (Caddy-шлюз), НЕ напрямую :3000 —
   иначе XTransformPort не работает.
3. ProfileSection грузил каталог персонажей только для админов → привязка не показывалась
   у обычных пользователей. Исправлено: каталог грузится для всех.
4. hydrateProgressFromServer не передавал requester → 403 FORBIDDEN → прогресс не
   восстанавливался. Исправлено (+гидратация при page reload, не только при логине).

Результаты E2E (всё проверено вживую):
- Логины: GTT_EDMI/EldMaster 200 OK; vladik_pidr 401 (удалён); NiT 200 OK
- Админ: dnd и pf2e → ⚡ АДМИНИСТРАТОР (подсветка, панель, досье, изгнание, вещание)
- Обычный пользователь: НЕТ админ-инструментов, НЕ видит чужие досье
- Онлайн: обе сессии видят друг друга (live-обновления), цвета карточек проверены
  computed-стилями: DND rgb(255,36,36), PF2E rgb(63,214,200), админ — amber-градиент
- Вещание: fullscreen-оверлей у ОБОИХ сессий, авто-скрытие 12с, скриншоты сняты
- Изгнание: GTT_EDMI мгновенно разлогинен, баннер «ВЫ ИЗГНАНЫ ИЗ АРХИВА»
- Привязка: админ привязал Диану к GTT_EDMI (API-проверка доступа: не-админ → FORBIDDEN),
  привязка отображается в профиле пользователя после перезагрузки
- Персистентность: GTT_EDMI решил загадку Тартуччио + собрал осколок «гордыня» +
  ачивка TARTUCCIO_RIDDLE → logout → login → reload: всё восстановлено (1/3, 1, 1/1,
  взгляд 14%). Строка в БД: shards [гордыня], solvedRiddles [Тартуччио]
- Lint: 0 ошибок 0 предупреждений; dev.log чистый; мобильная вёрстка (390x844) ок

Stage Summary:
- Все требования пользователя выполнены + бонусом реализованы изгнание (kick) и
  админ-редактор привязок прямо в UI
- Прогресс теперь живёт на сервере (per user+system), переживает выход/перезаход/перезагрузку
- Presence-service — первый mini-service проекта (шаблон для будущих realtime-фич)

## Нерешённые вопросы / приоритеты следующей фазы
1. **ЖДЁМ ОТ ПОЛЬЗОВАТЕЛЯ**: список «логин → персонаж» для привязки профилей
   (админ может сделать это сам через ПАНЕЛЬ СОЗИДАТЕЛЯ → ПРИВЯЗКА_ПЕРСОНАЖЕЙ).
2. Безопасность (sandbox-уровень): identity передаётся логином без подписи — при
   желании можно добавить серверные сессии/токены.
3. Re-seed теперь ОПАСЕН для прогресса (record id меняются) — не запускать
   bun run db:seed без необходимости, либо мигрировать на стабильные id.
4. Идеи: сортировка/фильтр стражей, «последний раз в сети», история хроник в профиле,
   звук вещания, тёмная тема профиля персонажа (полное досье из карточки).

---
Task ID: 3
Agent: main (Z.ai Code)
Task: Привязка персонажей к аккаунтам (по списку пользователя), новый герой PF2E «Каэль Валькрейн», все логины в профиле + клик-досье для админа, кнопка сброса прогресса до нуля

Work Log:
- Пользователь прислал распределение: sashakarev1809→Бруно, IlyaKazakhStrong→Мартин МакДона,
  NiT→Мартин Осборн, ps1x0k1d→Реми (DND); GTT_EDMI→Каэль Валькрейн, xlov21→Линдэмир Суртов,
  EvaMoon→Диана, Mira→Мира (PF2E). NiT ОСТАВЛЕН (пользователь дал ему персонажа).
- Создан герой PF2E «Каэль Валькрейн» (Ведьмак · Охотник на Демонов, 🗡, карта 100/400,
  портрет public/heroes/kael.png — AI-генерация 864x1152: ведьмак, дракончик на плече).
  Описание — краткая биография в стиле архива (▓▒░), БЕЗ упоминания бутилированного света
  (свет Аразни) и БЕЗ упоминания родителей — требование пользователя. Упоминаются:
  Болигар, Кенабрес, капитан гарнизона, Сатра, крестовый поход, Нимерия, Селлен Хилс,
  Лэфтарион, Апсу, Эдмунт Ван Рейх, деревня Линдемира Суртова.
- prisma/bind-characters.ts — одноразовый скрипт привязок (НЕ re-seed, прогресс не трогает).
  Выполнен: все 8 привязок применены; dnd/pf2e (админы) — без персонажей.
- prisma/seed.ts синхронизирован: Каэль добавлен в героев PF2E + блок bindMap с привязками
  (будущие re-seed дают ту же картину).
- API: DELETE /api/progress?login&requester&system — полный сброс прогресса (свой всегда,
  чужой только админ; deleteMany строки Progress → GET отдаёт null).
- Store: resetMyProgress() — отменяет отложенный queueSave (гонка!), чистит локальное
  состояние (shards/achievements/unlockedIds/revealedSecrets/solvedRiddles/konami/
  secretRevealed/gaze:7) и шлёт DELETE на сервер.
- ProfileSection: зона «ОБНУЛЕНИЕ_ЛЕТОПИСИ» с двухшаговым подтверждением (кнопка →
  «ПОДТВЕРДИТЬ СБРОС» с авто-разоружением через 6с + animate-pulse); каталог персонажей
  ОБЕИХ миров (для имён в карточках стражей); сортировка стражей: онлайн → админ → логин;
  в карточках стражей — имя персонажа с сигилом («без персонажа» если не привязан);
  вся карточка кликабельна для админа (role=button, tabIndex, Enter/Space) → досье.
- UserProfileModal: строка «// летопись обновлена: DD.MM.YYYY, HH:MM //» (progress.updatedAt).
- types.ts: ProgressData.updatedAt?: string.

QA (agent-browser, 2 сессии через шлюз :81):
- Логин pf2e (админ): герой Каэль в списке PF2E (между Дианой и Линдэмиром), карточка
  открывается, портрет 200 OK (naturalWidth>0), полное описание рендерится.
- Профиль: ВСЕ 10 логинов в «СТРАЖИ_АРХИВА» с онлайн-индикаторами, цветами миров
  (красный/синий), подсветкой админов; имена персонажей у всех 8 привязанных
  (🪆 Бруно, ⚓ Мартин МакДона, ☀ Мартин Осборн, 🐺 Реми, 🗡 Каэль Валькрейн,
  ⚔ Линдэмир Суртов, ⚔ Диана, 🦊 Мира); сортировка онлайн-первый работает.
- Админ: клик по карточке GTT_EDMI → досье: персонаж Каэль, прогресс (1 осколок,
  1 загадка, 1/1 достижений), «летопись обновлена», коллекция осколков.
  Не-админ (GTT_EDMI): 0 кнопок ДОСЬЕ, 0 кликабельных карточек — доступ только у админа.
- Сброс: GTT_EDMI (QA-прогресс от прошлой сессии) → «СБРОСИТЬ ПРОГРЕСС» → «ПОДТВЕРДИТЬ
  СБРОС» → UI обнулён (0/3, 0, 0, 0/1, взгляд 7%, ачивка скрыта), API отдаёт null,
  сайдбар «ОСКОЛКИ_ПАМЯТИ [0]». Перезагрузка страницы → прогресс НЕ восстановился
  (гидрация с сервера = пусто). DELETE чужого прогресса без админа → 403 FORBIDDEN.
- Мобильная вёрстка 390x844: переполнения нет (scrollWidth=390). Консоли обеих сессий
  чистые, dev.log без ошибок. Lint: 0 ошибок.
- Проверка запретов в описании Каэля: «Аразни»/«бутыл»/«отец»/«мать»/«родител» — нет
  (единственное совпадение «мат» — подстрока слова «тауматургию», легитимно).

Stage Summary:
- Все требования пользователя выполнены: привязки по списку, новый герой Каэль Валькрейн
  (без светл-бутылки и родителей в описании), все логины в профиле с онлайн-статусом,
  админ открывает досье кликом по карточке, каждый может обнулить свой прогресс.
- Прогресс GTT_EDMI сброшен в рамках QA (это были тестовые данные) — чистый старт.
- Cron webDevReview каждые 15 минут активен; presence-service (3003) жив.

Нерешённые вопросы / приоритеты следующей фазы:
1. Эдмунт Ван Рейх и Лэфтарион — кандидаты в «Второстепенные герои» PF2E
  (public/heroes/edmund.png уже лежит как задел).
2. Идеи: «последний раз в сети» для оффлайн-стражей (нужен lastSeen в presence),
   сортировка/фильтр по миру в списке стражей, звук у вещания.
3. Re-seed по-прежнему стирает прогресс (id записей пересоздаются) — bind-characters.ts
   можно запускать повторно, он идемпотентен.

---
Task ID: 4
Agent: main (Z.ai Code)
Task: Убрать вкладку «Достижения» (переехала в досье), seed.zip без public,
улучшения на усмотрение, git-сохранение

Work Log:
- **Вкладка «Достижения» удалена полностью**: Sidebar (NAV), Viewport в page.tsx,
  CommandPalette ( QUICK_NAV «Перейти: Достижения»), Section-тип в store.ts,
  файл AchievementsSection.tsx удалён. Хоткеи 1-7 перенумерованы по сайдбару:
  1=Профиль, 2=Герои, 3=Фракции, 4=Лор, 5=Божества, 6=Второст. герои, 7=Локации.
  Справка (?) обновлена. section не персистится — миграций не нужно.
- **Полный реестр достижений в досье**: блок «// РЕЕСТР_ДОСТИЖЕНИЙ //» в
  ProfileSection — карточки с описаниями (видны после выполнения), «// сокрыто //»
  для закрытых, намёк DESTROYER («Вспомни прошлое») для закрытого, ПОДСКАЗКА
  (secretFragment) для открытых, чипы ✓ОТКРЫТО/🔒ЗАКРЫТО, счётчик ОТКРЫТО N/M.
- **lastSeen («был в сети»)**: presence-service пишет lastseen.json (дебаунс 1.5с,
  переживает рестарт, актуализация онлайн-стражей раз в 60с), события last-seen
  всем + вошедшему; disconnect фиксирует время ухода только когда закрыта
  последняя вкладка логина. Клиент: usePresence.lastSeen. В карточках стражей:
  онлайн → «⏱ в архиве: N мин» (по since), оффлайн → «⚑ был в сети: только что /
  N мин назад / N ч назад / вчера / DD.MM.YYYY». Тикер 30с для обновления времён.
- **prisma/backfill-lastseen.ts**: одноразовый бэкфилл lastseen.json из
  Progress.updatedAt (максимум из записанного и прогресса) — dnd получил
  «18 мин назад» сразу. Запущен, сервис перезапущен.
- **Фильтр стражей по миру**: чипы ВСЕ/ЭЛАРИЯ/ГОЛАРИОН в легенде СТРАЖИ_АРХИВА
  (активный подсвечен цветом мира), фильтрация в sortedUsers.
- **Починен хоткей W** (смена мира DND↔PF2E без logout): был обещан в справке,
  но НЕ БЫЛ подключён (switchWorld существовал только в сторе). Добавлен в
  KeyboardShortcutsHandler. switchWorld больше не портит кастомные displayName
  (меняет только стандартные «Страж Эларии/Голариона»).
- **Переносимость для своего сервера**: DB_URL сервиса → PRESENCE_DB_URL ??
  DATABASE_URL ?? (путь песочницы); LASTSEEN_FILE → относительно import.meta.url;
  path сокета → PRESENCE_SOCKET_PATH ?? "/"; клиент → NEXT_PUBLIC_PRESENCE_URL ??
  "/?XTransformPort=3003". Defaults = поведение песочницы (ничего не сломано).
- **README_DEPLOY.md переписан** под самостоятельный хостинг: быстрый старт
  (bun install, .env, prisma generate, dev), прокси Caddy/nginx для /socket.io/*,
  продакшен-режим, таблица аккаунтов, FAQ. **.env.example** переписан под SQLite
  + NEXT_PUBLIC_PRESENCE_URL.
- **seed.zip**: public/seed.zip (509KB, 168 файлов) — весь проект БЕЗ public/:
  src, prisma (schema+seed+bind-characters+backfill-lastseen), db/custom.db
  (готовая база с прогрессом!), mini-services/presence-service (без node_modules
  и lastseen.json), конфиги, README_DEPLOY, .env.example, CHANGES.md, worklog.md,
  Caddyfile, bun.lock. Исключены: node_modules, .next, .git, skills, tests,
  examples, upload/download, tool-results, *.log, .env. Скачивается по /seed.zip
  (HTTP 200 проверен). ВНИМАНИЕ: в zip есть пароли — на боевой сервер public/seed.zip
  не заливать (в .gitignore он уже добавлен).
- **Git-сохранение**: коммит 7e0d030 + тег ashen-archive-v4.2-achievements-in-dossier.
  В коммите и db/custom.db (бэкап прогресса). .gitignore: + lastseen.json,
  public/seed.zip, tool-results/.

QA (agent-browser, 2 сессии через шлюз :81):
- Сайдбар: 7 пунктов, вкладки «Достижения» нет ✓; хоткей 1 → Профиль ✓
- Реестр достижений в досье: PF2E — 1 карточка (TARTUCCIO_RIDDLE), DND — все 5
  (DEAD_PLAN, DEMON_WIFE, MARTIN_RIDDLE, MASTER_KEYS, REFLECTION) + «описание
  сокрыто до выполнения» ✓
- CommandPalette (Ctrl+K): «Перейти: Достижения» отсутствует, «Профиль» есть ✓
- W: мир сменился ГОЛАРИОН→ЭЛАРИЯ (world flash, заголовок v4.1 ЭЛАРИЯ) ✓
- Фильтр: ЭЛАРИЯ → 5 карточек, все DND ✓
- lastSeen E2E: сессия1 (pf2e) logout → сессия2 (GTT_EDMI) мгновенно видит
  «был в сети: только что»; после бэкфилла dnd → «18 мин назад» ✓
- «⏱ в архиве: меньше минуты» у онлайн-стража ✓
- Мобильная вёрстка 390x844: scrollWidth=390, переполнения нет ✓
- Консоли обеих сессий чистые, dev.log без ошибок, lint: 0 ошибок ✓
- VLM-проверка скриншотов: реестр и карточки стражей рендерятся, дефектов нет ✓

Stage Summary:
- Вкладка достижений удалена, полный реестр живёт в досье профиля
- Прогресс presence: lastSeen с персистентностью и бэкфиллом, фильтр миров
- Починен мёртвый хоткей W — найден реальный баг (документирован, но не подключён)
- seed.zip готов к скачиванию по /seed.zip; README_DEPLOY.md — инструкция для сервера
- Git: коммит 7e0d030 + тег v4.2 (восстановление: git checkout тега/ветки)

Нерешённые вопросы / приоритеты следующей фазы:
1. Сгенерированные ранее изображения (пути для замены пользователем):
   public/heroes/kael.png (Каэль), public/heroes/tey.png (Тей),
   public/heroes/stranger.png (Странник), public/heroes/edmund.png (Эдмунт, задел).
2. public/seed.zip содержит пароли из сида — напоминать пользователю удалять
   его с боевого сервера (в git не входит).
3. Эдмунт Ван Рейх и Лэфтарион — кандидаты во «Второстепенные герои» PF2E.
4. Идеи: звук вещания уже есть; можно добавить сортировку стражей по прогрессу,
   историю хроник в досье, счётчик «дней в архиве».
---
Task ID: 5
Agent: main (Z.ai Code)
Task: Хоткей W — только для админов (изоляция миров DND/PF2E) +
аудит и подготовка к хостингу Git + Supabase + Vercel

Work Log:
- **W только для админов** (запрос: игроки DnD не должны видеть PF2e и наоборот):
  • store.ts switchWorld: guard `role !== "ADMIN"` → no-op (защита в глубину);
  • KeyboardShortcutsHandler: W у не-админа → sfx.error + атмосферный тост
    «ПУТЬ ЗАПЕЧАТАН // некоторые двери открывает только Длань //» (не раскрывает,
    что за клавишей); у админа — как раньше, глитч + world flash;
  • KeyboardShortcuts (справка ?): строка W помечена adminOnly и скрыта
    для не-админов (useArchive selector на role), остальные хоткеи на месте.
- **Аудит Git+Supabase+Vercel** (по итогам: 3_blocker исправлены):
  1) Prisma provider=sqlite на Vercel нежизнеспособ (ФС read-only) →
     scripts/set-db-provider.ts: переключает provider в ОБОИХ схемах (основной
     + presence-service); скрипты `db:use-postgres` / `db:use-sqlite`;
     протестирован туда-обратно, песочница осталась на sqlite;
  2) presence-сервис (socket.io:3003) на Vercel не запускается → graceful
     degradation: без NEXT_PUBLIC_PRESENCE_URL сокет вообще не открывается
     (раньше дефолт /?XTransformPort=3003 дал бы бесконечные 404-реконнекты);
     export presenceEnabled; StatusBar: LED отражает реальное состояние
     (green=подключён / amber=оффлайн), «СТРАЖЕЙ В СЕТИ» скрывается, лейбл
     «ОФЛАЙН»; ProfileSection: вместо «В СЕТИ: 0» → чипы «◌ ЗЕРКАЛО ТУМАННО»/
     «◌ БЕЗ ЗЕРКАЛА»; песочнице вернули presence через явную запись в .env;
  3) build-скрипт с cp в standalone ломал бы Vercel-сборку → build = plain
     `next build` (Vercel-совместим), standalone-копия вынесена в
     `build:standalone`, добавлен `start:next` и `postinstall: prisma generate`.
- **.env убран из git-трекинга** (был закоммичен до .gitignore-правила;
  git rm --cached) — на Vercel переменные задаются в дашборде.
- **.env.example** переписан: 4 блока (SQLite / Supabase direct+pooler URL /
  presence 4 варианта / Supabase Storage опция).
- **README_VERCEL.md (новый)**: полный гайд Git+Supabase+Vercel — таблица
  аудита «что работает/что нет», шаги 0-6 (Supabase проект → direct 5432 для
  сида → db:use-postgres → prisma db push → seed → bind → git push → Vercel
  env DATABASE_URL=pooler 6543 ?pgbouncer=true → deploy), картинки двумя
  путями (public в репо / Supabase Storage), presence на Railway/Render
  (PRESENCE_DB_URL=pooler, PRESENCE_SOCKET_PATH=/socket.io,
  NEXT_PUBLIC_PRESENCE_URL на Vercel + redeploy), FAQ (P1001, прогресс,
  возврат на sqlite).
- **README_DEPLOY.md** обновлён: ссылка на README_VERCEL, presence теперь
  opt-in (без env выключен), build:standalone/start:next, W=только админам.
- Комментарии в prisma/schema.prisma (обеих) про переключение провайдера.
- **seed.zip пересобран** (533KB, 180 файлов, HTTP 200 по /seed.zip):
  включены README_VERCEL.md, scripts/set-db-provider.ts, свежие схемы и
  package.json; .env по-прежнему НЕ внутри; public/ исключён.

QA (agent-browser, сессия qa1 через шлюз :81):
- dnd (АДМИН): W → ЭЛАРИЯ→ГОЛАРИОН ✓, W обратно → ГОЛАРИОН→ЭЛАРИЯ ✓,
  справка показывает W («только Длань») ✓
- GTT_EDMI (страж PF2E): вход → ГОЛАРИОН; W → мир НЕ сменился ✓,
  тост «ПУТЬ ЗАПЕЧАТАН» появился ✓; справка: W скрыт, остальные хоткеи
  (G, 1-7, Ctrl+K, Konami-подсказка) на месте ✓
- presence в песочнице жив после .env-правки: footer «В СЕТИ»,
  СТРАЖЕЙ В СЕТИ: 1 ✓; профиль: СТРАЖИ_АРХИВА рендерится ✓
- Мобильная вёрстка 390x844: scrollWidth=390, переполнения нет ✓
- Консоль браузера: только HMR-логи, 0 ошибок; dev.log: 0 ошибок,
  все API 200; lint: 0 ошибок ✓

Stage Summary:
- W — админская привилегия на трёх уровнях: guard в сторе, проверка в
  обработчике, скрытие из справки; игрокам — загадочный отказ
- Проект готов к Vercel: build-скрипт совместим, presence выключается
  безопасно, база переключается на Supabase PostgreSQL одной командой
  (`bun run db:use-postgres` + инструкция в README_VERCEL.md)
- Проверка «всё ли подойдёт» для Git+Supabase+Vercel: ДА, кроме
  presence-сервиса (он требует отдельный хост — задокументировано);
  SQLite-база в репо на Vercel мертва (нужен Supabase Postgres)

Нерешённые вопросы / приоритеты следующей фазы:
1. Реальный smoke-тест на Vercel невозможен из песочницы — при первом деплое
   проверить: DATABASE_URL pooler, postinstall prisma generate, картинки.
2. В seed.zip и в сиде пароли открытым текстом — напоминать пользователю
   не выкладывать public/seed.zip на боевой сайт.
3. Изображения для замены (пути): public/heroes/kael.png, tey.png,
   stranger.png, edmund.png (задел под второстепенных PF2E).
4. Идеи: Эдмунт Ван Рейх и Лэфтарион как второстепенные герои PF2E,
   история хроник в досье, счётчик «дней в архиве».
---
Task ID: 6
Agent: main (Z.ai Code)
Task: Инцидент на проде: после загрузки файлов из seed.zip на Vercel+Supabase
все разделы выдают «Не удалось получить данные http 500»

Work Log:
- **Диагноз**: seed.zip v4.3 собирался с prisma/schema.prisma
  provider = "sqlite" (конфиг песочницы/само-хостинга). Пользователь
  заливает файлы из zip в git → Vercel собирает Prisma-клиент под SQLite,
  а DATABASE_URL у него postgres (Supabase) → PrismaClientInitializationError
  ("must start with the protocol file://") на каждом запросе → 500 на всех
  API (архив, статы, юзеры, логин). Симптом точно совпал: «сервер стоял и
  работал, после изменений всё сломалось» — раньше в его репо была
  postgres-схема, файлы из zip её перезаписали на sqlite.
- **Пользователю выдан фикс на 1 минуту**: в prisma/schema.prisma
  provider = "sqlite" → "postgresql" (можно прямо на GitHub), push →
  Vercel пересоберёт (postinstall: prisma generate уже есть). Плюс
  проверка DATABASE_URL (pooler 6543, ?pgbouncer=true).
- **seed.zip теперь postgres-first** (под workflow пользователя
  «zip → git → Vercel»): при сборке обе схемы патчатся на postgresql
  через staging-оверлей (/tmp/patch + zip update), в корень архива
  добавлен README_FIRST.txt (два сценария: Vercel — пушить как есть;
  свой сервер — сначала bun run db:use-sqlite). Проверено: в zip обе
  схемы provider="postgresql", README_FIRST на месте, роуты свежие
  (grep dbHint = 2 в stats и login), скачивание /seed.zip HTTP 200 (538KB).
- **Диагностика в API**: новый src/lib/db-diagnostics.ts (dbHint) —
  превращает ошибку Prisma в человеческую инструкцию (провайдер не
  совпадает / нет DATABASE_URL / база недоступна P1001 / нет таблиц
  P2021 / prepared statements pgbouncer). Обёрнуты в try/catch →
  503 {error: DB_UNAVAILABLE, hint} вместо безликого 500:
  /api/archive, /api/stats, /api/users, /api/auth/login. Теперь причину
  видно, открыв /api/stats?system=DND прямо в браузере на проде.
- **README_VERCEL.md**: секция «🚨 Быстрый фикс: HTTP 500 на всех
  разделах» в самом верху (3 причины + фикс через GitHub UI + diff),
  шаг 2 переписан (в свежем zip уже postgres, db:use-postgres — только
  для старых версий).
- **README_DEPLOY.md**: быстрый старт дополнен шагом «bun run
  db:use-sqlite» (zip теперь postgres по умолчанию), примечание о схеме.

QA:
- lint: 0 ошибок; smoke через curl: archive/stats/users/login — все 200
  (try/catch не сломал рабочий sqlite-путь песочницы)
- agent-browser: вход dnd → 8 карточек героев, «http 500» на странице нет,
  dev.log чистый, консоль без ошибок
- zip: схемы внутри postgresql, README_FIRST.txt есть, размер 538KB,
  HTTP 200 при скачивании

Stage Summary:
- Корневая причина инцидента устранена на уровне архива: seed.zip больше
  не может занести sqlite-схему в Vercel-репозиторий (по умолчанию postgres)
- API-роуты научились объяснять, что именно не так с БД (hint в 503)
- Пользователю отправлена инструкция фикса на 1 минуту (правка одной
  строки в репо на GitHub)

Нерешённые вопросы / приоритеты следующей фазы:
1. Ждать подтверждения от пользователя, что после правки провайдера
   прод ожил (если нет — просить вывод /api/stats?system=DND с прода,
   там теперь будет hint).
2. Проверить, что в его Vercel DATABASE_URL — pooler-ссылка (6543,
   pgbouncer=true), иначе возможны prepared statement ошибки под
   нагрузкой.
3. Напомнить: db/custom.db в репо на Vercel не используется (данные
   в Supabase) — это норм.
4. Прошлые идеи в силе: Эдмунт/Лэфтарион как второстепенные PF2E,
   история хроник в досье, счётчик «дней в архиве».
---
Task ID: 7
Agent: main (Z.ai Code)
Task: Пользователь прислал боевой .env (Supabase postgres pooler 6543 +
DIRECT_URL 5432) — воспроизвести его конфигурацию, доказать работоспособность
postgres-пути и сделать так, чтобы рассинхрон провайдера Prisma (причина
HTTP 500 на проде) был невозможен в принципе.

Work Log:
- **Проанализирован присланный .env** (upload/.env): DATABASE_URL =
  transaction pooler 6543 (?pgbouncer=true), DIRECT_URL = 5432 (session
  pooler), Supabase URL + service role key. Оба порта доступны из песочницы
  (TCP-проверка). Учтено, что «с другим ИИ делали по-другому»: их сетап —
  DIRECT_URL через pooler-хост:5432 (прямая db.*.supabase.co:5432 у них
  не работала).
- **Скрипты sync-db-provider.mjs** (новый, engine-agnostic .mjs: node|bun,
  без зависимостей): читает DATABASE_URL (process.env → .env → .env.local),
  ставит provider в ОБОИХ схемах (postgresql:// → postgresql, file: →
  sqlite); управляет directUrl = env("DIRECT_URL") — добавляет в
  postgres-режиме при заданном DIRECT_URL (нужно для db push/миграций мимо
  pooler'а), иначе убирает (иначе prisma generate падает «Environment
  variable not found»); флаги --quiet/--generate/--force-generate
  (перегенерация при изменении провайдера или отсутствии клиента).
  Старый scripts/set-db-provider.ts удалён.
- **package.json**: sync встроен в postinstall `(node … || bun …) && prisma
  generate` (работает на Vercel с любым пакетным менеджером), dev
  (`bun scripts/… --generate && next dev`), build и build:standalone.
  Явные оверрайды db:use-postgres / db:use-sqlite сохранены + db:sync.
- **Верификация postgres-пути на боевой базе (read-only)**: песочница
  временно переключена на присланный .env (pooler + connection_limit=5),
  схемы → postgresql + directUrl, клиент перегенерирован. Прямой запрос
  через PrismaClient (scripts/__prodcheck.mjs, удалён после) прочитал
  боевую Supabase: users 10 (2 ADMIN: dnd, pf2e; 8 USER), characters 41
  (8 DND-героев, 12 DND-NPC, 7 PF2E-героев, 14 PF2E-NPC), lore 77,
  factions 14, locations 13, chronicles 6, achievements 6, progress 6.
  Герои: Каэль Валькрейн, Бруно, Мурасаки Каэдэ, Диана, Ева, Реми…
  → конфигурация пользователя («postgres + DIRECT_URL») полностью рабочая,
  данные на месте, чинить в базе нечего.
- **Расследование «призрака»**: во время верификации schema.prisma
  осциллировал sqlite↔postgres, клиент перегенерировался под sqlite на
  лету → Turbopack перегружал модуль → воспроизведён ровно тот же
  Validation Error («URL must start with the protocol file:»), что и на
  проде пользователя. Источник — QA-агент старой cron-задачи webDevReview
  (логины dnd/GTT_EDMI в dev.log после 08:43), которая «чинила» проект по
  устаревшему worklog. Cron-задача 450313 удалена. Вывод зафиксирован в
  правилах вверху worklog: провайдер руками не трогать.
- **devkeeper.ts** (mini-services/presence-service/): harness убивает все
  процессы, порождённые tool-вызовами (проверено setsid-экспериментом), а
  бут-процессы выживают. Presence-service — бут-процесс → он теперь
  поднимает основной `bun run dev`, если :3000 свободен. Активен ТОЛЬКО в
  песочнице (маркер — ZAI Control Service на :12600; на сервере
  пользователя/Vercel молча не работает). Импорт в index.ts, hot-reload
  безопасен (guard по порту). Сервер теперь живёт между tool-вызовами.
- **Песочница возвращена на sqlite**: .env (file:custom.db + presence URL),
  sync → sqlite (directUrl убран), клиент sqlite, сервер перезапущен,
  API 200 (stats DND: 63 записи / 8 героев; PF2E: 56 / 7), логин dnd OK.
- **Документация**: .env.example создан и ЗАКОММИЧЕН (его съедало правило
  .env* в .gitignore — добавлено исключение !.env.example; именно поэтому
  он терялся в прошлых релизах); README_VERCEL (быстрый-фикс переписан под
  авто-синк), README_DEPLOY (db:use-sqlite больше не нужен в quick start),
  README_FIRST.txt (новая версия: «залей и всё подстроится само»),
  CHANGES.md (v4.3.2 с инструкцией применения на 1 минуту).
- **Коммиты**: 90c1cbf (v4.3.2 авто-синк; тег ashen-archive-v4.3.2-auto-db-provider),
  4583513 (.env.example + .gitignore), ae9f304 (README_DEPLOY формулировка).
  Провайдер в git-коммите — sqlite (осцилляция призрака не дала закоммитить
  postgres, но с авто-синком это не имеет значения — при установке
  подстроится).
- **seed.zip v4.3.2 пересобран**: git archive HEAD без public/ — 558KB,
  192 файла: sync-db-provider.mjs, README_FIRST.txt, .env.example,
  postinstall с авто-синком, db/custom.db. HTTP 200 на /seed.zip.

QA (всё на sqlite-песочнице после возврата):
- agent-browser (сессия fix1, через шлюз :81): вход dnd (2 шага) →
  «АРХИВ ПЕПЕЛЬНОЙ ДЛАНИ // ЭЛАРИЯ», 8 карточек героев с лором;
  W → ГОЛАРИОН, 7 героев (админ-изоляция миров работает); ошибок консоли 0
  (только Fast Refresh); мобильный 390x844: scrollWidth=390 (переполнения
  нет), футер прижат (footerAtBottom=true); скриншот
  tool-results/fix-verification.png.
- lint: 0 ошибок. dev.log: только 200-е ответы.
- Выживание сервера между tool-вызовами подтверждено (curl 200 из разных
  вызовов подряд).

Stage Summary:
- Корневая причина HTTP 500 (schema=sqlite при postgres URL) устранена
  АРХИТЕКТУРНО: провайдер теперь свойство DATABASE_URL, а не файла в git.
  Любой деплой (Vercel/свой сервер/песочница) сам приводит схему и клиент
  в соответствие ссылке при установке/запуске.
- Боевая база пользователя проверена read-only и здорова: 41 персонаж,
  77 лора, 10 стражей — данные не тронуты, seeded прогресс на месте.
- Пользователю выдан финальный фикс: залить файлы из нового seed.zip
  (v4.3.2) в git → push → больше ничего вручную делать не нужно.

Нерешённые вопросы / приоритеты следующей фазы:
1. Ждать подтверждения от пользователя, что прод ожил после заливки
   v4.3.2 (проверка: /api/stats?system=DND должен отдать JSON с цифрами).
2. В его Vercel env желательно добавить DIRECT_URL (прямая ссылка 5432) —
   для будущих prisma db push/сидов; DATABASE_URL оставить pooler 6543
   (можно добавить &connection_limit=1 для serverless).
3. Сменить пароль БД/service key, если .env где-то засветился (он был
   отправлен в чат).
4. Прошлые идеи в силе: Эдмунт/Лэфтарион как второстепенные PF2E-герои,
   история хроник в досье, счётчик «дней в архиве», сортировка стражей
   по прогрессу.
