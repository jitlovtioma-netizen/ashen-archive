#!/usr/bin/env node
// ============================================================================
// MAKE-SEED-ZIP — собирает seed-archive/seed.zip (архив проекта для деплоя
// вручную).
//
// Состав (сверяйся с историей: точно как в v5.1/v5.2):
//   • корень: конфиги, доки (CHANGES/README_*), worklog.md, db/custom.db
//   • prisma/ (seed.ts, schema.prisma, вспомогательные скрипты)
//   • scripts/, src/, mini-services/presence-service (без node_modules)
//   • public/: только logo.svg и robots.txt (картинки героев — у владельца
//     в Supabase/своём хранилище, видео не влезают)
//
// ВАЖНО-1: seed.zip содержит БД с паролями → в git НЕ входит (.gitignore).
// Раздаётся через /api/seed?t=<одноразовый токен> (только админам).
//
// ВАЖНО-2 (v5.7.1, «фантом»): файл БОЛЬШЕ НЕ кладётся в public/ — dev-сервер
// Next.js (Turbopack) периодически стирал свежесозданный архив из public/
// в течение секунды после создания (зарегистрировано минимум 4 раза за
// v5.5–v5.7). Теперь архив живёт в seed-archive/ у корня проекта — вне
// зоны ответственности статик-вотчера — и раздаётся API-роутом.
//
// Запуск: node scripts/make-seed-zip.mjs   (или bun scripts/make-seed-zip.mjs)
// ============================================================================

import { existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { rm, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const PROJECT = import.meta.dirname
  ? join(import.meta.dirname, "..")
  : process.cwd();
const OUT_DIR = join(PROJECT, "seed-archive");
const OUT = join(OUT_DIR, "seed.zip");

// ── Что кладём ──────────────────────────────────────────────────────────────
const ROOT_FILES = [
  ".env.example",
  ".gitignore",
  "CHANGES.md",
  "Caddyfile",
  "README_DEPLOY.md",
  "README_FIRST.txt",
  "README_VERCEL.md",
  "bun.lock",
  "components.json",
  "db/custom.db",
  "eslint.config.mjs",
  "next-env.d.ts",
  "next.config.ts",
  "package.json",
  "postcss.config.mjs",
  "tsconfig.json",
  "worklog.md",
];

const DIRS = [
  { dir: "prisma", skip: [] },
  { dir: "scripts", skip: [] },
  { dir: "src", skip: [] },
  { dir: "mini-services/presence-service", skip: ["node_modules", "lastseen.json", "devkeeper.log", ".env"] },
];

const PUBLIC_ONLY = ["logo.svg", "robots.txt"];

// ── Сбор файлов ─────────────────────────────────────────────────────────────
function walk(dir, skip, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (skip.includes(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, skip, acc);
    else acc.push(full);
  }
  return acc;
}

const files = [];
for (const f of ROOT_FILES) {
  const full = join(PROJECT, f);
  if (existsSync(full)) files.push(full);
  else console.warn(`[seed.zip] нет файла: ${f} — пропускаю`);
}
for (const { dir, skip } of DIRS) {
  files.push(...walk(join(PROJECT, dir), skip));
}
for (const name of PUBLIC_ONLY) {
  const full = join(PROJECT, "public", name);
  if (existsSync(full)) files.push(full);
}

const rel = files.map((f) => relative(PROJECT, f).split(sep).join("/"));

// свежий архив: пересобираем с нуля
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(OUT)) rm(OUT, { force: true });
// рудимент эпохи public/: если где-то завалялся старый файл — приберём
const legacy = join(PROJECT, "public", "seed.zip");
if (existsSync(legacy)) rm(legacy, { force: true });

// zip -@ читает пути из stdin — 199 путей не тащим в командную строку
const res = spawnSync("zip", ["-q", "-X", OUT, "-@"], {
  cwd: PROJECT,
  input: rel.join("\n") + "\n",
  encoding: "utf-8",
});

if (res.status !== 0) {
  console.error(
    "[seed.zip] системный zip недоступен или упал. Поставьте zip (apt install zip) и повторите.",
  );
  console.error(res.stderr || res.stdout || "нет вывода");
  process.exit(1);
}

const st = statSync(OUT);
const hash = createHash("md5")
  .update(await readFile(OUT))
  .digest("hex")
  .slice(0, 10);
console.log(
  `[seed.zip] готов: seed-archive/seed.zip — ${rel.length} файлов, ${(st.size / 1024).toFixed(0)} КБ, md5:${hash}`,
);
