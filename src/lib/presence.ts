"use client";

// ============================================================================
// PRESENCE — онлайн-стражи архива.
// Socket.io-подключение к mini-service (порт 3003) + zustand-стор.
// Онлайн-список, админ-вещание на весь экран, изгнание.
// ============================================================================

import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
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

// URL сокета presence-сервиса.
// ВАЖНО (Vercel/Supabase): если NEXT_PUBLIC_PRESENCE_URL НЕ задан — presence
// полностью ВЫКЛЮЧЕН (сокет не открывается вообще). Раньше молчаливым
// дефолтом был "/?XTransformPort=3003" — конвенция шлюза песочницы, на Vercel
// она давала бы бесконечные 404-реконнекты.
// Задай переменную в .env, чтобы включить:
//   • песочница:            NEXT_PUBLIC_PRESENCE_URL=/?XTransformPort=3003
//   • свой сервер (прокси): NEXT_PUBLIC_PRESENCE_URL=/
//   • отдельный хост:       NEXT_PUBLIC_PRESENCE_URL=https://presence.example.com
const PRESENCE_URL = process.env.NEXT_PUBLIC_PRESENCE_URL?.trim() || null;

// Включён ли presence в этой сборке (для UI: счётчик «В СЕТИ» и т.п.)
export const presenceEnabled = PRESENCE_URL !== null;

let socket: Socket | null = null;

// Подключиться и заявить о себе. Вызывается при входе / смене мира.
export function initPresence(login: string, system: string) {
  if (typeof window === "undefined") return;
  // presence не сконфигурирован (например, деплой на Vercel без сервиса
  // онлайна) — тихо работаем в офлайн-режиме, без попыток подключения
  if (!PRESENCE_URL) return;

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
  void system; // система приходит из БД на сервере — клиенту не доверяем
}

// Отключиться (при выходе из архива)
export function disconnectPresence() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  usePresence.getState().setConnected(false);
  usePresence.getState().setOnline([]);
}

// Админ: вещание на весь экран
export function sendBroadcast(message: string): boolean {
  if (!socket || !message.trim()) return false;
  socket.emit("broadcast", { message });
  return true;
}

// Админ: изгнание стража
export function kickUser(login: string): boolean {
  if (!socket) return false;
  socket.emit("kick", { login });
  return true;
}
