#!/usr/bin/env node
// ============================================================================
// ENSURE-SEED — самолечение public/seed.zip (архив проекта для скачивания).
//
// ЗАЧЕМ: seed.zip в песочнице фантомно исчезал уже трижды (снапшот-рестор
// harness'а откатывает public/ к старому состоянию и стирает свежий файл).
// Ручная пересборка каждый раз — «bun run make-seed» — надоедает. Этот
// скрипт встроен в цепочку `bun run dev` (см. package.json): при каждом
// старте дев-сервера (включая автоподъём сторожем devkeeper) архив
// пересобирается автоматически, если файла нет.
//
// КАК РАБОТАЕТ:
//   1. public/seed.zip существует → тихо выходим (код 0);
//   2. файла нет → запускаем scripts/make-seed-zip.mjs тем же раннером;
//   3. ЛЮБАЯ ошибка (нет zip-бинарника, read-only FS на Vercel и т.п.)
//      печатается предупреждением, но НЕ ломает старт dev (код 0 всегда).
//
// Запуск: node scripts/ensure-seed.mjs   (или bun scripts/ensure-seed.mjs)
// Подключён в package.json → dev (перед sync-db-provider).
// ============================================================================

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED = join(ROOT, "seed-archive", "seed.zip");
const MAKER = join(ROOT, "scripts", "make-seed-zip.mjs");

try {
  if (existsSync(SEED)) process.exit(0);

  // файла нет — фантом снова побывал здесь; пересобираем
  console.log("[ensure-seed] seed-archive/seed.zip отсутствует — пересобираю…");

  // раннер: под bun — сам bun, под node — node (execPath)
  const r = spawnSync(process.execPath, [MAKER], {
    cwd: ROOT,
    stdio: "inherit",
    timeout: 120000,
  });

  if (r.status === 0 && existsSync(SEED)) {
    console.log("[ensure-seed] архив восстановлен.");
  } else {
    console.warn(
      "[ensure-seed] пересобрать не удалось (не критично для dev; вручную: bun run make-seed).",
    );
  }
} catch (e) {
  // страховка: этот скрипт НИКОГДА не должен ронять старт дев-сервера
  console.warn(`[ensure-seed] неожиданная ошибка (продолжаю): ${e?.message ?? e}`);
}

process.exit(0);
