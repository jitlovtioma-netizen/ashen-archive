"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProgressData, User } from "@/lib/types";

export type Section =
  | "profile"
  | "admin"
  | "characters"
  | "factions"
  | "lore"
  | "lore_gods"
  | "lore_npcs"
  | "locations"
  | "secrets";

// Куда перейти в Мастерской Созидателя после клика «Править в мастерской»
// из досье (recordType + id + система записи).
export type AdminEditTarget = {
  kind: "character" | "lore" | "location" | "faction";
  id: string;
  system: "DND" | "PF2E";
} | null;

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

  // полный сброс прогресса текущего мира до нуля (кнопка в профиле)
  resetMyProgress: () => Promise<boolean>;

  // boot
  booted: boolean;
  setBooted: (v: boolean) => void;

  // navigation
  section: Section;
  setSection: (s: Section) => void;

  // total shard words (loaded from API, for Secrets tab)
  totalShardWords: number;
  setTotalShardWords: (n: number) => void;

  // ревизия архивных данных: бампается после правки досье, чтобы все
  // секции перезагрузили данные с сервера (правки видны сразу)
  dataRevision: number;
  bumpDataRevision: () => void;

  // цель редактирования в Мастерской (переход из досье по кнопке админа)
  adminEditTarget: AdminEditTarget;
  setAdminEditTarget: (t: AdminEditTarget) => void;

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

  // v5.5 — открытые досье с полным искажением ⟪…⟫ (persisted);
  // для коллекционной ачивки IRIS_COLLECTOR («Собиратель Забвения»)
  irisReadIds: string[];
  addIrisRead: (id: string) => boolean; // returns true if newly added

  // v5.6 — «ирис поглощает»: сколько раз страж открывал каждое
  // ирис-досье (persisted). С каждым открытием читаемость падает —
  // ирис забирает текст себе. Возвращает счётчик ПОСЛЕ инкремента.
  irisOpens: Record<string, number>;
  openIrisRecord: (id: string) => number;
  // стадия поглощения досье (0..4) по счётчику открытий
  irisStageOf: (id: string) => number;

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

  // обновление полей пользователя (роль/привязка из /api/auth/me)
  patchUser: (patch: Partial<User>) => void;

  // world switching (DND ↔ PF2E) without logout
  switchWorld: () => void;
  worldFlash: boolean;
  triggerWorldFlash: () => void;
}

// ─── Персистентность прогресса на сервере ─────────────────────────────
// Муторы прогрессии вызывают queueSave() — дебаунс-отправка POST /api/progress.

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function unionArr(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

function saveProgressNow() {
  const s = useArchive.getState();
  if (!s.user) return;
  const body = JSON.stringify({
    login: s.user.login,
    system: s.user.system,
    achievements: s.achievements,
    shards: s.shards,
    unlockedIds: s.unlockedIds,
    revealedSecrets: s.revealedSecrets,
    solvedRiddles: s.solvedRiddles,
    konamiUnlocked: s.konamiUnlocked,
    secretRevealed: s.secretRevealed,
    irisReadIds: s.irisReadIds,
    irisOpens: s.irisOpens,
    gaze: s.gaze,
  });
  fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function queueSave() {
  if (!useArchive.getState().user) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveProgressNow();
  }, 1200);
}

// Мгновенно сохранить прогресс (beforeunload / смена мира / выход)
export function flushProgressSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveProgressNow();
}

// объединение счётчиков открытий: берём максимум по каждому досье
// (гонки безопасны — счётчик только растёт)
function mergeOpens(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    const n = Number(v) || 0;
    out[k] = Math.max(out[k] ?? 0, n);
  }
  return out;
}

// Загрузить прогресс с сервера и объединить с локальным (union — безопасно
// при гонках: ничего не теряется, сервер остаётся источником правды при входе).
// Экспортируется для вызова при восстановлении сессии из localStorage.
export async function hydrateProgressFromServer(login: string, system: string) {
  try {
    const r = await fetch(
      `/api/progress?login=${encodeURIComponent(login)}&system=${system}`,
    );
    if (!r.ok) return;
    const d = (await r.json()) as { progress: ProgressData | null };
    if (!d.progress) return;
    const p = d.progress;
    const cur = useArchive.getState();
    // защита от гонки: пользователь мог смениться/выйти
    if (!cur.user || cur.user.login !== login || cur.user.system !== system)
      return;
    useArchive.setState({
      achievements: unionArr(cur.achievements, p.achievements ?? []),
      shards: unionArr(cur.shards, p.shards ?? []),
      unlockedIds: unionArr(cur.unlockedIds, p.unlockedIds ?? []),
      irisReadIds: unionArr(cur.irisReadIds, p.irisReadIds ?? []),
      irisOpens: mergeOpens(cur.irisOpens ?? {}, p.irisOpens ?? {}),
      revealedSecrets: unionArr(cur.revealedSecrets, p.revealedSecrets ?? []),
      solvedRiddles: unionArr(cur.solvedRiddles, p.solvedRiddles ?? []),
      konamiUnlocked: cur.konamiUnlocked || !!p.konamiUnlocked,
      secretRevealed: cur.secretRevealed || !!p.secretRevealed,
      gaze: Math.max(cur.gaze, typeof p.gaze === "number" ? p.gaze : 0),
    });
  } catch {
    /* сеть недоступна — прогресс останется пустым, не критично */
  }
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
            // Сбрасываем ВСЮ прогрессию при каждом входе,
            // затем гидратируем сохранённый прогресс с сервера.
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
              irisReadIds: [],
              irisOpens: {},
              revealedSecrets: [],
              solvedRiddles: [],
              toasts: [],
              soundOn: true,
            });
            void hydrateProgressFromServer(loginStr, data.user.system);
            return { ok: true };
          }
          return { ok: false, error: data.error || "UNKNOWN" };
        } catch {
          return { ok: false, error: "NETWORK" };
        }
      },
      logout: () => {
        // сохраняем прогресс перед выходом
        flushProgressSave();
        void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        set({
          user: null,
          booted: false,
          section: "characters",
          gaze: 7,
          toasts: [],
        });
      },

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
        // Смена мира — привилегия Длани (админов). Игроки Эларии не должны
        // видеть Голарион и наоборот (изоляция миров).
        if (cur.role !== "ADMIN") return;
        // сохранить прогресс текущего мира перед сбросом
        flushProgressSave();
        const newSystem = cur.system === "DND" ? "PF2E" : "DND";
        // меняем displayName только у стандартных тестовых аккаунтов
        // (кастомные имена стражей не трогаем)
        const newDisplay =
          cur.displayName === "Страж Эларии"
            ? "Страж Голариона"
            : cur.displayName === "Страж Голариона"
              ? "Страж Эларии"
              : cur.displayName;
        set({
          user: { ...cur, system: newSystem, displayName: newDisplay },
          section: "characters",
          gaze: 7,
          shards: [],
          achievements: [],
          konamiUnlocked: false,
          konamiModalDismissed: false,
          unlockedIds: [],
          irisReadIds: [],
          irisOpens: {},
          revealedSecrets: [],
          solvedRiddles: [],
          toasts: [],
          totalShardWords: 0,
        });
        // подгрузить прогресс нового мира
        void hydrateProgressFromServer(cur.login, newSystem);
        get().triggerWorldFlash();
      },

      // Полный сброс прогресса текущего мира до нуля.
      // Отменяет отложенный queueSave, чистит локальное состояние и
      // удаляет серверную строку прогресса (DELETE /api/progress).
      resetMyProgress: async () => {
        const s = get();
        if (!s.user) return false;
        // отменяем отложенное сохранение — иначе старый прогресс
        // мог бы перезаписать сброс после нажатия кнопки
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        set({
          gaze: 7,
          shards: [],
          achievements: [],
          konamiUnlocked: false,
          konamiModalDismissed: false,
          unlockedIds: [],
          irisReadIds: [],
          irisOpens: {},
          revealedSecrets: [],
          solvedRiddles: [],
          secretRevealed: false,
        });
        try {
          const r = await fetch(
            `/api/progress?login=${encodeURIComponent(s.user.login)}&system=${s.user.system}`,
            { method: "DELETE" },
          );
          return r.ok;
        } catch {
          return false;
        }
      },

      booted: false,
      setBooted: (v) => set({ booted: v }),

      section: "characters",
      setSection: (s) => set({ section: s }),

      totalShardWords: 0,
      setTotalShardWords: (n) => set({ totalShardWords: n }),

      dataRevision: 0,
      bumpDataRevision: () =>
        set((st) => ({ dataRevision: st.dataRevision + 1 })),

      adminEditTarget: null,
      setAdminEditTarget: (t) => set({ adminEditTarget: t }),

      gaze: 7,
      addGaze: (amount) =>
        set((st) => {
          const gaze = Math.max(0, Math.min(100, st.gaze + amount));
          if (gaze !== st.gaze) queueSave();
          return { gaze };
        }),
      resetGaze: () => {
        set({ gaze: 7 });
        queueSave();
      },

      soundOn: true,
      toggleSound: () => set((st) => ({ soundOn: !st.soundOn })),

      shards: [],
      addShard: (word) => {
        const cur = get().shards;
        if (cur.includes(word)) return false;
        set({ shards: [...cur, word] });
        queueSave();
        return true;
      },

      achievements: [],
      unlockAchievement: (code) => {
        const cur = get().achievements;
        if (cur.includes(code)) return false;
        set({ achievements: [...cur, code] });
        queueSave();
        return true;
      },

      konamiUnlocked: false,
      setKonamiUnlocked: (v) => {
        set({ konamiUnlocked: v });
        if (v) queueSave();
      },
      secretRevealed: false,
      revealSecret: () => {
        set({ secretRevealed: true });
        queueSave();
      },
      konamiModalDismissed: false,
      setKonamiModalDismissed: (v) => set({ konamiModalDismissed: v }),

      solvedRiddles: [],
      solveRiddle: (id) => {
        const cur = get().solvedRiddles;
        if (cur.includes(id)) return false;
        set({ solvedRiddles: [...cur, id] });
        queueSave();
        return true;
      },

      unlockedIds: [],
      unlockRecord: (id) => {
        const cur = get().unlockedIds;
        if (cur.includes(id)) return false;
        set({ unlockedIds: [...cur, id] });
        queueSave();
        return true;
      },

      irisReadIds: [],
      addIrisRead: (id) => {
        const cur = get().irisReadIds;
        if (cur.includes(id)) return false;
        set({ irisReadIds: [...cur, id] });
        queueSave();
        return true;
      },

      irisOpens: {},
      openIrisRecord: (id) => {
        const cur = get().irisOpens;
        const next = (cur[id] ?? 0) + 1;
        set({ irisOpens: { ...cur, [id]: next } });
        queueSave();
        return next;
      },
      irisStageOf: (id) => {
        const opens = get().irisOpens[id] ?? 0;
        // v5.7 — стадии 0..6: 0..4 «поглощение», 5..6 «ирис не отпускает»
        return Math.max(0, Math.min(6, opens - 1));
      },

      revealedSecrets: [],
      revealRecordSecret: (id) => {
        const cur = get().revealedSecrets;
        if (cur.includes(id)) return false;
        set({ revealedSecrets: [...cur, id] });
        queueSave();
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
        // v5.7.2 — no-op защита: если тост уже снят вручную, НЕ трогаем стейт.
        // Прежний вариант всегда создавал новый массив → zustand уведомлял
        // всех подписчиков → все карточки ре-рендерились вхолостую (а в 170мс-
        // окне закрытия досье это ещё и убивало таймер onClose — «архив завис»).
        setTimeout(() => {
          set((st) =>
            st.toasts.some((x) => x.id === id)
              ? { toasts: st.toasts.filter((x) => x.id !== id) }
              : st,
          );
        }, 5500);
      },
      dismissToast: (id) =>
        set((st) =>
          st.toasts.some((x) => x.id === id)
            ? { toasts: st.toasts.filter((x) => x.id !== id) }
            : st,
        ),

      _hasHydrated: false,
      setHydrated: () => set({ _hasHydrated: true }),

      patchUser: (patch) => {
        const cur = get().user;
        if (!cur) return;
        set({ user: { ...cur, ...patch } });
      },
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
