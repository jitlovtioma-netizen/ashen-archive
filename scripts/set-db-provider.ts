// ============================================================================
// SET DB PROVIDER — переключает провайдер Prisma между SQLite и PostgreSQL.
//
// Зачем: песочница и самостоятельный хостинг используют локальную SQLite-базу
// (db/custom.db), а деплой на Vercel + Supabase требует PostgreSQL — у Vercel
// файловая система только на чтение, SQLite там не выживает. Prisma жёстко
// прописывает provider в schema.prisma, поэтому переключаем скриптом.
//
// Скрипт правит ОБОЕ схемы: основного проекта и mini-services/presence-service
// (если решишь хостить сервис онлайна отдельно на общей базе Supabase —
// там тоже должен быть postgres).
//
// Использование:
//   bun run db:use-postgres   → provider = "postgresql"  (Supabase + Vercel)
//   bun run db:use-sqlite     → provider = "sqlite"      (песочница / свой сервер)
//
// ВАЖНО: переключение меняет кодогенерацию клиента. После смены провайдера
// обязательно выполни `bunx prisma generate` (и в папке presence-service,
// если используешь её). Подробности: README_VERCEL.md.
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const SCHEMAS = [
  join(process.cwd(), "prisma", "schema.prisma"),
  join(process.cwd(), "mini-services", "presence-service", "prisma", "schema.prisma"),
];

const arg = process.argv[2];
if (arg !== "sqlite" && arg !== "postgres") {
  console.error(
    "✘ Использование: bun run scripts/set-db-provider.ts <sqlite|postgres>\n" +
      "  db:use-sqlite   — локальная база (песочница, свой сервер)\n" +
      "  db:use-postgres — Supabase PostgreSQL (деплой на Vercel)",
  );
  process.exit(1);
}

const provider = arg === "postgres" ? "postgresql" : "sqlite";
let changed = 0;

for (const file of SCHEMAS) {
  if (!existsSync(file)) {
    console.warn(`⊘ ${file} не найден — пропуск`);
    continue;
  }
  const text = readFileSync(file, "utf-8");
  if (!/provider\s*=\s*"(sqlite|postgresql)"/.test(text)) {
    console.warn(`⚠ ${file}: строка provider не распознана — файл не тронут`);
    continue;
  }
  writeFileSync(
    file,
    text.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`),
  );
  console.log(`✓ ${file}\n    → provider = "${provider}"`);
  changed++;
}

if (changed === 0) {
  console.error("✘ Ни одна схема не изменена.");
  process.exit(1);
}

if (provider === "postgresql") {
  console.log(`
┌──────────────────── СЛЕДУЮЩИЕ ШАГИ (Supabase + Vercel) ────────────────────┐
│ 1. В .env временно поставь DIRECT-ссылку Supabase (порт 5432):              │
│      DATABASE_URL=postgresql://postgres:ПАРОЛЬ@db.REF.supabase.co:5432/postgres │
│  2. bunx prisma db push            ← создать таблицы в Supabase             │
│  3. bun run db:seed                ← залить записи архива                   │
│  4. bun run prisma/bind-characters.ts  ← привязки персонажей                │
│  5. bunx prisma generate           ← пересобрать клиент                     │
│  6. СКОММИТЬ schema.prisma (provider=postgresql) и запушь в Git —           │
│     Vercel соберёт сайт с postgres-клиентом.                                │
│  7. В Project Settings → Environment Variables (Vercel) добавь              │
│     DATABASE_URL = transaction-pooler URL (порт 6543, ?pgbouncer=true).     │
│ Подробно: README_VERCEL.md                                                  │
└─────────────────────────────────────────────────────────────────────────────┘`);
} else {
  console.log(`
✓ Провайдер возвращён на SQLite (локальная база).

  1. В .env поставь DATABASE_URL=file:/абс/путь/к/db/custom.db
  2. bunx prisma generate && bun run dev

  Подробнее: README_DEPLOY.md`);
}
