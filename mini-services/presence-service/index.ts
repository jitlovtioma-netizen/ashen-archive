// ============================================================================
// PRESENCE SERVICE — онлайн-стражи архива (socket.io, порт 3003)
// Обязанности:
//   • кто онлайн (join/leave → рассылка списка presence)
//   • lastSeen — когда страж был в сети последний раз (переживает рестарт,
//     хранится в lastseen.json рядом с сервисом)
//   • админ-вещание на весь экран (broadcast → admin-broadcast)
//   • изгнание стража (kick → kicked)
// Роль проверяется по БД (SQLite, read-only) — клиенту не доверяем.
// ============================================================================

import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync } from "fs";

// Сторож основного dev-сервера (side-effect import; активен только
// в песочнице z.ai — см. комментарий внутри devkeeper.ts)
import "./devkeeper";

// Порт: на облачных платформах (Railway/Render/Fly) порт выдаётся
// через env PORT — слушаем его; локально/в песочнице — 3003.
const PORT = Number(process.env.PORT ?? 3003);
// Путь к базе можно переопределить через .env рядом с сервисом
// (bun подхватывает .env автоматически) или через PRESENCE_DB_URL.
// Фолбэк — путь песочницы.
const DB_URL =
  process.env.PRESENCE_DB_URL ??
  process.env.DATABASE_URL ??
  "file:/home/z/my-project/db/custom.db";
// lastseen.json — рядом с index.ts (переносимо между окружениями)
const LASTSEEN_FILE = new URL("./lastseen.json", import.meta.url).pathname;

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

interface PresenceUser {
  socketId: string;
  login: string;
  displayName: string;
  system: "DND" | "PF2E";
  role: "USER" | "ADMIN";
  since: number;
}

// socketId → страж
const sockets = new Map<string, PresenceUser>();

// login → epoch последнего визита (переживает рестарт сервиса)
let lastSeen: Record<string, number> = {};
try {
  if (existsSync(LASTSEEN_FILE)) {
    lastSeen = JSON.parse(readFileSync(LASTSEEN_FILE, "utf-8"));
  }
} catch (e) {
  console.error("lastseen load error:", e);
}

// дебаунс-запись lastseen на диск (не чаще раза в 1.5с)
let lastSeenSaveTimer: ReturnType<typeof setTimeout> | null = null;
function persistLastSeen() {
  if (lastSeenSaveTimer) return;
  lastSeenSaveTimer = setTimeout(() => {
    lastSeenSaveTimer = null;
    try {
      writeFileSync(LASTSEEN_FILE, JSON.stringify(lastSeen));
    } catch (e) {
      console.error("lastseen persist error:", e);
    }
  }, 1500);
}

function presenceList() {
  // уникальные по логину (несколько вкладок = одна запись)
  const byLogin = new Map<string, PresenceUser>();
  for (const u of sockets.values()) byLogin.set(u.login, u);
  return Array.from(byLogin.values()).map((u) => ({
    login: u.login,
    displayName: u.displayName,
    system: u.system,
    role: u.role,
    since: u.since,
  }));
}

const httpServer = createServer();
const io = new Server(httpServer, {
  // путь по умолчанию "/" — конвенция Caddy-шлюза песочницы.
  // На собственном сервере задайте PRESENCE_SOCKET_PATH=/socket.io
  // и проксируйте /socket.io/* на этот порт (см. README.md).
  path: process.env.PRESENCE_SOCKET_PATH ?? "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  // ─── Вход стража в архив ───
  socket.on(
    "join",
    async (payload: { login?: unknown }) => {
      try {
        const login = typeof payload?.login === "string" ? payload.login : "";
        if (!login) {
          socket.emit("join-error", { error: "NO_LOGIN" });
          return;
        }
        // Проверяем пользователя и роль по БД
        const user = await prisma.user.findUnique({ where: { login } });
        if (!user) {
          socket.emit("join-error", { error: "UNKNOWN_USER" });
          return;
        }
        sockets.set(socket.id, {
          socketId: socket.id,
          login: user.login,
          displayName: user.displayName,
          system: user.system === "PF2E" ? "PF2E" : "DND",
          role: user.role === "ADMIN" ? "ADMIN" : "USER",
          since: Date.now(),
        });
        lastSeen[user.login] = Date.now();
        persistLastSeen();
        io.emit("presence", presenceList());
        io.emit("last-seen", lastSeen);
        socket.emit("last-seen", lastSeen);
        socket.emit("joined", { ok: true });
      } catch (e) {
        console.error("join error:", e);
        socket.emit("join-error", { error: "SERVER_ERROR" });
      }
    },
  );

  // ─── Отключение ───
  socket.on("disconnect", () => {
    const gone = sockets.get(socket.id);
    sockets.delete(socket.id);
    // если это была последняя вкладка стража — фиксируем время ухода
    if (gone) {
      const stillOnline = Array.from(sockets.values()).some(
        (u) => u.login === gone.login,
      );
      if (!stillOnline) {
        lastSeen[gone.login] = Date.now();
        persistLastSeen();
      }
    }
    io.emit("presence", presenceList());
    io.emit("last-seen", lastSeen);
  });

  // ─── Админ: сообщение на весь экран ───
  socket.on("broadcast", (payload: { message?: unknown }) => {
    const me = sockets.get(socket.id);
    if (!me || me.role !== "ADMIN") {
      socket.emit("broadcast-result", { ok: false, error: "FORBIDDEN" });
      return;
    }
    const message = String(payload?.message ?? "")
      .slice(0, 500)
      .trim();
    if (!message) {
      socket.emit("broadcast-result", { ok: false, error: "EMPTY" });
      return;
    }
    io.emit("admin-broadcast", {
      message,
      from: me.displayName,
      at: Date.now(),
    });
    socket.emit("broadcast-result", { ok: true });
  });

  // ─── Админ: изгнание стража ───
  socket.on("kick", (payload: { login?: unknown }) => {
    const me = sockets.get(socket.id);
    if (!me || me.role !== "ADMIN") {
      socket.emit("kick-result", { ok: false, error: "FORBIDDEN" });
      return;
    }
    const target = typeof payload?.login === "string" ? payload.login : "";
    const victims = Array.from(sockets.values()).filter(
      (u) => u.login === target,
    );
    if (victims.length === 0) {
      socket.emit("kick-result", { ok: false, error: "NOT_ONLINE" });
      return;
    }
    for (const v of victims) {
      io.to(v.socketId).emit("kicked", { by: me.displayName });
      io.sockets.sockets.get(v.socketId)?.disconnect(true);
    }
    socket.emit("kick-result", { ok: true, kicked: victims.length });
  });
});

httpServer.listen(PORT, () => {
  console.log(`▸ presence-service готов: порт ${PORT} [rev 2]`);
  // периодически актуализируем lastSeen для онлайн-стражей,
  // чтобы после рестарта сервиса времена не «устарели»
  setInterval(() => {
    const byLogin = new Map<string, PresenceUser>();
    for (const u of sockets.values()) byLogin.set(u.login, u);
    for (const login of byLogin.keys()) lastSeen[login] = Date.now();
    persistLastSeen();
  }, 60000);
});
