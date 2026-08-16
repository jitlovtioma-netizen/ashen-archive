"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/lib/types";

export type Section =
  | "characters"
  | "factions"
  | "lore"
  | "lore_gods"
  | "lore_npcs"
  | "locations"
  | "achievements"
  | "secrets";

export interface Toast {
  id: string;
  kind: "ach" | "info" | "warn" | "secret";
  title: string;
  body?: string;
  sigil?: string;
}

interface ArchiveState {
  // auth
  user: User | null;
  login: (login: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;

  // boot
  booted: boolean;
  setBooted: (v: boolean) => void;

  // navigation
  section: Section;
  setSection: (s: Section) => void;

  // total shard words (загружается с API, для вкладки «Секреты»)
  totalShardWords: number;
  setTotalShardWords: (n: number) => void;

  // god's gaze meter (0-100) — NOT persisted, resets each session
  gaze: number;
  addGaze: (amount: number) => void;
  resetGaze: () => void;

  // sound (persisted)
  soundOn: boolean;
  toggleSound: () => void;

  // collected memory shards (persisted)
  shards: string[];
  addShard: (word: string) => boolean; // returns true if newly added

  // unlocked achievements (persisted)
  achievements: string[];
  unlockAchievement: (code: string) => boolean; // returns true if newly unlocked

  // konami / secret (persisted)
  konamiUnlocked: boolean;
  setKonamiUnlocked: (v: boolean) => void;
  secretRevealed: boolean;
  revealSecret: () => void;

  // solved riddles (persisted) — record ids whose riddle was solved
  solvedRiddles: string[];
  solveRiddle: (id: string) => boolean; // returns true if newly solved

  // unlocked record ids (persisted) — records whose seal was broken
  unlockedIds: string[];
  unlockRecord: (id: string) => boolean; // returns true if newly unlocked

  // revealed secret fragments (persisted) — hidden text in records
  revealedSecrets: string[];
  revealRecordSecret: (id: string) => boolean;

  // witching hour (runtime)
  witching: boolean;
  setWitching: (v: boolean) => void;
  witchingForcedUntil: number; // epoch ms; 0 = not forced
  forceWitching: (ms: number) => void;

  // toast queue (runtime)
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;

  // hydration flag
  _hasHydrated: boolean;
  setHydrated: () => void;
}

export const useArchive = create<ArchiveState>()(
  persist(
    (set, get) => ({
      user: null,
      login: async (loginStr, password) => {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ login: loginStr, password }),
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            const newLogin = (data.user as User).login;
            // Устанавливаем текущий логин в localStorage ПЕРЕД set,
            // чтобы persist записал прогрессию под правильным ключом.
            if (typeof window !== "undefined") {
              window.localStorage.setItem(
                "ashen-current-login",
                JSON.stringify(newLogin)
              );
            }
            // Сбрасываем прогрессию (загрузится из storage нового пользователя
            // при следующем persist/rehydrate).
            set({
              user: data.user as User,
              booted: false,
              section: "characters",
              gaze: 7,
              shards: [],
              achievements: [],
              konamiUnlocked: false,
              unlockedIds: [],
              revealedSecrets: [],
              solvedRiddles: [],
              toasts: [],
            });
            // Принудительно перезагружаем из storage нового пользователя
            if (typeof window !== "undefined") {
              try {
                const raw = window.localStorage.getItem(
                  `ashen-archive-${newLogin}`
                );
                if (raw) {
                  const saved = JSON.parse(raw);
                  if (saved?.state) {
                    set({
                      shards: saved.state.shards ?? [],
                      achievements: saved.state.achievements ?? [],
                      konamiUnlocked: saved.state.konamiUnlocked ?? false,
                      unlockedIds: saved.state.unlockedIds ?? [],
                      revealedSecrets: saved.state.revealedSecrets ?? [],
                      solvedRiddles: saved.state.solvedRiddles ?? [],
                      soundOn: saved.state.soundOn ?? true,
                    });
                  }
                }
              } catch {
                // ignore parse errors
              }
            }
            return { ok: true };
          }
          return { ok: false, error: data.error || "UNKNOWN" };
        } catch {
          return { ok: false, error: "NETWORK" };
        }
      },
      logout: () => {
        // Сначала сохраняем текущую прогрессию (persist сделает это через set),
        // потом меняем current-login на guest.
        set({
          user: null,
          booted: false,
          section: "characters",
          gaze: 7,
          toasts: [],
        });
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            "ashen-current-login",
            JSON.stringify("guest")
          );
        }
      },

      booted: false,
      setBooted: (v) => set({ booted: v }),

      section: "characters",
      setSection: (s) => set({ section: s }),

      totalShardWords: 0,
      setTotalShardWords: (n) => set({ totalShardWords: n }),

      gaze: 7,
      addGaze: (amount) => {
        const st = get();
        const newGaze = Math.max(0, st.gaze + amount);
        // При достижении 140 — выкидывание + стирание прогресса + бан 12 часов
        if (newGaze >= 140 && st.gaze < 140) {
          // Стираем ВЕСЬ прогресс игрока
          set({
            gaze: 0,
            shards: [],
            achievements: [],
            unlockedIds: [],
            revealedSecrets: [],
            solvedRiddles: [],
            konamiUnlocked: false,
            toasts: [],
          });
          // Устанавливаем бан и выкидываем
          if (typeof window !== "undefined") {
            const bannedUntil = Date.now() + 12 * 60 * 60 * 1000;
            const login = window.localStorage.getItem("ashen-current-login");
            if (login) {
              const loginStr = JSON.parse(login);
              window.localStorage.setItem(
                `ashen-banned-${loginStr}`,
                String(bannedUntil)
              );
            }
            // Выкидываем пользователя через короткую задержку (даём toast показаться)
            setTimeout(() => {
              // Сбрасываем current-login на guest
              window.localStorage.setItem(
                "ashen-current-login",
                JSON.stringify("guest")
              );
              // Перезагружаем страницу — вернёт на экран логина
              window.location.href = "/";
            }, 3000);
          }
        } else {
          set({ gaze: newGaze });
        }
      },
      resetGaze: () => set({ gaze: 7 }),

      soundOn: true,
      toggleSound: () => set((st) => ({ soundOn: !st.soundOn })),

      shards: [],
      addShard: (word) => {
        const cur = get().shards;
        if (cur.includes(word)) return false;
        set({ shards: [...cur, word] });
        return true;
      },

      achievements: [],
      unlockAchievement: (code) => {
        const cur = get().achievements;
        if (cur.includes(code)) return false;
        set({ achievements: [...cur, code] });
        return true;
      },

      konamiUnlocked: false,
      setKonamiUnlocked: (v) => set({ konamiUnlocked: v }),
      secretRevealed: false,
      revealSecret: () => set({ secretRevealed: true }),

      solvedRiddles: [],
      solveRiddle: (id) => {
        const cur = get().solvedRiddles;
        if (cur.includes(id)) return false;
        set({ solvedRiddles: [...cur, id] });
        return true;
      },

      unlockedIds: [],
      unlockRecord: (id) => {
        const cur = get().unlockedIds;
        if (cur.includes(id)) return false;
        set({ unlockedIds: [...cur, id] });
        return true;
      },

      revealedSecrets: [],
      revealRecordSecret: (id) => {
        const cur = get().revealedSecrets;
        if (cur.includes(id)) return false;
        set({ revealedSecrets: [...cur, id] });
        return true;
      },

      witching: false,
      setWitching: (v) => set({ witching: v }),
      witchingForcedUntil: 0,
      forceWitching: (ms) => set({ witchingForcedUntil: Date.now() + ms }),

      toasts: [],
      pushToast: (t) => {
        const id = Math.random().toString(36).slice(2);
        set((st) => ({ toasts: [...st.toasts, { ...t, id }] }));
        // auto dismiss after 5s
        setTimeout(() => {
          set((st) => ({ toasts: st.toasts.filter((x) => x.id !== id) }));
        }, 5500);
      },
      dismissToast: (id) =>
        set((st) => ({ toasts: st.toasts.filter((x) => x.id !== id) })),

      _hasHydrated: false,
      setHydrated: () => set({ _hasHydrated: true }),
    }),
    {
      name: "ashen-archive",
      // Раздельная прогрессия: storage key зависит от логина.
      // Каждый игрок имеет свой набор осколков, достижений и т.д.
      storage: createJSONStorage(() => {
        // Хелпер: читаем текущий логин из localStorage
        const getCurrentLogin = () => {
          if (typeof window === "undefined") return "guest";
          try {
            const raw = window.localStorage.getItem("ashen-current-login");
            return raw ? (JSON.parse(raw) as string) : "guest";
          } catch {
            return "guest";
          }
        };
        // Кастомный storage: каждый логин — свой ключ в localStorage
        return {
          getItem: (name: string) => {
            const login = getCurrentLogin();
            const key = `${name}-${login}`;
            return window.localStorage.getItem(key);
          },
          setItem: (name: string, value: string) => {
            const login = getCurrentLogin();
            const key = `${name}-${login}`;
            window.localStorage.setItem(key, value);
          },
          removeItem: (name: string) => {
            const login = getCurrentLogin();
            const key = `${name}-${login}`;
            window.localStorage.removeItem(key);
          },
        };
      }),
      partialize: (s) => ({
        user: s.user,
        soundOn: s.soundOn,
        shards: s.shards,
        achievements: s.achievements,
        konamiUnlocked: s.konamiUnlocked,
        unlockedIds: s.unlockedIds,
        revealedSecrets: s.revealedSecrets,
        solvedRiddles: s.solvedRiddles,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
