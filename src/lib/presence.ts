"use client";

// ============================================================================
// PRESENCE — онлайн-стражи архива.
//
// Три режима (авто-выбор по переменным окружения):
//   1. NEXT_PUBLIC_PRESENCE_URL задан        → socket.io mini-service
//      (полный функционал: онлайн, «был в сети», админ-вещание, изгнание).
//      Используется в песочнице; на проде требует своего сервиса.
//   2. Иначе, если заданы NEXT_PUBLIC_SUPABASE_URL +
//      NEXT_PUBLIC_SUPABASE_ANON_KEY          → Supabase Realtime
//      (БЕСПЛАТНО, на том же Supabase-проекте: канал presence — кто онлайн
//      прямо сейчас + «в архиве с…»; lastSeen пишется heartbeat'ом в
//      основную БД через /api/presence. Вещание/изгнание не поддерживаются).
//   3. Иначе presence полностью ВЫКЛЮЧЕН.
// ============================================================================

import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PresenceUser } from "@/lib/types";
import { useArchive } from "@/lib/store";

interface BroadcastMsg {
  message: string;
  from: string;
  at: number;
}

interface PresenceState {
  connected: boolean;
  online: PresenceUser[];
  // login → epoch последнего визита (для оффлайн-стражей)
  lastSeen: Record<string, number>;
  broadcast: BroadcastMsg | null;
  kickedBy: string | null;
  setConnected: (v: boolean) => void;
  setOnline: (list: PresenceUser[]) => void;
  setLastSeen: (map: Record<string, number>) => void;
  setBroadcast: (b: BroadcastMsg | null) => void;
  setKickedBy: (by: string | null) => void;
}

export const usePresence = create<PresenceState>()((set) => ({
  connected: false,
  online: [],
  lastSeen: {},
  broadcast: null,
  kickedBy: null,
  setConnected: (v) => set({ connected: v }),
  setOnline: (list) => set({ online: list }),
  setLastSeen: (map) => set({ lastSeen: map }),
  setBroadcast: (b) => set({ broadcast: b }),
  setKickedBy: (by) => set({ kickedBy: by }),
}));

// ── Выбор режима ────────────────────────────────────────────────────────────
const PRESENCE_URL = process.env.NEXT_PUBLIC_PRESENCE_URL?.trim() || null;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
const SUPA_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;

// Бесплатный режим: Supabase Realtime (presence-канал).
const SUPABASE_MODE =
  !PRESENCE_URL && SUPA_URL && SUPA_ANON
    ? { url: SUPA_URL, anon: SUPA_ANON }
    : null;

// Включён ли presence в этой сборке (для UI: «В СЕТИ», счётчик стражей)
export const presenceEnabled =
  PRESENCE_URL !== null || SUPABASE_MODE !== null;

// Какой бэкенд активен (для тултипов в UI)
export const presenceBackend: "socket" | "supabase" | null = PRESENCE_URL
  ? "socket"
  : SUPABASE_MODE
    ? "supabase"
    : null;

// ── Режим 1: socket.io mini-service ─────────────────────────────────────────
let socket: Socket | null = null;

// ── Режим 2: Supabase Realtime ──────────────────────────────────────────────
let supaChannel: RealtimeChannel | null = null;
let supaHeartbeat: ReturnType<typeof setInterval> | null = null;
let supaInitDone = false;

async function initSupabasePresence(login: string, system: string) {
  if (!SUPABASE_MODE || supaInitDone) return;
  supaInitDone = true;

  try {
    // Динамический импорт: тем, у кого режим выключен, бандл не тяжелеет.
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(SUPABASE_MODE.url, SUPABASE_MODE.anon, {
      realtime: { params: { eventsPerSecond: 3 } },
    });

    // «Был в сети» — из нашей основной БД (за последние 30 дней)
    void fetch("/api/presence", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; lastSeen?: Record<string, number> }) => {
        if (d?.ok && d.lastSeen) {
          usePresence.getState().setLastSeen(d.lastSeen);
        }
      })
      .catch(() => {});

    const since = Date.now();
    const channel = client.channel("archive-online", {
      config: { presence: { key: login } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const list: PresenceUser[] = [];
        for (const presences of Object.values(state)) {
          const p = presences[0] as
            | { login?: string; system?: string; since?: number }
            | undefined;
          if (!p?.login) continue;
          list.push({
            login: p.login,
            displayName: p.login,
            system: (p.system as PresenceUser["system"]) ?? "DND",
            role: "USER",
            since: typeof p.since === "number" ? p.since : since,
          });
        }
        usePresence.getState().setOnline(list);
      })
      .on(
        "presence",
        { event: "leave" },
        (payload: { key?: string }) => {
          // страж ушёл — запоминаем момент (для «был в сети»)
          if (payload?.key) {
            const prev = usePresence.getState().lastSeen;
            usePresence
              .getState()
              .setLastSeen({ ...prev, [payload.key]: Date.now() });
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ login, system, since });
          usePresence.getState().setConnected(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          usePresence.getState().setConnected(false);
        }
      });

    supaChannel = channel;

    // Heartbeat: раз в минуту пишем lastSeenAt в основную БД,
    // чтобы «был в сети» переживал перезапуски сервиса.
    const beat = () => {
      void fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      }).catch(() => {});
    };
    beat();
    supaHeartbeat = setInterval(beat, 60_000);
  } catch (e) {
    // Realtime не поднялся — тихо работаем офлайн
    console.warn("[presence] Supabase Realtime недоступен:", e);
    supaInitDone = false;
  }
}

// ── Публичный API ───────────────────────────────────────────────────────────

// Подключиться и заявить о себе. Вызывается при входе / смене мира.
export function initPresence(login: string, system: string) {
  if (typeof window === "undefined") return;

  if (PRESENCE_URL) {
    // Режим 1: socket.io
    if (!socket) {
      socket = io(PRESENCE_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socket.on("connect", () => {
        usePresence.getState().setConnected(true);
        // re-join после реконнекта (сервер мог не увидеть connect)
        const u = useArchive.getState().user;
        if (u) socket?.emit("join", { login: u.login });
      });

      socket.on("disconnect", () => {
        usePresence.getState().setConnected(false);
      });

      socket.on("presence", (list: PresenceUser[]) => {
        usePresence.getState().setOnline(Array.isArray(list) ? list : []);
      });

      socket.on("last-seen", (map: Record<string, number>) => {
        if (map && typeof map === "object") {
          usePresence.getState().setLastSeen(map);
        }
      });

      socket.on("admin-broadcast", (payload: BroadcastMsg) => {
        if (payload && typeof payload.message === "string") {
          usePresence.getState().setBroadcast(payload);
        }
      });

      socket.on("kicked", (payload: { by?: string }) => {
        usePresence.getState().setKickedBy(payload?.by ?? "Созидатель");
        // Жёсткий выход из архива
        useArchive.getState().logout();
      });
    }

    socket.emit("join", { login });
    return;
  }

  if (SUPABASE_MODE) {
    // Режим 2: Supabase Realtime (бесплатно, на том же проекте)
    void initSupabasePresence(login, system);
    return;
  }

  // Режим 3: presence не сконфигурирован — тихий офлайн
  void system;
}

// Отключиться (при выходе из архива)
export function disconnectPresence() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (supaHeartbeat) {
    clearInterval(supaHeartbeat);
    supaHeartbeat = null;
  }
  if (supaChannel) {
    void supaChannel.unsubscribe();
    void supaChannel.remove();
    supaChannel = null;
  }
  supaInitDone = false;
  usePresence.getState().setConnected(false);
  usePresence.getState().setOnline([]);
}

// Админ: вещание на весь экран (только socket.io-режим)
export function sendBroadcast(message: string): boolean {
  if (!socket || !message.trim()) return false;
  socket.emit("broadcast", { message });
  return true;
}

// Админ: изгнание стража (только socket.io-режим)
export function kickUser(login: string): boolean {
  if (!socket) return false;
  socket.emit("kick", { login });
  return true;
}
