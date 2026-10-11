#!/usr/bin/env node
// ============================================================================
// CHECK-DEPS — предсборочная проверка зависимостей (самолечение node_modules).
//
// ЗАЧЕМ: при обновлении файлов архива поверх старой установки node_modules
// остаётся от СТАРОЙ версии — новые версии проекта импортируют пакеты,
// которых в старой установке нет (например, presence-модуль добавил
// socket.io-client). next build / next dev падают посреди сборки с
// «Module not found: Can't resolve 'socket.io-client'» — плохо читаемая
// ошибка, если не знать причину (инцидент v4.3.6, Windows: файлы v4.3.5
// поверх node_modules от v4.2).
//
// КАК РАБОТАЕТ:
//   1. читает dependencies из package.json (devDependencies — только с
//      флагом --include-dev: для build они не нужны, а на боевых серверах
//      их осознанно не ставят);
//   2. проверяет наличие каждого пакета в node_modules;
//   3. если всё на месте — тихо выходит (код 0);
//   4. если чего-то нет — печатает понятную причину и ДОУСТАНАВЛИВАЕТ
//      сам: bun install (если есть bun) или npm install;
//   5. после установки перепроверяет; если пакета всё ещё нет — код 1 с
//      ручной инструкцией.
//
// Флаги: --quiet (минимум вывода), --check-only (только проверить,
//        ничего не ставить — для CI), --include-dev (проверять и devDeps).
//
// ЗАПУСК (engine-agnostic: node или bun, без зависимостей):
//   node scripts/check-deps.mjs            → проверить и доустановить
//   bun  scripts/check-deps.mjs            → то же самое
//
// Подключён в package.json: dev, build, build:standalone (перед next …).
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const quiet = argv.includes("--quiet");
const checkOnly = argv.includes("--check-only");
const includeDev = argv.includes("--include-dev");

const log = (...a) => { if (!quiet) console.log(...a); };

// --- Список ожидаемых пакетов ------------------------------------------------
let pkg;
try {
  pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
} catch (e) {
  console.error(`✘ Не удалось прочитать package.json: ${e.message}`);
  process.exit(1);
}

const wanted = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...(includeDev ? Object.keys(pkg.devDependencies ?? {}) : []),
];

if (wanted.length === 0) {
  log("= dependencies пусты — проверять нечего");
  process.exit(0);
}

// Пакет «установлен», если существует node_modules/<name>/package.json.
// Для scoped-имён (@scope/pkg) путь разбирается по сегментам.
const isInstalled = (name) =>
  existsSync(join(ROOT, "node_modules", ...name.split("/"), "package.json"));

const missing = wanted.filter((n) => !isInstalled(n));

if (missing.length === 0) {
  log(`= Зависимости на месте (${wanted.length} пакетов) — ок`);
  process.exit(0);
}

// --- Чего-то не хватает -------------------------------------------------------
log(`⚠ Не хватает пакетов в node_modules (${missing.length}):`);
for (const n of missing) log(`    · ${n}`);
log("");
log("  ПРИЧИНА: файлы проекта обновлены, а node_modules — нет (зависимости");
log("  ставятся только командой install, простая замена файлов их НЕ обновляет).");
log("  Новые версии проекта используют пакеты, которых не было в старой установке.");
log("");

if (checkOnly) {
  console.error("✘ Запущено с --check-only: доустановка пропущена.");
  console.error("  Запусти вручную:   bun install   (или npm install)");
  process.exit(1);
}

// --- Доустановка --------------------------------------------------------------
const isBun = !!(process.versions && process.versions.bun);
const isWin = process.platform === "win32";

function probe(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "ignore", shell: isWin, timeout: 30000 });
  return r.status === 0 && !(r.error && r.error.code === "ENOENT");
}

// Порядок: текущий раннер → bun → npm. Под bun используем process.execPath
// (точно этот же бинаррь), под node пробуем bun из PATH, затем npm.
const installers = [];
if (isBun) installers.push({ label: "bun install", cmd: process.execPath, args: ["install"] });
else {
  if (probe("bun", ["--version"])) installers.push({ label: "bun install", cmd: "bun", args: ["install"], shell: isWin });
  if (probe("npm", ["--version"])) installers.push({ label: "npm install", cmd: "npm", args: ["install"], shell: isWin });
}

if (installers.length === 0) {
  console.error("✘ Не найден ни bun, ни npm — доустановить зависимости нечем.");
  console.error("  Установи bun (https://bun.sh) или Node.js, затем:   bun install");
  process.exit(1);
}

let installed = false;
for (const ins of installers) {
  log(`→ Доустановка зависимостей: ${ins.label} …`);
  const r = spawnSync(ins.cmd, ins.args, { stdio: "inherit", cwd: ROOT, shell: !!ins.shell });
  if (r.status === 0) { installed = true; break; }
  const notFound = r.error && r.error.code === "ENOENT";
  log(`  ⊘ ${ins.label}: ${notFound ? "раннер не найден" : "завершился с ошибкой"}${installers.indexOf(ins) < installers.length - 1 ? " — пробую другой способ…" : ""}`);
}

// --- Контрольная перепроверка --------------------------------------------------
const stillMissing = wanted.filter((n) => !isInstalled(n));
if (stillMissing.length > 0) {
  console.error(`✘ После установки всё ещё не хватает: ${stillMissing.join(", ")}`);
  console.error("  Запусти вручную:   bun install   (или npm install)");
  console.error("  и повтори сборку.");
  process.exit(1);
}

if (!installed) {
  // Установка не выполнялась/не удалась, но пакеты на месте (кто-то поставил
  // параллельно) — не мешаем.
  log("= Пакеты уже на месте — продолжаю.");
  process.exit(0);
}

log("");
log(`✓ Зависимости доустановлены. Продолжаю…`);
