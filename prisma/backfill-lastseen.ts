// ============================================================================
// BACKFILL LASTSEEN — одноразовый скрипт.
// Заполняет mini-services/presence-service/lastseen.json временами последней
// активности из таблицы Progress (updatedAt), чтобы фича «был в сети» сразу
// показывала данные для стражей, игравших до развёртывания трекинга.
// Идемпотентен: берёт максимум из уже записанного и updatedAt прогресса.
// Запуск: bun run prisma/backfill-lastseen.ts
// ============================================================================

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync } from "fs";

const prisma = new PrismaClient();
const FILE = "/home/z/my-project/mini-services/presence-service/lastseen.json";

async function main() {
  // текущие записи (если файл есть)
  let cur: Record<string, number> = {};
  try {
    if (existsSync(FILE)) {
      cur = JSON.parse(readFileSync(FILE, "utf-8"));
    }
  } catch {
    cur = {};
  }

  // прогресс → свежайший updatedAt на пользователя (по логину)
  const users = await prisma.user.findMany({
    select: { id: true, login: true },
  });
  const idToLogin = new Map(users.map((u) => [u.id, u.login]));

  const rows = await prisma.progress.findMany();
  let added = 0;
  for (const r of rows) {
    const login = idToLogin.get(r.userId);
    if (!login) continue;
    const ts = new Date(r.updatedAt).getTime();
    if (!cur[login] || ts > cur[login]) {
      cur[login] = ts;
      added++;
    }
  }

  writeFileSync(FILE, JSON.stringify(cur));
  console.log(
    `▸ lastseen.json: ${Object.keys(cur).length} записей (добавлено/обновлено: ${added})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
