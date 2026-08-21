// Types matching the backend Prisma models (see /agent-ctx/A-backend.md)

export type GameSystem = "DND" | "PF2E";

export interface User {
  login: string;
  displayName: string;
  system: GameSystem;
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

// Chronicle — запись о сессии партии (хроника)
export interface Chronicle {
  id: string;
  sessionNumber: number;
  title: string;
  summary: string;
  date: string; // ISO-дата строкой, напр. "2024-03-15"
  system: GameSystem;
  isLocked: boolean;
  isCorrupted: boolean;
  secretFragment: string | null;
  shardWord: string | null;
  createdAt: string;
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
  | "locations"
  | "chronicles";

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
