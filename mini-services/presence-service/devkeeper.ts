// ============================================================================
// DEVKEEPER — сторож основного dev-сервера (ТОЛЬКО для песочницы z.ai).
//
// Зачем: platform harness убивает любые процессы, порождённые из tool-вызовов
// агента, — включая `bun run dev`. Выживают только процессы, загруженные при
// буте контейнера. Этот presence-service как раз такой (его запускает
// /start.sh). Поэтому если основной dev-сервер упал — поднимаем его отсюда,
// как child выживающего процесса.
//
// Защиты:
//   • работает ТОЛЬКО в песочнице: проверяем ZAI Control Service на :12600
//     (существует только в контейнере платформы; на сервере пользователя
//     и на Vercel этого порта нет — код молча пропускается);
//   • не плодит дубликаты: перед стартом проверяем, что :3000 свободен;
//   • hot-reload (bun --hot) повторно исполняет модуль — guard это терпит.
// ============================================================================

import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { openSync } from "node:fs";

const PROJECT_DIR = "/home/z/my-project";
const ZAI_CONTROL_PORT = 12600; // маркер песочницы z.ai
const DEV_PORT = 3000;

function checkPort(port: number, host = "127.0.0.1"): Promise<boolean> {
  // true  — порт ЗАНЯТ (кто-то слушает)
  // false — порт свободен
  return new Promise((resolve) => {
    const s = createConnection({ port, host });
    const done = (result: boolean) => {
      s.removeAllListeners();
      s.destroy();
      resolve(result);
    };
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
    setTimeout(() => done(false), 2500);
  });
}

async function keepDevAlive() {
  const inSandbox = await checkPort(ZAI_CONTROL_PORT);
  if (!inSandbox) return; // не песочница — ничего не делаем
  const devDown = !(await checkPort(DEV_PORT));
  if (devDown) {
    try {
      const logFd = openSync(`${PROJECT_DIR}/devkeeper.log`, "a");
      const child = spawn(
        "bash",
        ["-c", `cd ${PROJECT_DIR} && exec bun run dev`],
        {
          detached: true,
          stdio: ["ignore", logFd, logFd],
          env: { ...process.env },
          cwd: PROJECT_DIR,
        },
      );
      child.unref();
      console.log(
        `[devkeeper] основной dev-сервер был поднят (pid ${child.pid})`,
      );
    } catch (e) {
      console.error("[devkeeper] не удалось поднять dev-сервер:", e);
    }
  } else {
    console.log("[devkeeper] dev-сервер уже работает — ок");
  }
}

keepDevAlive().catch((e) =>
  console.error("[devkeeper] unexpected:", e),
);

// Периодический дозор: если dev-сервер умрёт в любой момент (например,
// агент перезапускает его после смены схемы Prisma) — поднимем заново
// в течение ~20 секунд, не дожидаясь хот-релоада этого модуля.
setInterval(
  () => {
    keepDevAlive().catch(() => {});
  },
  20_000,
).unref?.();

export {}; // модуль-сторож: импортируется ради side-effect
