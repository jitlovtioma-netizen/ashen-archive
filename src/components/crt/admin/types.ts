import { type GameSystem } from "@/lib/types";

export type RecKind =
  | "character"
  | "lore"
  | "location"
  | "faction"
  | "riddle"
  | "achievement";
export type TabKey =
  | "heroes"
  | "npcs"
  | "lore"
  | "gods"
  | "secondary"
  | "secrets"
  | "locations"
  | "factions"
  | "riddles"
  | "achievements";

export interface AdminCharacterRow {
  id: string;
  name: string;
  title: string;
  category: string;
  race: string;
  description: string;
  sigil: string;
  system: string;
  kind: string;
  sortOrder: number;
  factionId: string | null;
  imageUrl: string | null;
  status: string;
  isLocked: boolean;
  isCorrupted: boolean;
  shardWord: string | null;
  secretFragment: string | null;
  mapX: number;
  mapY: number;
  userModified: boolean;
}

export interface AdminLoreRow {
  id: string;
  title: string;
  category: string;
  description: string;
  sigil: string;
  system: string;
  folder: string | null;
  imageUrl: string | null;
  sortOrder: number;
  status: string;
  friendship: number | null;
  isLocked: boolean;
  isCorrupted: boolean;
  shardWord: string | null;
  secretFragment: string | null;
  mapX: number;
  mapY: number;
  userModified: boolean;
}

export interface AdminLocationRow {
  id: string;
  name: string;
  type: string;
  description: string;
  sigil: string;
  system: string;
  sortOrder: number;
  isLocked: boolean;
  isCorrupted: boolean;
  shardWord: string | null;
  secretFragment: string | null;
  mapX: number;
  mapY: number;
  userModified: boolean;
}

export interface AdminFactionRow {
  id: string;
  name: string;
  sigil: string;
  description: string;
  system: string;
  sortOrder: number;
  isCorrupted: boolean;
  userModified: boolean;
}

export interface AdminRiddleRow {
  id: string;
  recordName: string;
  sigil: string;
  title: string;
  subtitle: string | null;
  riddle: string;
  valid: string;
  hint: string | null;
  system: string | null;
  achievementCode: string | null;
  userModified: boolean;
}

export interface AdminAchievementRow {
  id: string;
  code: string;
  name: string;
  description: string;
  sigil: string;
  secretFragment: string | null;
  system: string | null;
  userModified: boolean;
}

export interface AdminData {
  characters: AdminCharacterRow[];
  lore: AdminLoreRow[];
  locations: AdminLocationRow[];
  factions: AdminFactionRow[];
  riddles: AdminRiddleRow[];
  achievements: AdminAchievementRow[];
  bindings: { login: string; displayName: string; characterId: string }[];
}

export type AnyRow =
  | AdminCharacterRow
  | AdminLoreRow
  | AdminLocationRow
  | AdminFactionRow
  | AdminRiddleRow
  | AdminAchievementRow;

export interface TabDef {
  key: TabKey;
  label: string;
  sigil: string;
  kind: RecKind;
  blurb: string;
}

export const TABS: TabDef[] = [
  { key: "heroes", label: "Герои", sigil: "⚔", kind: "character", blurb: "// досье действующих героев партии //" },
  { key: "npcs", label: "NPC фракций", sigil: "🎭", kind: "character", blurb: "// персонажи, привязанные к фракциям //" },
  { key: "lore", label: "Лор", sigil: "📖", kind: "lore", blurb: "// общий лор мира: эпохи, катастрофы, ресурсы //" },
  { key: "gods", label: "Божества", sigil: "✦", kind: "lore", blurb: "// пантеон мира //" },
  { key: "secondary", label: "Второстепенные", sigil: "🎭", kind: "lore", blurb: "// значимые NPC со шкалой дружбы //" },
  { key: "secrets", label: "Секреты", sigil: "🔓", kind: "lore", blurb: "// записи вкладки «Секреты» (за осколки памяти) //" },
  { key: "locations", label: "Локации", sigil: "🗺", kind: "location", blurb: "// места на карте мира //" },
  { key: "factions", label: "Фракции", sigil: "🜲", kind: "faction", blurb: "// организации и государства //" },
  { key: "riddles", label: "Загадки", sigil: "🎯", kind: "riddle", blurb: "// загадки-врата: досье откроется после верного ответа //" },
  { key: "achievements", label: "Достижения", sigil: "🏆", kind: "achievement", blurb: "// реестр достижений стражей //" },
];

export const SIGIL_PRESETS = ["⚔", "🛡", "🎭", "📖", "✦", "🗺", "🜲", "📜", "👑", "🐉", "🔥", "❄", "⚱", "🕯", "💀", "👁", "🗝", "🌙"];

export const FOLDER_LABELS: Record<string, string> = {
  PANTHEON: "ПАНТЕОН",
  SECONDARY_HEROES: "ВТОРОСТЕПЕННЫЕ",
  SECRETS: "СЕКРЕТЫ",
};

// ── Черновик формы ──────────────────────────────────────────────────────────

export interface Draft {
  name: string;
  title: string;
  category: string;
  race: string;
  description: string;
  sigil: string;
  kind: "HERO" | "NPC";
  factionId: string;
  folder: string;
  imageUrl: string;
  status: "ALIVE" | "DEAD" | "MISSING";
  friendship: string;
  sortOrder: string;
  isLocked: boolean;
  isCorrupted: boolean;
  shardWord: string;
  secretFragment: string;
  mapX: string;
  mapY: string;
  /** цвет досье (null — стандартное) */
  themeColor: string;
  /** v5.5 — палитра ириса для ⟪…⟫ ("" — авто: под цвет досье) */
  irisColor: string;
  /** поля загадки-врат */
  subtitle: string;
  answers: string;
  hint: string;
  /** поле достижения */
  code: string;
  /** мир загадки/достижения: "" — любой */
  scopeSystem: string;
  /** код достижения-награды за разгадку загадки */
  achievementCode: string;
}


export type FlagFilter = "all" | "user" | "corrupt" | "theme" | "locked";

export const RESTORE_TABLE_LABELS: Record<string, string> = {
  characters: "⚔ ГЕРОИ/NPC",
  lore: "📖 ЛОР",
  locations: "🗺 ЛОКАЦИИ",
  factions: "🜲 ФРАКЦИИ",
  riddles: "🎯 ЗАГАДКИ",
  achievements: "🏆 ДОСТИЖЕНИЯ",
};

export const FLAG_FILTERS: [FlagFilter, string][] = [
  ["all", "ВСЕ"],
  ["user", "✎ РУКОТВОРНЫЕ"],
  ["corrupt", "⚠ ПОРЧА"],
  ["theme", "◆ ЦВЕТ"],
  ["locked", "🔒 ПЕЧАТЬ"],
];

// ── Главный компонент ───────────────────────────────────────────────────────

/** Форма редактора — вынесена в тип для черновиков/порядка. */
export interface EditorState {
  mode: "create" | "edit";
  kind: RecKind;
  id: string | null;
  name: string;
  draft: Draft;
}

/** Вкладки, где записи показываются в порядке архива (drag-n-drop доступен). */
export const SORTABLE_TABS = new Set<TabKey>([
  "heroes",
  "npcs",
  "lore",
  "gods",
  "secondary",
  "secrets",
  "locations",
  "factions",
]);

/** Ключ автосохраняемого черновика в localStorage. */
export function draftKey(e: EditorState, system: GameSystem): string {
  return `ashen-admin-draft:${e.kind}:${e.mode}:${e.id ?? "new"}:${system}`;
}
