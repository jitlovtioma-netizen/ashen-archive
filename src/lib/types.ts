// Types matching the backend Prisma models (see /agent-ctx/A-backend.md)

export type GameSystem = "DND" | "PF2E";

// Сколько осколков памяти открывают вкладку «Секреты» — зависит от мира:
//   D&D  (Элария)   — все 5 осколков;
//   PF2E (Голарион) — все 6 осколков (гордыня/кровь/огонь/контракт/смерть/надежда).
export function secretsShardsRequired(system: GameSystem): number {
  return system === "PF2E" ? 6 : 5;
}

// Числительное для надписей: «печать пяти осколков».
export function shardsWordGenitive(n: number): string {
  return n === 6 ? "шести" : n === 5 ? "пяти" : String(n);
}

export type UserRole = "USER" | "ADMIN";

export interface User {
  login: string;
  displayName: string;
  system: GameSystem;
  role?: UserRole;
  characterId?: string | null;
}

// Персистентный прогресс стража (хранится на сервере, per user+system)
export interface ProgressData {
  achievements: string[];
  shards: string[];
  unlockedIds: string[];
  revealedSecrets: string[];
  solvedRiddles: string[];
  konamiUnlocked: boolean;
  secretRevealed: boolean;
  /** v5.5 — открытые досье с полным искажением ⟪…⟫ */
  irisReadIds: string[];
  /** v5.6 — сколько раз открывалось каждое ирис-досье (id → счётчик) */
  irisOpens?: Record<string, number>;
  gaze: number;
  updatedAt?: string;
}

// Краткая сводка прогресса для списка пользователей
export interface ProgressSummary {
  achievements: number;
  shards: number;
  unlockedIds: number;
  solvedRiddles: number;
  revealedSecrets: number;
  konamiUnlocked: boolean;
  gaze: number;
  updatedAt: string;
}

// Публичная карточка стража (из /api/users)
export interface UserSummary {
  login: string;
  displayName: string;
  system: GameSystem;
  role: UserRole;
  characterId: string | null;
  createdAt: string;
  summary: ProgressSummary | null;
}

// Страж в онлайне (из presence-сокета)
export interface PresenceUser {
  login: string;
  displayName: string;
  system: GameSystem;
  role: UserRole;
  since: number;
}

export interface BaseRecord {
  id: string;
  sigil: string;
  system: GameSystem;
  description: string;
  mapX: number;
  mapY: number;
  isLocked: boolean;
  isCorrupted: boolean;
  secretFragment: string | null;
  shardWord: string | null;
  /** цвет досье (violet/blue/green/amber/red/cyan/pink); null — стандартное */
  themeColor?: string | null;
  /** v5.5 — палитра ириса для ⟪…⟫; null — авто (под цвет досье) */
  irisColor?: string | null;
  createdAt: string;
}

export interface Character extends BaseRecord {
  name: string;
  title: string;
  category: string; // class/role
  race: string;
  kind: "HERO" | "NPC";
  factionId: string | null;
  imageUrl: string | null;
  status: "ALIVE" | "DEAD" | "MISSING";
}

export interface Faction {
  id: string;
  name: string;
  system: GameSystem;
  sigil: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  npcs: Character[];
}

export interface Lore extends BaseRecord {
  title: string;
  category: string;
  folder?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  status?: string;
  friendship?: number | null; // шкала дружбы (1-10) для второстепенных NPC
}

export interface Location extends BaseRecord {
  name: string;
  type: string;
}

// Загадка-врата (публичная часть, без списка ответов — они проверяются
// на сервере). Привязывается к записи по имени.
export interface RiddlePublic {
  recordName: string;
  sigil: string;
  title: string;
  subtitle: string | null;
  riddle: string[];
  hint: string | null;
  system: string | null;
  /** код достижения-награды за разгадку (если задан) */
  achievementCode: string | null;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  sigil: string;
  secretFragment?: string | null;
  system?: string | null;
}

export type ArchiveType =
  | "characters"
  | "lore"
  | "locations";

export interface Stats {
  totalRecords: number;
  sealedRecords: number;
  corruptedRecords: number;
  gazeBase: number;
  breakdown: {
    characters: number;
    lore: number;
    locations: number;
    factions: number;
  };
}

export const SYSTEM_LABEL: Record<GameSystem, string> = {
  DND: "D&D 5e · Элария",
  PF2E: "Pathfinder 2e · Голарион",
};

export const SYSTEM_SHORT: Record<GameSystem, string> = {
  DND: "ЭЛАРИЯ",
  PF2E: "ГОЛАРИОН",
};

export const SYSTEM_WORLD: Record<GameSystem, string> = {
  DND: "Элария",
  PF2E: "Голарион",
};

export const SYSTEM_COLOR: Record<GameSystem, string> = {
  DND: "var(--red)",
  PF2E: "var(--cyan)",
};
