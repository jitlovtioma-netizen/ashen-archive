#!/usr/bin/env node
// ============================================================================
// SYNC DB PROVIDER — авто-синхронизация Prisma-провайдера с DATABASE_URL.
//
// ЗАЧЕМ: Prisma жёстко прописывает provider в schema.prisma. Если в git лежит
// sqlite, а на сервере DATABASE_URL=postgresql://... (Supabase), клиент
// собирается под SQLite и ВСЕ API падают с HTTP 500 — именно так случилось
// на проде v4.3 ("must start with the protocol file:"). Этот скрипт читает
// DATABASE_URL и сам ставит правильный provider, поэтому рассинхрон
// провайдера больше невозможен в принципе.
//
// КАК РАБОТАЕТ:
//   postgresql:// | postgres://  → provider = "postgresql"
//   file:                          → provider = "sqlite"
//   не задано / не распознано     → схемы не трогаются
//
// directUrl (только для postgres): если задан DIRECT_URL, в datasource
// добавляется directUrl = env("DIRECT_URL") — он нужен prisma db push /
// migrate для прямого соединения мимо pooler'а (Supabase: порт 5432).
// Если DIRECT_URL не задан — строка убирается, иначе prisma generate падает
// с «Environment variable not found: DIRECT_URL».
//
// Скрипт правит ОБОЕ схемы: основного проекта и mini-services/presence-service
// (клиент presence-service пересобирается отдельно, в его папке).
//
// ЗАПУСК (engine-agnostic: node или bun, без зависимостей):
//   node scripts/sync-db-provider.mjs            → авто-режим по DATABASE_URL
//   bun  scripts/sync-db-provider.mjs            → то же самое
//   ... sync-db-provider.mjs postgres            → принудительно postgresql
//   ... sync-db-provider.mjs sqlite              → принудительно sqlite
//   флаги: --quiet (меньше вывода)
//          --generate (перегенерировать клиент, если провайдер изменился
//                      или клиент ещё не собран)
//          --force-generate (перегенерировать безусловно)
//
// Подключён в package.json: postinstall, dev, build, build:standalone.
// ============================================================================

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMAS = [
  join(ROOT, "prisma", "schema.prisma"),
  join(ROOT, "mini-services", "presence-service", "prisma", "schema.prisma"),
];

const argv = process.argv.slice(2);
const quiet = argv.includes("--quiet");
const wantGenerate = argv.includes("--generate");
const forceGenerate = argv.includes("--force-generate");
const explicit = argv.find((a) => !a.startsWith("--"));

const log = (...a) => { if (!quiet) console.log(...a); };

if (explicit && explicit !== "postgres" && explicit !== "sqlite") {
  console.error(
    "✘ Использование: sync-db-provider.mjs [postgres|sqlite] [--quiet] [--generate] [--force-generate]\n" +
      "  без аргумента  — авто-детект по DATABASE_URL\n" +
      "  postgres       — принудительно provider = \"postgresql\"\n" +
      "  sqlite         — принудительно provider = \"sqlite\"",
  );
  process.exit(1);
}

// --- Окружение: process.env → .env → .env.local (последний приоритетнее) ----
function parseEnvFile(file) {
  const map = {};
  if (!existsSync(file)) return map;
  for (const raw of readFileSync(file, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') || v.startsWith("'")) {
      const q = v[0];
      const end = v.indexOf(q, 1);
      if (end > 0) v = v.slice(1, end);
    } else {
      const h = v.indexOf(" #");
      if (h > 0) v = v.slice(0, h).trim();
    }
    map[m[1]] = v;
  }
  return map;
}

const fileEnv = {
  ...parseEnvFile(join(ROOT, ".env")),
  ...parseEnvFile(join(ROOT, ".env.local")),
};
const getEnv = (name) => process.env[name] ?? fileEnv[name];

const dbUrl = (getEnv("DATABASE_URL") ?? "").trim();
const directUrl = (getEnv("DIRECT_URL") ?? "").trim();

// --- Определение целевого провайдера ----------------------------------------
let target = null;
if (explicit === "postgres") target = "postgresql";
else if (explicit === "sqlite") target = "sqlite";
else if (/^(postgresql|postgres):\/\//i.test(dbUrl)) target = "postgresql";
else if (/^file:/i.test(dbUrl)) target = "sqlite";
else if (dbUrl) log(`⚠ DATABASE_URL не похож ни на postgres://, ни на file: — схемы не тронуты`);
else log(`⚠ DATABASE_URL не задан (.env / переменные окружения) — схемы не тронуты`);

const maskUrl = (u) => u.replace(/:[^:@/"']+@/, ":***@");

if (target && !explicit) {
  log(`→ DATABASE_URL: ${maskUrl(dbUrl)}`);
  log(`→ целевой провайдер: ${target}`);
}
if (target && explicit) {
  const auto = /^(postgresql|postgres):\/\//i.test(dbUrl)
    ? "postgresql"
    : /^file:/i.test(dbUrl)
      ? "sqlite"
      : null;
  log(`→ принудительно: ${target}` + (directUrl ? ` (DIRECT_URL задан: ${maskUrl(directUrl)})` : ""));
  if (auto && auto !== target) {
    log(`⚠ ВНИМАНИЕ: DATABASE_URL выглядит как ${auto}, а выбран ${target}.`);
    log(`  Убедись, что понимаешь, что делаешь (обычно нужно наоборот).`);
  }
}

// directUrl добавляем ТОЛЬКО в postgres-режиме и только если DIRECT_URL задан
const wantDirect = target === "postgresql" && directUrl.length > 0;

// --- Патч схем ---------------------------------------------------------------
let changedAny = false;
let patched = 0;

for (const file of SCHEMAS) {
  const rel = relative(ROOT, file);
  if (!existsSync(file)) {
    log(`⊘ ${rel} не найден — пропуск`);
    continue;
  }
  const text = readFileSync(file, "utf-8");
  if (!/provider\s*=\s*"(sqlite|postgresql)"/.test(text)) {
    log(`⚠ ${rel}: строка provider не распознана — файл не тронут`);
    continue;
  }

  const curProvider = text.match(/provider\s*=\s*"(sqlite|postgresql)"/)[1];
  const nextProvider = target ?? curProvider;
  let out = text;
  let changed = false;

  if (nextProvider !== curProvider) {
    out = out.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${nextProvider}"`);
    changed = true;
  }

  const hasDirectLine = /^[ \t]*directUrl[ \t]*=[ \t]*env\("DIRECT_URL"\)[ \t]*$/m.test(out);
  if (wantDirect && !hasDirectLine) {
    out = out.replace(/(url[ \t]*=[ \t]*env\("DATABASE_URL"\))/, `$1\n  directUrl = env("DIRECT_URL")`);
    changed = true;
  } else if (!wantDirect && hasDirectLine) {
    out = out.replace(/^[ \t]*directUrl[ \t]*=[ \t]*env\("DIRECT_URL"\)[ \t]*\r?\n?/m, "");
    changed = true;
  }

  if (changed) {
    writeFileSync(file, out);
    changedAny = true;
    patched++;
    log(`✓ ${rel}: provider = "${nextProvider}"${wantDirect ? " + directUrl" : ""}`);
  } else {
    log(`= ${rel}: уже "${curProvider}"${hasDirectLine ? " + directUrl" : ""} — ок`);
  }
}

// --- Перегенерация клиента (по запросу) --------------------------------------
function runGenerate() {
  const isWin = process.platform === "win32";
  const bin = join(ROOT, "node_modules", ".bin", isWin ? "prisma.cmd" : "prisma");
  const useBin = existsSync(bin);
  const cmd = useBin ? bin : "npx";
  const args = useBin ? ["generate"] : ["prisma", "generate"];
  log(`→ prisma generate (${useBin ? "node_modules/.bin/prisma" : "npx prisma"})`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, shell: isWin });
  if (r.status !== 0) {
    console.error("✘ prisma generate завершился с ошибкой — смотри вывод выше.");
    process.exit(1);
  }
}

const clientExists = existsSync(join(ROOT, "node_modules", ".prisma", "client", "index.js"));
if (forceGenerate || (wantGenerate && (changedAny || !clientExists))) {
  runGenerate();
} else if (wantGenerate) {
  log("= prisma-клиент актуален — generate пропущен");
}

// --- Итог --------------------------------------------------------------------
if (patched > 0) {
  log("");
  log(`✓ Синхронизировано схем: ${patched}. Провайдер теперь соответствует DATABASE_URL.`);
  if (!existsSync(join(ROOT, "mini-services", "presence-service", "node_modules"))) {
    log("  (presence-service не установлен — его клиент пересоберётся при bun install в его папке)");
  }
} else if (target) {
  log("= Всё уже синхронизировано — изменений нет.");
}
