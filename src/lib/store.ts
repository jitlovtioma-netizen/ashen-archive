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

  // total shard words (loaded from API, for Secrets tab)
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
  // Большая центральная табличка KonamiModal — сбрасывается при входе.
  konamiModalDismissed: boolean;
  setKonamiModalDismissed: (v: boolean) => void;

  // solved riddles (persisted) — record names whose riddle was solved
  solvedRiddles: string[];
  solveRiddle: (id: string) => boolean;

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

  // world switching (DND ↔ PF2E) without logout
  switchWorld: () => void;
  worldFlash: boolean;
  triggerWorldFlash: () => void;
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
            // Сбрасываем ВСЮ прогрессию при каждом входе
            set({
              user: data.user as User,
              booted: false,
              section: "characters",
              gaze: 7,
              shards: [],
              achievements: [],
              konamiUnlocked: false,
              konamiModalDismissed: false,
              unlockedIds: [],
              revealedSecrets: [],
              solvedRiddles: [],
              toasts: [],
              soundOn: true,
            });
            return { ok: true };
          }
          return { ok: false, error: data.error || "UNKNOWN" };
        } catch {
          return { ok: false, error: "NETWORK" };
        }
      },
      logout: () =>
        set({
          user: null,
          booted: false,
          section: "characters",
          gaze: 7,
          toasts: [],
        }),

      // Переключение между мирами без logout: меняет system + displayName,
      // сбрасывает мир-специфичную прогрессию (shards, achievements, печати,
      // загадки). Показывает world-flash.
      worldFlash: false,
      triggerWorldFlash: () => {
        set({ worldFlash: true });
        setTimeout(() => set({ worldFlash: false }), 900);
      },
      switchWorld: () => {
        const cur = get().user;
        if (!cur) return;
        const newSystem = cur.system === "DND" ? "PF2E" : "DND";
        const newDisplay =
          newSystem === "DND" ? "Страж Эларии" : "Страж Голариона";
        set({
          user: { ...cur, system: newSystem, displayName: newDisplay },
          section: "characters",
          gaze: 7,
          shards: [],
          achievements: [],
          konamiUnlocked: false,
          konamiModalDismissed: false,
          unlockedIds: [],
          revealedSecrets: [],
          solvedRiddles: [],
          toasts: [],
          totalShardWords: 0,
        });
        get().triggerWorldFlash();
      },

      booted: false,
      setBooted: (v) => set({ booted: v }),

      section: "characters",
      setSection: (s) => set({ section: s }),

      totalShardWords: 0,
      setTotalShardWords: (n) => set({ totalShardWords: n }),

      gaze: 7,
      addGaze: (amount) =>
        set((st) => ({ gaze: Math.max(0, Math.min(100, st.gaze + amount)) })),
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
      konamiModalDismissed: false,
      setKonamiModalDismissed: (v) => set({ konamiModalDismissed: v }),

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
      storage: createJSONStorage(() => localStorage),
      // Сохраняем ТОЛЬКО user (чтобы не логиниться заново при перезагрузке).
      // Вся прогрессия (осколки, достижения, загадки) сбрасывается при каждом входе.
      partialize: (s) => ({
        user: s.user,
        soundOn: s.soundOn,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
