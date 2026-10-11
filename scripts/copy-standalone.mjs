#!/usr/bin/env node
// ============================================================================
// COPY-STANDALONE — кроссплатформенная замена Unix-команд cp -r для
// build:standalone (Next.js output: "standalone").
//
// ЗАЧЕМ: после `next build` standalone-сервер лежит в .next/standalone,
// но БЕЗ статики (.next/static) и public/ — их нужно докопировать рядом.
// Раньше это делали две Unix-команды `cp -r …`, которые на Windows
// падают («cp: illegal option -- r» — cp в PATH не умеет -r, а то и
// вовсе не существует), роняя build:standalone УЖЕ ПОСЛЕ успешной
// сборки (инцидент v4.3.7, Windows). Node/fs.cpSync работает везде,
// где есть node или bun, независимо от shell и ОС.
//
// ЧТО ДЕЛАЕТ (эквивалент старых команд):
//   .next/static  →  .next/standalone/.next/static
//   public/       →  .next/standalone/public
//
// ЗАПУСК (engine-agnostic: node или bun, без зависимостей):
//   node scripts/copy-standalone.mjs
//   bun  scripts/copy-standalone.mjs
//
// Подключён в package.json: build:standalone (после next build).
// ============================================================================

import { existsSync, mkdirSync, cpSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => relative(ROOT, p);

const STANDALONE = join(ROOT, ".next", "standalone");

// [откуда, куда] — порядок как в старых cp-командах
const STEPS = [
  [join(ROOT, ".next", "static"), join(STANDALONE, ".next", "static")],
  [join(ROOT, "public"), join(STANDALONE, "public")],
];

if (!existsSync(STANDALONE)) {
  console.error("✘ .next/standalone не найден — сначала собери проект:");
  console.error("    bun run build:standalone   (next build с output: \"standalone\")");
  process.exit(1);
}

for (const [from, to] of STEPS) {
  if (!existsSync(from)) {
    console.error(`✘ не найден источник: ${rel(from)} — сборка прошла без него?`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`✓ ${rel(from)} → ${rel(to)}`);
}

console.log("✓ standalone-файлы на месте. Запуск: bun run start (порт 3000)");
