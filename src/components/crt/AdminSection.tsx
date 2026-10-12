"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { SYSTEM_LABEL, SYSTEM_COLOR, type GameSystem } from "@/lib/types";
import { DOSSIER_THEMES, DOSSIER_THEME_KEYS, IRIS_PALETTES, IRIS_PALETTE_KEYS } from "@/lib/themes";
import { CorruptToolbar } from "./CorruptEditorTools";

// ─────────────────────────────────────────────────────────────────────────────
// МАСТЕРСКАЯ СОЗИДАТЕЛЯ — панель CRUD для всех записей архива.
// Администратор создаёт героев, второстепенных героев, божеств, секреты,
// лор, локации, фракции, загадки и достижения; правит и удаляет любую запись.
// Правки пишутся в общую базу — их видят ВСЕ стражи (dataRevision).
// Всё, что создано здесь, помечено userModified — merge-seed не трогает это
// при обновлениях архива (правки не сбрасываются).
// ─────────────────────────────────────────────────────────────────────────────

type RecKind =
  | "character"
  | "lore"
  | "location"
  | "faction"
  | "riddle"
  | "achievement";
type TabKey =
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

interface AdminCharacterRow {
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

interface AdminLoreRow {
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

interface AdminLocationRow {
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

interface AdminFactionRow {
  id: string;
  name: string;
  sigil: string;
  description: string;
  system: string;
  sortOrder: number;
  isCorrupted: boolean;
  userModified: boolean;
}

interface AdminRiddleRow {
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

interface AdminAchievementRow {
  id: string;
  code: string;
  name: string;
  description: string;
  sigil: string;
  secretFragment: string | null;
  system: string | null;
  userModified: boolean;
}

interface AdminData {
  characters: AdminCharacterRow[];
  lore: AdminLoreRow[];
  locations: AdminLocationRow[];
  factions: AdminFactionRow[];
  riddles: AdminRiddleRow[];
  achievements: AdminAchievementRow[];
  bindings: { login: string; displayName: string; characterId: string }[];
}

type AnyRow =
  | AdminCharacterRow
  | AdminLoreRow
  | AdminLocationRow
  | AdminFactionRow
  | AdminRiddleRow
  | AdminAchievementRow;

interface TabDef {
  key: TabKey;
  label: string;
  sigil: string;
  kind: RecKind;
  blurb: string;
}

const TABS: TabDef[] = [
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

const SIGIL_PRESETS = ["⚔", "🛡", "🎭", "📖", "✦", "🗺", "🜲", "📜", "👑", "🐉", "🔥", "❄", "⚱", "🕯", "💀", "👁", "🗝", "🌙"];

const FOLDER_LABELS: Record<string, string> = {
  PANTHEON: "ПАНТЕОН",
  SECONDARY_HEROES: "ВТОРОСТЕПЕННЫЕ",
  SECRETS: "СЕКРЕТЫ",
};

// ── Черновик формы ──────────────────────────────────────────────────────────

interface Draft {
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

function emptyDraft(tab: TabKey): Draft {
  return {
    name: "",
    title: "",
    category: "",
    race: "",
    description: "",
    sigil:
      tab === "gods" ? "✦"
      : tab === "secondary" || tab === "npcs" ? "🎭"
      : tab === "secrets" ? "🔓"
      : tab === "lore" ? "📖"
      : tab === "locations" ? "🗺"
      : tab === "factions" ? "🜲"
      : tab === "riddles" ? "🎯"
      : tab === "achievements" ? "🏆"
      : "⚔",
    kind: tab === "npcs" ? "NPC" : "HERO",
    factionId: "",
    folder:
      tab === "gods" ? "PANTHEON"
      : tab === "secondary" ? "SECONDARY_HEROES"
      : tab === "secrets" ? "SECRETS"
      : "",
    imageUrl: "",
    status: "ALIVE",
    friendship: "",
    sortOrder: "0",
    isLocked: false,
    isCorrupted: false,
    shardWord: "",
    secretFragment: "",
    mapX: "0",
    mapY: "0",
    themeColor: "",
    irisColor: "",
    subtitle: "",
    answers: "",
    hint: "",
    code: "",
    scopeSystem: "",
    achievementCode: "",
  };
}

function draftFromRow(kind: RecKind, r: AnyRow): Draft {
  const g = (k: string) =>
    (r as unknown as Record<string, unknown>)[k] ?? "";
  const d = emptyDraft("lore");
  d.description = String(g("description") || g("riddle"));
  d.sigil = String(g("sigil")) || "✦";
  d.isLocked = !!g("isLocked");
  d.isCorrupted = !!g("isCorrupted");
  d.shardWord = String(g("shardWord") ?? "");
  d.secretFragment = String(g("secretFragment") ?? "");
  d.mapX = String(g("mapX") || 0);
  d.mapY = String(g("mapY") || 0);
  d.themeColor = String(g("themeColor") ?? "");
  d.irisColor = String(g("irisColor") ?? "");
  if (kind === "character") {
    const c = r as AdminCharacterRow;
    d.name = c.name;
    d.title = c.title;
    d.category = c.category;
    d.race = c.race;
    d.kind = c.kind === "NPC" ? "NPC" : "HERO";
    d.factionId = c.factionId ?? "";
    d.imageUrl = c.imageUrl ?? "";
    d.status = (c.status as Draft["status"]) || "ALIVE";
    d.sortOrder = String(c.sortOrder ?? 0);
  } else if (kind === "lore") {
    const l = r as AdminLoreRow;
    d.name = l.title;
    d.category = l.category;
    d.folder = l.folder ?? "";
    d.imageUrl = l.imageUrl ?? "";
    d.status = (l.status as Draft["status"]) || "ALIVE";
    d.friendship = l.friendship ? String(l.friendship) : "";
    d.sortOrder = String(l.sortOrder ?? 0);
  } else if (kind === "location") {
    const loc = r as AdminLocationRow;
    d.name = loc.name;
    d.category = loc.type;
    d.sortOrder = String(loc.sortOrder ?? 0);
  } else if (kind === "faction") {
    const f = r as AdminFactionRow;
    d.name = f.name;
    d.sortOrder = String(f.sortOrder ?? 0);
  } else if (kind === "riddle") {
    const q = r as AdminRiddleRow;
    d.name = q.recordName;
    d.title = q.title;
    d.subtitle = q.subtitle ?? "";
    d.hint = q.hint ?? "";
    d.scopeSystem = q.system ?? "";
    d.achievementCode = q.achievementCode ?? "";
    try {
      const arr = JSON.parse(q.valid) as unknown;
      d.answers = Array.isArray(arr) ? arr.join(", ") : "";
    } catch {
      d.answers = "";
    }
  } else {
    const a = r as AdminAchievementRow;
    d.name = a.name;
    d.code = a.code;
    d.scopeSystem = a.system ?? "";
  }
  return d;
}

function buildPayload(kind: RecKind, d: Draft, system: GameSystem): Record<string, unknown> {
  const num = (s: string, fallback: number) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : fallback;
  };
  if (kind === "riddle") {
    return {
      recordName: d.name.trim(),
      title: d.title.trim() || d.name.trim(),
      sigil: d.sigil.trim() || "🎯",
      subtitle: d.subtitle.trim(),
      riddle: d.description.trim(),
      valid: d.answers
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      hint: d.hint.trim(),
      system: d.scopeSystem || null,
      achievementCode: d.achievementCode.trim() || null,
    };
  }
  if (kind === "achievement") {
    return {
      code: d.code.trim(),
      name: d.name.trim(),
      description: d.description.trim(),
      sigil: d.sigil.trim() || "🏆",
      secretFragment: d.secretFragment.trim(),
      system: d.scopeSystem || null,
    };
  }
  const p: Record<string, unknown> = {
    system,
    sigil: d.sigil.trim() || "✦",
    description: d.description.trim(),
    isLocked: d.isLocked,
    isCorrupted: d.isCorrupted,
    shardWord: d.shardWord.trim(),
    secretFragment: d.secretFragment.trim(),
    themeColor: d.themeColor || null,
    irisColor: d.irisColor || null,
  };
  if (kind === "character") {
    p.name = d.name.trim();
    p.title = d.title.trim();
    p.category = d.category.trim();
    p.race = d.race.trim();
    p.kind = d.kind;
    p.factionId = d.kind === "NPC" && d.factionId ? d.factionId : null;
    p.imageUrl = d.imageUrl.trim();
    p.status = d.status;
    p.mapX = num(d.mapX, 0);
    p.mapY = num(d.mapY, 0);
    p.sortOrder = num(d.sortOrder, 0);
  } else if (kind === "lore") {
    p.title = d.name.trim();
    p.category = d.category.trim();
    p.folder = d.folder;
    p.imageUrl = d.imageUrl.trim();
    p.status = d.status;
    p.sortOrder = num(d.sortOrder, 0);
    p.friendship =
      d.folder === "SECONDARY_HEROES" && d.friendship ? num(d.friendship, 0) : null;
    p.mapX = num(d.mapX, 0);
    p.mapY = num(d.mapY, 0);
  } else if (kind === "location") {
    p.name = d.name.trim();
    p.type = d.category.trim();
    p.mapX = num(d.mapX, 0);
    p.mapY = num(d.mapY, 0);
    p.sortOrder = num(d.sortOrder, 0);
  } else {
    p.name = d.name.trim();
    p.sortOrder = num(d.sortOrder, 0);
    // у фракций нет цвета досье и ириса
    delete p.themeColor;
    delete p.irisColor;
  }
  return p;
}

function tabForRecord(kind: RecKind, r: AnyRow): TabKey {
  if (kind === "character") return (r as AdminCharacterRow).kind === "NPC" ? "npcs" : "heroes";
  if (kind === "lore") {
    const f = (r as AdminLoreRow).folder;
    if (f === "PANTHEON") return "gods";
    if (f === "SECONDARY_HEROES") return "secondary";
    if (f === "SECRETS") return "secrets";
    return "lore";
  }
  if (kind === "location") return "locations";
  if (kind === "faction") return "factions";
  if (kind === "riddle") return "riddles";
  return "achievements";
}

// ── Строка списка ───────────────────────────────────────────────────────────

interface RowView {
  id: string;
  name: string;
  subtitle: string;
  sigil: string;
  chips: { text: string; cls?: string; title?: string }[];
}

function rowsForTab(data: AdminData, tab: TabKey): AnyRow[] {
  switch (tab) {
    case "heroes":
      return data.characters.filter((c) => c.kind !== "NPC");
    case "npcs":
      return data.characters.filter((c) => c.kind === "NPC");
    case "lore":
      return data.lore.filter((l) => !l.folder);
    case "gods":
      return data.lore.filter((l) => l.folder === "PANTHEON");
    case "secondary":
      return data.lore.filter((l) => l.folder === "SECONDARY_HEROES");
    case "secrets":
      return data.lore.filter((l) => l.folder === "SECRETS");
    case "locations":
      return data.locations;
    case "factions":
      return data.factions;
    case "riddles":
      return data.riddles;
    case "achievements":
      return data.achievements;
  }
}

function rowView(data: AdminData, kind: RecKind, r: AnyRow): RowView {
  const chips: RowView["chips"] = [];
  const bound = data.bindings.find((b) => b.characterId === r.id);
  if (kind === "character") {
    const c = r as AdminCharacterRow;
    if (c.status === "DEAD") chips.push({ text: "💀 ПАЛ", cls: "chip-err" });
    if (c.status === "MISSING") chips.push({ text: "? ПРОПАЛ", cls: "chip-warn" });
    if (bound) chips.push({ text: `👤 ${bound.login}`, title: `Досье привязано к стражу ${bound.displayName}` });
  } else if (kind === "lore") {
    const l = r as AdminLoreRow;
    if (l.folder) chips.push({ text: FOLDER_LABELS[l.folder] ?? l.folder });
    if (l.status === "DEAD") chips.push({ text: "💀 ПАЛ", cls: "chip-err" });
    if (l.status === "MISSING") chips.push({ text: "? ПРОПАЛ", cls: "chip-warn" });
    if (l.friendship) chips.push({ text: `❤ ${l.friendship}/10`, title: "Шкала дружбы" });
  } else if (kind === "location") {
    // без доп. чипов
  } else if (kind === "faction") {
    const f = r as AdminFactionRow;
    const npcCount = data.characters.filter(
      (c) => c.kind === "NPC" && c.factionId === f.id,
    ).length;
    chips.push({ text: `NPC: ${npcCount}` });
  } else if (kind === "riddle") {
    const q = r as AdminRiddleRow;
    chips.push({ text: "🎯 ВРАТА", title: "Досье записи откроется после верного ответа" });
    try {
      const n = (JSON.parse(q.valid) as unknown[]).length;
      chips.push({ text: `ответов: ${n}`, title: "Верные ответы (видны только здесь)" });
    } catch {
      /* пусто */
    }
    if (!q.system) chips.push({ text: "☾ ЛЮБОЙ МИР" });
  } else {
    const a = r as AdminAchievementRow;
    if (a.secretFragment) chips.push({ text: "⟁ СОКРЫТОЕ", title: "Есть скрытый фрагмент" });
    if (!a.system) chips.push({ text: "☾ ЛЮБОЙ МИР" });
  }
  const rr = r as unknown as Record<string, unknown>;
  if (rr.userModified) {
    chips.push({ text: "✎ РУКОТВОРНО", title: "Создано/изменено в Мастерской — обновления архива не трогают" });
  }
  if (rr.isLocked) chips.push({ text: "🔒 ПЕЧАТЬ", cls: "chip-warn", title: "Запись опечатана — требуется ритуал" });
  if (rr.isCorrupted) chips.push({ text: "⚠ ПОРЧА", cls: "chip-err", title: "Текст искажается корруптами" });
  if (rr.shardWord) chips.push({ text: `🧩 ${rr.shardWord}`, cls: "chip-violet", title: "Осколок памяти" });
  if (rr.secretFragment && kind !== "achievement") chips.push({ text: "⟁ СОКРЫТОЕ", title: "Есть скрытый фрагмент" });
  if (rr.themeColor) {
    chips.push({
      text: "◆ ЦВЕТ",
      title: `Особое досье: ${String(rr.themeColor)}`,
    });
  }
  if (rr.irisColor) {
    const pal = IRIS_PALETTES[String(rr.irisColor)];
    chips.push({
      text: "ꙮ ИРИС",
      title: `Палитра ириса: ${pal?.label ?? String(rr.irisColor)} — ${pal?.hint ?? ""}`,
    });
  }
  if (kind === "riddle" && rr.achievementCode) {
    chips.push({ text: `🏆 ${String(rr.achievementCode)}`, cls: "chip-violet", title: "Награда-достижение за разгадку" });
  }

  let name = "";
  let subtitle = "";
  let sigil = "";
  if (kind === "character") {
    const c = r as AdminCharacterRow;
    name = c.name;
    subtitle = [c.category, c.race, c.title].filter(Boolean).join(" · ");
    sigil = c.sigil;
  } else if (kind === "lore") {
    const l = r as AdminLoreRow;
    name = l.title;
    subtitle = l.category;
    sigil = l.sigil;
  } else if (kind === "location") {
    const loc = r as AdminLocationRow;
    name = loc.name;
    subtitle = loc.type;
    sigil = loc.sigil;
  } else if (kind === "faction") {
    const f = r as AdminFactionRow;
    name = f.name;
    subtitle = "";
    sigil = f.sigil;
  } else if (kind === "riddle") {
    const q = r as AdminRiddleRow;
    name = q.recordName;
    subtitle = q.title;
    sigil = q.sigil ?? "🎯";
  } else {
    const a = r as AdminAchievementRow;
    name = a.name;
    subtitle = a.code;
    sigil = a.sigil ?? "🏆";
  }
  return { id: r.id, name, subtitle, sigil, chips };
}

type FlagFilter = "all" | "user" | "corrupt" | "theme" | "locked";

const RESTORE_TABLE_LABELS: Record<string, string> = {
  characters: "⚔ ГЕРОИ/NPC",
  lore: "📖 ЛОР",
  locations: "🗺 ЛОКАЦИИ",
  factions: "🜲 ФРАКЦИИ",
  riddles: "🎯 ЗАГАДКИ",
  achievements: "🏆 ДОСТИЖЕНИЯ",
};

const FLAG_FILTERS: [FlagFilter, string][] = [
  ["all", "ВСЕ"],
  ["user", "✎ РУКОТВОРНЫЕ"],
  ["corrupt", "⚠ ПОРЧА"],
  ["theme", "◆ ЦВЕТ"],
  ["locked", "🔒 ПЕЧАТЬ"],
];

// ── Главный компонент ───────────────────────────────────────────────────────

/** Форма редактора — вынесена в тип для черновиков/порядка. */
interface EditorState {
  mode: "create" | "edit";
  kind: RecKind;
  id: string | null;
  name: string;
  draft: Draft;
}

/** Вкладки, где записи показываются в порядке архива (drag-n-drop доступен). */
const SORTABLE_TABS = new Set<TabKey>([
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
function draftKey(e: EditorState, system: GameSystem): string {
  return `ashen-admin-draft:${e.kind}:${e.mode}:${e.id ?? "new"}:${system}`;
}

export function AdminSection({ system: userSystem }: { system: GameSystem }) {
  const user = useArchive((s) => s.user);
  const pushToast = useArchive((s) => s.pushToast);
  const bumpDataRevision = useArchive((s) => s.bumpDataRevision);
  const adminEditTarget = useArchive((s) => s.adminEditTarget);
  const setAdminEditTarget = useArchive((s) => s.setAdminEditTarget);

  const [tabSystem, setTabSystem] = useState<GameSystem>(userSystem);
  const [tab, setTab] = useState<TabKey>("heroes");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  /** черновик «как было» на момент открытия — для dirty/сброса */
  const [initialDraft, setInitialDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [media, setMedia] = useState<string[]>([]);
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("all");
  // v5.7 — «ирис в цифрах»: агрегация поглощения по всем стражам
  const [irisStats, setIrisStats] = useState<{
    totals: { records: number; players: number; opens: number; eaten: number };
    rows: { id: string; name: string; kind: string; system: string; opens: number; readers: number; stage: number; cleanWords: number; eaten: number }[];
  } | null>(null);
  // восстановление из бэкапа: превью и применение
  const [restorePreview, setRestorePreview] = useState<{
    report: Record<string, { restored: number; skipped: number }>;
    usersToRebind: number;
    exportedAt: string;
    dump: unknown;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const restoreFileRef = useRef<HTMLInputElement | null>(null);
  // v5.7.1 — seed.zip: весь проект одним файлом (исходники + база + доки)
  // для развёртывания вручную. В песочнице архив фантомно исчезает при
  // снапшот-ресторах — потому кнопка в тулбаре проверяет наличие (HEAD
  // /seed.zip) и умеет пересобирать его прямо из браузера (API make-seed).
  const [seedState, setSeedState] = useState<"checking" | "ready" | "missing" | "error">("checking");
  const [seedSize, setSeedSize] = useState(0);
  const [seedBusy, setSeedBusy] = useState(false);

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  /**
   * Открыть редактор. Если в localStorage лежит несохранённый черновик этой
   * записи — вернуть именно его (тост «ЧЕРНОВИК ВОССТАНОВЛЕН»). Копия из ⧉
   * самодостаточна — для неё восстановление пропускаем.
   */
  const openEditorState = useCallback(
    (next: EditorState, skipRestore = false) => {
      // база для «dirty» и ⌫ СБРОС — всегда СВЕЖИЙ досье записи из базы,
      // даже если черновик восстановлен: сброс должен откатывать к оригиналу
      const freshDraft = next.draft;
      if (!skipRestore) {
        const key = draftKey(next, tabSystem);
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const saved = JSON.parse(raw) as Draft;
            if (JSON.stringify(saved) !== JSON.stringify(freshDraft)) {
              next = { ...next, draft: saved };
              pushToast({
                kind: "info",
                sigil: "⌫",
                title: "ЧЕРНОВИК ВОССТАНОВЛЕН",
                body: "Найден несохранённый черновик этой записи — «⌫ СБРОС» вернёт исходный текст.",
              });
            } else {
              localStorage.removeItem(key);
            }
          }
        } catch {
          /* повреждённый черновик — игнорируем */
        }
      }
      setInitialDraft(freshDraft);
      setEditor(next);
    },
    [tabSystem, pushToast],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/records?system=${tabSystem}&requester=${encodeURIComponent(user.login)}`,
      );
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setData(d as AdminData);
      setError(null);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }, [user, tabSystem]);

  useEffect(() => {
    void load();
  }, [load]);

  // v5.7 — ирис-статистика (агрегация поглощения по всем стражам):
  // независимый запрос, не блокирует основную загрузку
  useEffect(() => {
    if (!user) return;
    fetch(`/api/admin/iris-stats?requester=${encodeURIComponent(user.login)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.ok) setIrisStats({ totals: d.totals, rows: d.rows });
      })
      .catch(() => {});
  }, [user, data]);

  // список изображений для подсказок в поле «путь к изображению»
  useEffect(() => {
    fetch("/api/admin/media")
      .then((r) => r.json())
      .then((d: { images?: string[] }) => setMedia(d.images ?? []))
      .catch(() => {});
  }, []);

  // v5.7.1 — проверить доступность seed.zip. Файл живёт в seed-archive/
  // (НЕ в public/: dev-вотчер Next.js стирал его оттуда — «фантом»),
  // поэтому статус спрашиваем у API, а не у статики
  const checkSeedZip = useCallback(() => {
    if (!user) return;
    setSeedState("checking");
    fetch(`/api/admin/make-seed?requester=${encodeURIComponent(user.login)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.ok && d.exists) {
          if (typeof d.size === "number" && d.size > 0) setSeedSize(d.size);
          setSeedState("ready");
        } else if (d && d.ok) {
          setSeedState("missing");
        } else {
          setSeedState("error");
        }
      })
      .catch(() => setSeedState("error"));
  }, [user]);

  useEffect(() => {
    checkSeedZip();
  }, [checkSeedZip]);

  // v5.7.1 — скачивание: подписанная ссылка (только админам, 15 минут),
  // файл приходит аттачментом через blob — без ухода со страницы
  const downloadSeedZip = useCallback(async () => {
    if (!user || seedBusy) return;
    setSeedBusy(true);
    try {
      const res = await fetch(
        `/api/admin/make-seed?requester=${encodeURIComponent(user.login)}&issue=1`,
      );
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.hint ?? d.error ?? `HTTP ${res.status}`);
      const fileRes = await fetch(d.url as string);
      if (!fileRes.ok) {
        const err = await fileRes.json().catch(() => null);
        throw new Error(err?.hint ?? `HTTP ${fileRes.status}`);
      }
      const blob = await fileRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "seed.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      pushToast({
        kind: "info",
        sigil: "⇩",
        title: "АРХИВ УХОДИТ К ВАМ",
        body: `seed.zip · ${(blob.size / 1024).toFixed(0)} КБ — исходники, база, доки одним файлом.`,
      });
    } catch (e) {
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "АРХИВ НЕ ДОСТУПЕН",
        body: String((e as Error).message || e),
      });
    } finally {
      setSeedBusy(false);
    }
  }, [user, seedBusy, pushToast]);

  // v5.7.1 — пересобрать seed.zip прямо из браузера (фантом исчез —
  // кнопка «⟳» поднимает архив без ssh и ручных команд)
  const buildSeedZip = useCallback(async () => {
    if (!user || seedBusy) return;
    setSeedBusy(true);
    try {
      const res = await fetch("/api/admin/make-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester: user.login }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.hint ?? d.error ?? `HTTP ${res.status}`);
      if (typeof d.size === "number" && d.size > 0) setSeedSize(d.size);
      pushToast({
        kind: "info",
        sigil: "⇩",
        title: "АРХИВ СОБРАН",
        body: `seed.zip · ${d.files ? `${d.files} файлов · ` : ""}${(d.size / 1024).toFixed(0)} КБ — готов к скачиванию.`,
      });
      checkSeedZip();
    } catch (e) {
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "АРХИВ НЕ СОБРАЛСЯ",
        body: String((e as Error).message || e),
      });
      setSeedState("error");
    } finally {
      setSeedBusy(false);
    }
  }, [user, seedBusy, pushToast, checkSeedZip]);

  // переход «в мастерскую» из досье: открыть форму нужной записи
  useEffect(() => {
    if (!adminEditTarget || !data) return;
    const { kind, id, system: recSystem } = adminEditTarget;
    if (recSystem !== tabSystem) {
      setTabSystem(recSystem);
      return; // данные перезагрузятся — эффект сработает снова
    }
    const pool: AnyRow[] =
      kind === "character"
        ? data.characters
        : kind === "lore"
          ? data.lore
          : kind === "location"
            ? data.locations
            : data.factions;
    const rec = pool.find((r) => r.id === id);
    setAdminEditTarget(null);
    if (rec) {
      setTab(tabForRecord(kind, rec));
      openEditorState({
        mode: "edit",
        kind,
        id,
        name: rowView(data, kind, rec).name,
        draft: draftFromRow(kind, rec),
      });
      setSaveError(null);
      sfx.select();
    } else {
      pushToast({
        kind: "warn",
        sigil: "✎",
        title: "ЗАПИСЬ НЕ НАЙДЕНА",
        body: "Возможно, она уже удалена из архива.",
      });
    }
  }, [adminEditTarget, data, tabSystem, openEditorState]);

  // сброс подтверждения удаления через 3.5с
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(null), 3500);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const rows = useMemo<AnyRow[]>(() => (data ? rowsForTab(data, tab) : []), [data, tab]);
  const views = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (flagFilter === "all") return true;
        const rr = r as unknown as Record<string, unknown>;
        if (flagFilter === "user") return rr.userModified === true;
        if (flagFilter === "corrupt") return rr.isCorrupted === true;
        if (flagFilter === "theme") return !!rr.themeColor;
        return rr.isLocked === true;
      })
      .map((r) => rowView(data, activeTab.kind, r))
      .filter((v) => {
        if (!q) return true;
        return (
          v.name.toLowerCase().includes(q) || v.subtitle.toLowerCase().includes(q)
        );
      });
  }, [data, rows, search, flagFilter, activeTab.kind]);

  // ── Порядок записей: drag-n-drop (⠿ в строке) ──
  // Перетаскивание доступно только на «чистом» списке: без поиска и фильтра —
  // иначе новый порядок подмножества неоднозначен.
  const canDrag =
    SORTABLE_TABS.has(tab) &&
    !search.trim() &&
    flagFilter === "all" &&
    !loading &&
    !error &&
    views.length > 1;

  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    sfx.blip();
  };

  /** Применить порядок локально: 10, 20, 30… и пересортировать пул вкладки. */
  const applyLocalOrder = (reordered: AnyRow[]): AdminData => {
    if (!data) throw new Error("no data");
    const orderMap = new Map(reordered.map((r, i) => [r.id, (i + 1) * 10]));
    const withOrder = (pool: AnyRow[]) =>
      pool
        .map((r) => {
          const o = orderMap.get(r.id);
          return o === undefined ? r : { ...r, sortOrder: o };
        })
        .sort((a, b) => {
          const oa = (a as unknown as { sortOrder?: number }).sortOrder ?? 0;
          const ob = (b as unknown as { sortOrder?: number }).sortOrder ?? 0;
          if (oa !== ob) return oa - ob;
          const ra = a as unknown as { name?: string; title?: string };
          const rb = b as unknown as { name?: string; title?: string };
          const na = ra.name ?? ra.title ?? "";
          const nb = rb.name ?? rb.title ?? "";
          return na.localeCompare(nb);
        });
    switch (activeTab.kind) {
      case "character":
        return { ...data, characters: withOrder(data.characters) as AdminCharacterRow[] };
      case "lore":
        return { ...data, lore: withOrder(data.lore) as AdminLoreRow[] };
      case "location":
        return { ...data, locations: withOrder(data.locations) as AdminLocationRow[] };
      case "faction":
        return { ...data, factions: withOrder(data.factions) as AdminFactionRow[] };
      default:
        return data;
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setDragId(null);
    if (!over || active.id === over.id || !data || !user) return;
    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const reordered = arrayMove(rows, oldIndex, newIndex);
    const activeName = views.find((v) => v.id === active.id)?.name ?? "запись";

    // оптимистично: список уже в новом порядке
    setData(applyLocalOrder(reordered));
    sfx.select();
    try {
      const res = await fetch("/api/admin/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester: user.login,
          kind: activeTab.kind,
          system: tabSystem,
          ids: reordered.map((r) => r.id),
        }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      bumpDataRevision();
      pushToast({
        kind: "info",
        sigil: "⠿",
        title: "ПОРЯДОК ОБНОВЛЁН",
        body: `«${activeName}» теперь на ${newIndex + 1}-м месте. Новый порядок увидят все стражи.`,
      });
    } catch (err) {
      sfx.error();
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "ПОРЯДОК НЕ СОХРАНЁН",
        body: `Архив отказал (${String((err as Error).message ?? err)}) — список перечитается из базы.`,
      });
      void load();
    }
  };

  const dragView = dragId ? views.find((v) => v.id === dragId) : null;

  // ── Сводка архива: счётчики здоровья и аудит длины текстов ──
  const stats = useMemo(() => {
    if (!data) return null;
    const content = [
      ...data.characters,
      ...data.lore,
      ...data.locations,
      ...data.factions,
    ] as unknown as Record<string, unknown>[];
    const themed = [...data.characters, ...data.lore, ...data.locations].filter(
      (r) => !!(r as unknown as Record<string, unknown>).themeColor,
    ).length;
    return {
      total: content.length,
      user: content.filter((r) => r.userModified === true).length,
      themed,
      corrupt: content.filter((r) => r.isCorrupted === true).length,
      locked: content.filter((r) => r.isLocked === true).length,
      rewardedRiddles: data.riddles.filter((q) => q.achievementCode).length,
      images: content.filter((r) => !!r.imageUrl).length,
    };
  }, [data]);

  const lenAudit = useMemo(() => {
    if (!data) return [];
    const items: { kind: RecKind; rec: AnyRow; name: string; len: number }[] = [];
    for (const c of data.characters)
      items.push({ kind: "character", rec: c, name: c.name, len: c.description.length });
    for (const l of data.lore)
      items.push({ kind: "lore", rec: l, name: l.title, len: l.description.length });
    for (const loc of data.locations)
      items.push({ kind: "location", rec: loc, name: loc.name, len: loc.description.length });
    return items.sort((a, b) => b.len - a.len).slice(0, 5);
  }, [data]);

  const jumpToRecord = (kind: RecKind, rec: AnyRow) => {
    if (!data) return;
    setTab(tabForRecord(kind, rec));
    setSearch("");
    setFlagFilter("all");
    openEditorState({
      mode: "edit",
      kind,
      id: rec.id,
      name: rowView(data, kind, rec).name,
      draft: draftFromRow(kind, rec),
    });
    setSaveError(null);
    sfx.select();
  };

  const openCreate = () => {
    openEditorState({
      mode: "create",
      kind: activeTab.kind,
      id: null,
      name: "",
      draft: emptyDraft(tab),
    });
    setSaveError(null);
    sfx.select();
  };

  const openEdit = (id: string) => {
    if (!data) return;
    const rec = rows.find((r) => r.id === id);
    if (!rec) return;
    openEditorState({
      mode: "edit",
      kind: activeTab.kind,
      id,
      name: rowView(data, activeTab.kind, rec).name,
      draft: draftFromRow(activeTab.kind, rec),
    });
    setSaveError(null);
    sfx.select();
  };

  // ⌫ сброс: вернуть значения до правок
  const resetDraft = () => {
    if (!editor || !initialDraft) return;
    setEditor((e) => (e ? { ...e, draft: initialDraft } : e));
    sfx.blip();
  };

  const closeEditor = () => {
    setEditor(null);
    setInitialDraft(null);
    setSaveError(null);
    sfx.blip();
  };

  // ── Автосохранение черновика: только когда есть правки; переживает
  // перезагрузку вкладки и случайные закрытия. Возврат к исходнику — стирает.
  const dirty = useMemo(
    () => !!editor && JSON.stringify(editor.draft) !== JSON.stringify(initialDraft),
    [editor, initialDraft],
  );

  useEffect(() => {
    if (!editor) return;
    const key = draftKey(editor, tabSystem);
    const t = setTimeout(() => {
      try {
        if (dirty) localStorage.setItem(key, JSON.stringify(editor.draft));
        else localStorage.removeItem(key);
      } catch {
        /* квота/приватный режим — молча */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [editor, dirty, tabSystem]);

  // защита от закрытия вкладки с несохранённой правкой
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ⧉ дублирование: черновик из записи, имя с суффиксом, код ачивки уникален
  const openClone = (id: string) => {
    if (!data) return;
    const rec = rows.find((r) => r.id === id);
    if (!rec) return;
    const d = draftFromRow(activeTab.kind, rec);
    if (activeTab.kind === "riddle") {
      d.title = `${d.title} (копия)`;
    } else if (activeTab.kind === "achievement") {
      d.code = `${d.code}_COPY`.slice(0, 60);
      d.name = `${d.name} (копия)`;
    } else {
      d.name = `${d.name} (копия)`;
    }
    // копия самодостаточна — прежний несохранённый «новый» черновик убираем
    try {
      localStorage.removeItem(
        draftKey(
          { mode: "create", kind: activeTab.kind, id: null, name: "", draft: d },
          tabSystem,
        ),
      );
    } catch {
      /* ignore */
    }
    openEditorState(
      {
        mode: "create",
        kind: activeTab.kind,
        id: null,
        name: "",
        draft: d,
      },
      true,
    );
    setSaveError(null);
    sfx.select();
  };

  // ⇩ бэкап: полный слепок архива в JSON
  const doBackup = async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/admin/export?requester=${encodeURIComponent(user.login)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `archive-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      sfx.unlock();
      pushToast({
        kind: "ach",
        sigil: "⇩",
        title: "БЭКАП ГОТОВ",
        body: "Полный слепок архива скачан в JSON. Храните его в надёжном месте.",
      });
    } catch {
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "БЭКАП НЕ УДАЛСЯ",
        body: "Архив недоступен — попробуйте ещё раз.",
      });
      sfx.error();
    }
  };

  // ⇧ восстановление из бэкапа: чтение файла → превью на сервере → модалка
  const doRestoreFile = async (file: File) => {
    setRestoreError(null);
    try {
      const text = await file.text();
      let dump: unknown;
      try {
        dump = JSON.parse(text);
      } catch {
        setRestoreError("Файл не является корректным JSON — выберите бэкап архива");
        sfx.error();
        return;
      }
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester: user.login, action: "preview", dump }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        const hints: Record<string, string> = {
          FORBIDDEN: "Только Созидатель может восстанавливать архив",
          BAD_DUMP: "Это не бэкап архива — файл создаётся кнопкой «⇩ БЭКАП»",
        };
        setRestoreError(hints[d.error as string] ?? `Архив отказал: ${d.error ?? res.status}`);
        sfx.error();
        return;
      }
      setRestorePreview({
        report: d.report,
        usersToRebind: d.usersToRebind,
        exportedAt: d.exportedAt,
        dump,
      });
      sfx.select();
    } catch {
      setRestoreError("Сеть архива недоступна — попробуйте ещё раз");
      sfx.error();
    }
  };

  const doRestoreApply = async () => {
    if (!restorePreview || !user) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester: user.login,
          action: "restore",
          dump: restorePreview.dump,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setRestoreError(`Архив отказал: ${d.error ?? res.status}`);
        sfx.error();
        return;
      }
      const total = Object.values(d.restored as Record<string, number>).reduce(
        (a: number, b: number) => a + b,
        0,
      );
      setRestorePreview(null);
      await load();
      bumpDataRevision();
      sfx.unlock();
      pushToast({
        kind: "ach",
        sigil: "⇧",
        title: "АРХИВ ВОССТАНОВЛЕН",
        body:
          total > 0
            ? `Возвращено ${total} записей из бэкапа${d.rebound ? `, ${d.rebound} привязок досье` : ""}.`
            : "Бэкап не содержал утраченных записей — архив цел.",
      });
    } catch {
      setRestoreError("Сеть архива недоступна — попробуйте ещё раз");
      sfx.error();
    } finally {
      setRestoring(false);
    }
  };

  const save = async () => {
    if (!user || !editor) return;
    const d = editor.draft;
    if (!d.name.trim()) {
      setSaveError(
        editor.kind === "riddle"
          ? "Имя записи-врат не может быть пустым (напр. «Мартин»)"
          : "Имя записи не может быть пустым",
      );
      sfx.error();
      return;
    }
    if (editor.kind === "achievement" && !d.code.trim()) {
      setSaveError("Код достижения обязателен (латиница, цифры и _) — напр. FIRST_SHARD");
      sfx.error();
      return;
    }
    if (editor.kind === "riddle" && !d.answers.trim()) {
      setSaveError("Укажите хотя бы один верный ответ (через запятую)");
      sfx.error();
      return;
    }
    if (d.description.trim().length < 3) {
      setSaveError(
        editor.kind === "riddle"
          ? "Текст загадки слишком короткий (минимум 3 символа)"
          : "Описание слишком короткое (минимум 3 символа)",
      );
      sfx.error();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester: user.login,
          action: editor.mode === "create" ? "create" : "update",
          kind: editor.kind,
          id: editor.id ?? undefined,
          data: buildPayload(editor.kind, d, tabSystem),
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) {
        const hints: Record<string, string> = {
          FORBIDDEN: "Только Созидатель может творить здесь",
          NOT_FOUND: "Запись не найдена — возможно, уже удалена",
          BAD_NAME: "Имя отклонено (1..120 символов)",
          BAD_TITLE: "Название отклонено (1..120 символов)",
          BAD_DESCRIPTION: "Описание отклонено (1..6000 символов)",
          BAD_RIDDLE: "Текст загадки отклонён (1..2000 символов)",
          BAD_RECORDNAME: "Имя записи-врат отклонено (1..120 символов)",
          BAD_ANSWERS: "Укажите хотя бы один верный ответ (через запятую)",
          BAD_CODE: "Код: латиница, цифры и _ (напр. FIRST_SHARD)",
          BAD_ACH_CODE: "Код награды: латиница, цифры и _ (напр. RIDDLE_MASTER)",
          CODE_EXISTS: "Достижение с таким кодом уже существует",
          BAD_THEME_COLOR: "Недопустимый цвет досье",
          BAD_FOLDER: "Недопустимая папка лора",
          BAD_FACTION: "Фракция не найдена",
          FACTION_SYSTEM_MISMATCH: "Фракция принадлежит другому миру",
          EMPTY_DATA: "Нет полей для сохранения",
        };
        setSaveError(hints[resData.error as string] ?? `Архив отказал: ${resData.error}`);
        sfx.error();
        return;
      }
      const rec = resData.record as Record<string, unknown>;
      const recName = String(rec.name ?? rec.title ?? "запись");
      // сохранено — черновик больше не нужен
      try {
        if (editor) localStorage.removeItem(draftKey(editor, tabSystem));
      } catch {
        /* ignore */
      }
      setEditor(null);
      setInitialDraft(null);
      await load();
      bumpDataRevision();
      sfx.unlock();
      pushToast({
        kind: "ach",
        sigil: editor.mode === "create" ? "✦" : "✎",
        title: editor.mode === "create" ? "ЗАПИСЬ СОЗДАНА" : "ЗАПИСЬ ОБНОВЛЕНА",
        body: `${recName}. Правки увидят все стражи архива.`,
      });
    } catch {
      setSaveError("Сеть архива недоступна — попробуйте ещё раз");
      sfx.error();
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (id: string, name: string) => {
    if (!user) return;
    setConfirmDelete(null);
    try {
      const res = await fetch("/api/admin/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester: user.login,
          action: "delete",
          kind: activeTab.kind,
          id,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) {
        pushToast({
          kind: "warn",
          sigil: "⚠",
          title: "АРХИВ ОТКАЗАЛ",
          body: `Не удалось удалить «${name}»: ${resData.error ?? res.status}`,
        });
        sfx.error();
        return;
      }
      if (editor?.id === id) {
        try {
          localStorage.removeItem(draftKey(editor, tabSystem));
        } catch {
          /* ignore */
        }
        setEditor(null);
        setInitialDraft(null);
      }
      await load();
      bumpDataRevision();
      sfx.thud();
      pushToast({
        kind: "warn",
        sigil: "🕯",
        title: "ЗАПИСЬ ПРЕДАНА ОГНЮ",
        body: `«${name}» развеяна из архива навсегда.`,
      });
    } catch {
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "СЕТЬ НЕДОСТУПНА",
        body: "Не удалось удалить запись — попробуйте ещё раз.",
      });
    }
  };

  const sysColor = SYSTEM_COLOR[tabSystem];

  return (
    <section className="flex flex-col gap-3 h-full">
      {/* breadcrumb */}
      <div className="panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; МАСТЕРСКАЯ &gt;
        </span>
        <span className="text-[11px] glow-amber tracking-widest">
          ПЕРО_СОЗИДАТЕЛЯ
        </span>
        <span className="flex-1" />
        {/* переключатель мира */}
        <div className="flex gap-1">
          {(["DND", "PF2E"] as GameSystem[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setTabSystem(s);
                setEditor(null);
                sfx.select();
              }}
              className={`chip text-[10px] cursor-pointer transition-all ${
                tabSystem === s ? "" : "opacity-50 hover:opacity-100"
              }`}
              style={
                tabSystem === s
                  ? {
                      color: SYSTEM_COLOR[s],
                      borderColor: `color-mix(in srgb, ${SYSTEM_COLOR[s]} 50%, transparent)`,
                      background: `color-mix(in srgb, ${SYSTEM_COLOR[s]} 12%, var(--panel-2))`,
                    }
                  : undefined
              }
              aria-pressed={tabSystem === s}
            >
              {s === "DND" ? "ЭЛАРИЯ" : "ГОЛАРИОН"}
            </button>
          ))}
        </div>
      </div>

      {/* title */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-amber tracking-wider title-sweep">
          Мастерская Созидателя
        </h2>
        <span className="text-[10px] text-dim">
          {"// творите записи архива без посредников. правки видны всем //"}
        </span>
        <span className="chip chip-ok text-[10px]">
          ЗАПИСЕЙ: {views.length}
        </span>
      </div>

      {/* tabs */}
      <div className="flex gap-1 flex-wrap panel clip-hud-sm p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setSearch("");
              sfx.select();
            }}
            onMouseEnter={() => sfx.hover()}
            data-active={tab === t.key}
            className={`btn-crt clip-hud-sm px-2.5 py-1.5 text-[11px] flex items-center gap-1.5 ${
              tab === t.key ? "btn-amber" : "opacity-70 hover:opacity-100"
            }`}
            title={t.blurb}
          >
            <span className="text-sm leading-none">{t.sigil}</span>
            <span className="tracking-wider">{t.label}</span>
            {data && (
              <span className="text-[9px] text-dim">
                {rowsForTab(data, t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={openCreate}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs"
        >
          + СОЗДАТЬ ЗАПИСЬ
        </button>
        <button
          onClick={() => void doBackup()}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-3 py-2 text-[10px]"
          title="Скачать полный бэкап архива в JSON (страховка от случайной потери)"
        >
          ⇩ БЭКАП
        </button>
        <input
          ref={restoreFileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doRestoreFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => restoreFileRef.current?.click()}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-3 py-2 text-[10px]"
          title="Восстановить утраченные записи из файла бэкапа (ничего не удаляет и не перезаписывает)"
        >
          ⇧ ВОССТАНОВИТЬ
        </button>
        {/* v5.7.1 — seed.zip: весь проект одним файлом. «⇩» скачивает готовый
            архив (исходники + база + доки — для развёртывания вручную);
            если файл потерялся (фантом песочницы) — «⟳» пересобирает его */}
        <button
          onClick={() =>
            seedState === "ready" ? void downloadSeedZip() : void buildSeedZip()
          }
          disabled={seedBusy || seedState === "checking"}
          data-state={
            seedState === "ready" ? "ready" : seedState === "checking" ? "checking" : "missing"
          }
          onMouseEnter={() => sfx.hover()}
          className="btn-crt seed-zip-btn clip-hud-sm px-3 py-2 text-[10px]"
          title={
            seedState === "ready"
              ? `Скачать seed.zip — полный архив проекта${seedSize ? ` (${(seedSize / 1024).toFixed(0)} КБ)` : ""}: исходники, база, доки, worklog. Для развёртывания вручную`
              : "seed.zip потерялся (фантом песочницы) — пересобрать архив проекта прямо из браузера"
          }
        >
          {seedBusy
            ? "⟳ СОБИРАЮ…"
            : seedState === "ready"
              ? `⇩ АРХИВ${seedSize ? ` · ${(seedSize / 1024).toFixed(0)} КБ` : ""}`
              : seedState === "checking"
                ? "⇩ АРХИВ…"
                : "⟳ СОБРАТЬ АРХИВ"}
        </button>
        {seedBusy && (
          <span className="seed-zip-busy-glyph text-[11px] glow-amber" aria-hidden>
            ⟳
          </span>
        )}
        {restoreError && (
          <span
            className="text-[10px] leading-relaxed max-w-[280px] truncate"
            style={{ color: "var(--red)" }}
            title={restoreError}
          >
            ⚠ {restoreError}
          </span>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="поиск по имени…"
          className="bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)] w-44"
          style={{ clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
          aria-label="Поиск записей"
        />
        <div className="flex gap-1 flex-wrap">
          {FLAG_FILTERS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setFlagFilter(k);
                sfx.hover();
              }}
              className={`chip text-[9px] cursor-pointer transition-all ${
                flagFilter === k ? "chip-ok" : "opacity-50 hover:opacity-100"
              }`}
              aria-pressed={flagFilter === k}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-dim tracking-wider flex-1 min-w-0 truncate">
          {activeTab.blurb}
          {SORTABLE_TABS.has(tab) && !loading && !error && views.length > 1 && (
            <>
              {" · "}
              {canDrag ? (
                <span className="glow-amber">⠿ тяните за ручку — задать порядок</span>
              ) : (
                <span>⠿ порядок — очистите поиск и фильтр</span>
              )}
            </>
          )}
        </span>
      </div>

      {/* editor */}
      {editor && (
        <RecordEditor
          editor={editor}
          draft={editor.draft}
          setDraft={(patch) =>
            setEditor((e) =>
              e ? { ...e, draft: { ...e.draft, ...patch } } : e,
            )
          }
          tabSystem={tabSystem}
          factions={
            data?.factions.map((f) => ({ id: f.id, name: f.name })) ?? []
          }
          media={media}
          requester={user?.login ?? ""}
          achievementCodes={data?.achievements.map((a) => a.code) ?? []}
          saving={saving}
          saveError={saveError}
          dirty={dirty}
          onSave={save}
          onCancel={closeEditor}
          onReset={resetDraft}
        />
      )}

      {/* сводка архива */}
      {data && stats && !editor && (
        <details className="panel clip-hud-sm p-3">
          <summary className="cursor-pointer tracking-widest text-[10px] glow-amber">
            {"// СВОДКА АРХИВА · ЗДОРОВЬЕ И АУДИТ //"}
          </summary>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {([
              ["ЗАПИСЕЙ ВСЕГО", stats.total, ""],
              ["✎ РУКОТВОРНЫХ", stats.user, stats.user > 0 ? "chip-ok" : ""],
              ["◆ ЦВЕТНЫХ ДОСЬЕ", stats.themed, ""],
              ["⚠ ПОРЧА", stats.corrupt, stats.corrupt > 0 ? "chip-err" : ""],
              ["🔒 ПЕЧАТЕЙ", stats.locked, stats.locked > 0 ? "chip-warn" : ""],
              ["🏆→🎯 НАГРАД", stats.rewardedRiddles, "chip-violet"],
            ] as [string, number, string][]).map(([label, value, cls]) => (
              <div
                key={label}
                className="panel-inset px-2.5 py-2 flex flex-col gap-0.5 transition-all hover:border-[var(--amber-dim)] hover:-translate-y-[1px]"
              >
                <span className="text-[9px] text-dim tracking-wider">{label}</span>
                <span className={`font-vt323 text-lg leading-none ${
                  cls === "chip-ok" ? "glow-green" : cls === "chip-err" ? "glow-red" : cls === "chip-warn" ? "glow-amber" : cls === "chip-violet" ? "glow-violet" : "glow-amber"
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          {/* мини-индикаторы здоровья архива */}
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              ["РУКОТВОРНАЯ ДОЛЯ", stats.user, stats.total, "var(--green)"],
              ["ОХВАТ КАРТИНКАМИ", stats.images, stats.total, "var(--amber)"],
              ["ОСКОЛКИ/ПЕЧАТИ — АТМОСФЕРА", stats.corrupt + stats.locked, stats.total, "var(--violet)"],
            ] as [string, number, number, string][]).map(([label, val, total, color]) => {
              const pct = total > 0 ? Math.min(100, Math.round((val / total) * 100)) : 0;
              return (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[9px] text-dim tracking-wider">
                    <span>{label}</span>
                    <span style={{ color }}>{pct}%</span>
                  </div>
                  <div
                    className="h-[4px] panel-inset overflow-hidden"
                    style={{ padding: 0 }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}44, ${color})`,
                        boxShadow: `0 0 8px ${color}66`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <span className="text-[10px] text-dim tracking-widest">
              {"// АУДИТ ДЛИНЫ ТЕКСТОВ — САМЫЕ ДЛИННЫЕ (клик — править) //"}
            </span>
            <div className="mt-1 flex flex-col gap-1">
              {lenAudit.map((it) => (
                <button
                  key={`${it.kind}-${it.id}`}
                  onClick={() => jumpToRecord(it.kind, it.rec)}
                  onMouseEnter={() => sfx.hover()}
                  className="panel-inset px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-all hover:border-[var(--amber-dim)] text-left"
                >
                  <span className="text-[11px] glow-green truncate">{it.name}</span>
                  <span
                    className={`text-[10px] shrink-0 ${
                      it.len > 1500 ? "glow-red" : it.len > 1200 ? "glow-amber" : "text-dim"
                    }`}
                    title={
                      it.len > 1500
                        ? "Слишком длинно — архив рекомендует до 1500 символов"
                        : it.len > 1200
                          ? "Длинновато — подумайте о сокращении"
                          : "Норма"
                    }
                  >
                    {it.len} симв.
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* v5.7 — ирис в цифрах: как стражи скармливают досье ирису.
              Агрегация по ВСЕМ стражам и обоим мирам: сколько открытий,
              сколько слов растворено, у кого какая стадия. */}
          {irisStats && irisStats.totals.records > 0 && (
            <div className="mt-3">
              <span className="text-[10px] text-dim tracking-widest">
                {"// ꙮ ИРИС В ЦИФРАХ · ПОГЛОЩЕНИЕ ПО ВСЕМ СТРАЖАМ //"}
              </span>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  ["ИРИС-ДОСЬЕ", irisStats.totals.records, ""],
                  ["СТРАЖЕЙ КАСАЛОСЬ", irisStats.totals.players, ""],
                  ["ОТКРЫТИЙ ВСЕГО", irisStats.totals.opens, ""],
                  ["СЛОВ СЪЕДЕНО", irisStats.totals.eaten, "iris"],
                ] as [string, number, string][]).map(([label, value, tone]) => (
                  <div
                    key={label}
                    className="panel-inset px-2.5 py-2 flex flex-col gap-0.5 transition-all hover:border-[var(--violet-dim)] hover:-translate-y-[1px]"
                  >
                    <span className="text-[9px] text-dim tracking-wider">{label}</span>
                    <span
                      className={`font-vt323 text-lg leading-none ${
                        tone === "iris" ? "iris-stat-num" : "glow-violet"
                      }`}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              {irisStats.rows.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {irisStats.rows.map((r) => (
                    <div
                      key={r.id}
                      className="panel-inset px-2.5 py-1.5 flex items-center gap-2"
                      title={`Чистых слов в досье: ${r.cleanWords}. Съедено суммарно всеми стражами: ~${r.eaten}. Максимальная стадия самого преданного читателя: ${r.stage}/6.`}
                    >
                      <span className="text-[11px] glow-violet truncate flex-1">
                        {r.name}
                      </span>
                      <span className="text-[9px] text-dim shrink-0">
                        {r.kind === "lore" ? "лор" : r.kind === "location" ? "локация" : "досье"} ·{" "}
                        {r.system === "PF2E" ? "PF2E" : "D&D"}
                      </span>
                      <span className="text-[10px] text-dim shrink-0">
                        {r.opens}✕ · {r.readers}👤
                      </span>
                      {/* мини-бар максимальной стадии: сколько съел самый преданный читатель */}
                      <span className="w-[52px] h-[5px] bg-black/50 border border-[rgba(120,100,160,0.25)] overflow-hidden shrink-0 flex gap-[2px] p-[1px]">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <span
                            key={i}
                            className={`flex-1 ${i <= r.stage ? "iris-stage-cell on" : "iris-stage-cell"}`}
                          />
                        ))}
                      </span>
                      <span className="text-[10px] shrink-0 iris-stat-num">
                        ~{r.eaten} сл.
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {irisStats.totals.opens === 0 && (
                <div className="mt-1 text-[10px] text-dim italic">
                  {"// ирис ждёт: стражи ещё не возвращались к ирис-досье //"}
                </div>
              )}
            </div>
          )}
        </details>
      )}

      {/* модалка восстановления из бэкапа */}
      {restorePreview && (
        <div className="panel clip-hud p-4 fade-in" style={{ borderColor: "var(--violet-dim)" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-vt323 text-lg glow-violet tracking-wider">
              ⇧ ВОССТАНОВЛЕНИЕ ИЗ БЭКАПА
            </span>
            <button
              onClick={() => setRestorePreview(null)}
              disabled={restoring}
              className="btn-crt clip-hud-sm px-2 py-0.5 text-[10px]"
              aria-label="Закрыть восстановление"
            >
              ✕
            </button>
          </div>
          <div className="text-[10px] text-dim mb-3 leading-relaxed">
            {restorePreview.exportedAt
              ? `// бэкап от ${new Date(restorePreview.exportedAt).toLocaleString("ru-RU")} //`
              : "// бэкап архива //"}{" "}
            — вернутся только УТРАЧЕННЫЕ записи; существующие не тронутся.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {Object.entries(RESTORE_TABLE_LABELS).map(([key, label]) => {
              const r = restorePreview.report[key] ?? { restored: 0, skipped: 0 };
              return (
                <div key={key} className="panel-inset px-2.5 py-2">
                  <div className="text-[9px] text-dim tracking-wider">{label}</div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`font-vt323 text-lg leading-none ${
                        r.restored > 0 ? "glow-violet" : "text-dim"
                      }`}
                    >
                      +{r.restored}
                    </span>
                    <span className="text-[9px] text-dim">вернётся</span>
                    {r.skipped > 0 && (
                      <span className="text-[9px] text-dim">· {r.skipped} есть</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {restorePreview.usersToRebind > 0 && (
            <div className="text-[10px] glow-amber mb-3">
              👤 Возврат привязок досье стражам: {restorePreview.usersToRebind}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => void doRestoreApply()}
              disabled={restoring}
              className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs disabled:opacity-50"
            >
              {restoring ? "▸ ИЗ ПЕПЛА…" : "⇧ ВОССТАНОВИТЬ"}
            </button>
            <button
              onClick={() => setRestorePreview(null)}
              disabled={restoring}
              className="btn-crt clip-hud-sm px-4 py-2 text-xs"
            >
              ✕ ОТМЕНА
            </button>
          </div>
        </div>
      )}

      {/* loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="panel clip-hud p-3 h-14 animate-pulse"
              style={{ background: "var(--panel-2)" }}
            />
          ))}
        </div>
      )}

      {/* error */}
      {error && !loading && (
        <div className="panel clip-hud p-6 text-center">
          <div className="font-vt323 text-xl glow-red mb-2">
            [ МАСТЕРСКАЯ ЗАПЕРТА ]
          </div>
          <div className="text-dim text-sm">
            {"// не удалось получить данные: "}{error}{" //"}
          </div>
        </div>
      )}

      {/* rows — длинные списки в скролл-области с фирменным скроллбаром.
          ⠿ — перетаскивание порядка: только на чистом списке (без поиска/фильтра) */}
      {!loading && !error && !restorePreview && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={(e) => void handleDragEnd(e)}
          onDragCancel={() => setDragId(null)}
        >
          <SortableContext
            items={views.map((v) => v.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2 content-start pb-2 max-h-[62vh] overflow-y-auto crt-scroll pr-1">
              {views.length === 0 ? (
                <div className="panel clip-hud p-6 text-center">
                  <div className="font-vt323 text-lg glow-amber mb-1">
                    [ СТРАНИЦА ПУСТА ]
                  </div>
                  <div className="text-dim text-xs">
                    {"// записей нет. созидатель может создать первую кнопкой выше. //"}
                  </div>
                </div>
              ) : (
                views.map((v, i) => (
                  <RecordRow
                    key={v.id}
                    v={v}
                    i={i}
                    sysColor={sysColor}
                    sortable={SORTABLE_TABS.has(tab)}
                    canDrag={canDrag}
                    isConfirm={confirmDelete === v.id}
                    onClone={() => openClone(v.id)}
                    onEdit={() => openEdit(v.id)}
                    onDelete={() => {
                      if (confirmDelete === v.id) {
                        void doDelete(v.id, v.name);
                      } else {
                        setConfirmDelete(v.id);
                        sfx.error();
                      }
                    }}
                  />
                ))
              )}
            </div>
          </SortableContext>
          <DragOverlay
            dropAnimation={{
              duration: 180,
              easing: "cubic-bezier(0.2, 0, 0, 1)",
            }}
          >
            {dragView ? (
              <div
                className="panel clip-hud-sm p-2.5 flex items-center gap-3 select-none"
                style={{
                  borderColor: "var(--amber)",
                  background: "var(--panel-2)",
                  boxShadow:
                    "0 14px 36px rgba(0,0,0,0.55), 0 0 26px rgba(232,161,58,0.28)",
                  transform: "rotate(1.2deg) scale(1.02)",
                  maxWidth: 560,
                }}
              >
                <span
                  className="text-lg shrink-0 w-8 h-8 flex items-center justify-center panel-inset"
                  style={{ color: sysColor }}
                  aria-hidden
                >
                  {dragView.sigil}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] glow-amber truncate">{dragView.name}</div>
                  <div className="text-[9px] text-dim tracking-widest">
                    ⠿ НОВЫЙ ПОРЯДОК В АРХИВЕ
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* подсказка механик */}
      {!editor && (
        <details className="panel clip-hud-sm p-3 text-[11px] text-dim">
          <summary className="cursor-pointer tracking-widest text-[10px] glow-amber">
            {"// ПОДСКАЗКА МЕХАНИК АРХИВА //"}
          </summary>
          <ul className="mt-2 space-y-1 leading-relaxed">
            <li>
              <span className="glow-green">🔒 Печать</span> — запись закрыта
              ритуалом снятия печати (долгое нажатие в досье).
            </li>
            <li>
              <span className="glow-red">⚠ Порча</span> — текст записи искажается
              корруптами; в досье он проявляется рунами и глитчем.
            </li>
            <li>
              <span className="glow-red">⟦ Порча по выделению ⟧</span> — в описании
              выделите фрагмент и нажмите «ПОМЕТИТЬ ПОРЧЕЙ»: нечитаемым станет
              именно он. Внизу — живой предпросмотр.
            </li>
            <li>
              <span className="glow-violet">⟪ Полное искажение ⟫</span> — фрагмент
              растворяется безвозвратно: вместо слов — переливающиеся ирисом
              глифы (бирюза→аметист→роза→золото). Без свечения и без призраков
              смысла — «ПОЛНОЕ ИСКАЖЕНИЕ» в редакторе описания.
            </li>
            <li>
              <span className="glow-amber">◆ Цвет досье</span> — особое оформление
              досье, как фиолетовое у Кали: синее, зелёное, янтарное и другие.
            </li>
            <li>
              <span className="glow-violet">🧩 Осколок памяти</span> — слово
              осколка; соберите все осколки мира, чтобы открыть вкладку «Секреты».
            </li>
            <li>
              <span className="glow-violet">⟁ Сокрытое</span> — скрытый фрагмент
              текста, раскрываемый кнопкой в досье.
            </li>
            <li>
              <span className="glow-violet">🎯 Загадки-врата</span> — привязываются
              к имени записи: досье откроется только после верного ответа.
              Ответы сверяются на сервере — игроки не смогут подсмотреть их
              в коде страницы.
            </li>
            <li>
              <span className="glow-violet">🏆 Награда за загадку</span> — укажите
              код достижения в форме загадки: каждый, кто разгадает её,
              получит эту ачивку автоматически.
            </li>
            <li>
              <span className="glow-amber">⇪ Загрузка с диска</span> — кнопка
              «С ДИСКА» у пути изображения кладёт файл в public/uploads.
              На Vercel диск только для чтения — там используйте ссылку или
              файл в репозитории.
            </li>
            <li>
              <span className="glow-amber">⇩ Бэкап</span> — полный слепок архива
              в JSON. merge-seed защищает от пересева, бэкап спасёт даже от
              случайного удаления.
            </li>
            <li>
              <span className="glow-amber">⇩ Архив проекта</span> — весь проект
              одним файлом seed.zip (исходники + база + доки): для развёртывания
              вручную и страховки. Ссылка на скачивание подписана и живёт 15
              минут; если архив потерялся — кнопка «⟳» пересоберёт его прямо
              из браузера.
            </li>
            <li>
              <span className="glow-amber">⧉ Дублирование</span> — копия записи
              как черновик (у ачивки код получает суффикс _COPY).
            </li>
            <li>
              <span className="glow-amber">🏆 Достижения</span> — попадают в
              реестр профиля; код — латиница (напр. FIRST_SHARD).
            </li>
            <li>
              <span className="glow-amber">Папки лора</span> — запись попадает в
              раздел по папке: общий лор, Пантеон, Второстепенные герои, Секреты.
            </li>
            <li>
              <span className="glow-amber">Путь к изображению</span> — например
              «/heroes/kael.png». Файл должен лежать в public/ (или быть
              абсолютной ссылкой https://…).
            </li>
            <li>
              <span className="glow-green">✓ Защита правок</span> — всё, что
              создано или изменено в Мастерской, не сбрасывается при обновлениях
              архива (merge-seed бережёт ваши записи).
            </li>
            <li>
              <span className="glow-amber">⠿ Порядок записей</span> — тяните
              строку за ручку ⠿: запись встанет на новое место, и все стражи
              увидят список в вашем порядке (герои, лор, локации, фракции).
              При поиске/фильтре перетаскивание выключено.
            </li>
            <li>
              <span className="glow-amber">⌫ Черновики</span> — правки в форме
              хранятся в браузере: перезагрузка вкладки или случайное закрытие
              не страшны — при повторном открытии записи черновик вернётся
              (кнопка ⌫ СБРОС откатит к исходнику). Вкладка с несохранённой
              правкой попросит подтверждение перед закрытием.
            </li>
          </ul>
        </details>
      )}
    </section>
  );
}

// ── Строка списка записей (sortable) ────────────────────────────────────────

function RecordRow({
  v,
  i,
  sysColor,
  sortable,
  canDrag,
  isConfirm,
  onClone,
  onEdit,
  onDelete,
}: {
  v: RowView;
  i: number;
  sysColor: string;
  /** вкладка поддерживает порядок (герои/лор/локации/фракции) */
  sortable: boolean;
  /** перетаскивание доступно прямо сейчас (без поиска/фильтра) */
  canDrag: boolean;
  isConfirm: boolean;
  onClone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: v.id,
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      className={`panel clip-hud-sm p-2.5 flex items-center gap-3 card-stagger transition-all hover:border-[var(--amber-dim)] ${
        isDragging ? "opacity-30 border-dashed" : ""
      }`}
      style={
        {
          "--card-i": Math.min(i, 14),
          borderColor: isDragging ? "var(--amber-dim)" : undefined,
        } as React.CSSProperties
      }
    >
      {/* ⠿ ручка порядка — перетащите, чтобы менять порядок в архиве */}
      {sortable ? (
        canDrag ? (
          <button
            {...attributes}
            {...listeners}
            className={`text-[13px] leading-none w-5 shrink-0 flex items-center justify-center text-dim hover:text-[var(--amber)] cursor-grab active:cursor-grabbing transition-all focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--amber)] ${
              isDragging ? "drag-handle-active" : ""
            }`}
            style={{ touchAction: "none" }}
            aria-label={`Изменить порядок: ${v.name}`}
            title="Перетащите — запись встанет на новое место в архиве у всех стражей"
          >
            ⠿
          </button>
        ) : (
          <span
            className="text-[13px] leading-none w-5 shrink-0 flex items-center justify-center text-dim opacity-30"
            title="Перетаскивание доступно на полном списке — очистите поиск и фильтры"
            aria-hidden
          >
            ⠿
          </span>
        )
      ) : null}
      <span
        className="text-lg shrink-0 w-8 h-8 flex items-center justify-center panel-inset"
        style={{ color: sysColor }}
        aria-hidden
      >
        {v.sigil}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] glow-green truncate max-w-[240px] sm:max-w-xs">
            {v.name}
          </span>
          {v.chips.map((c, ci) => (
            <span
              key={ci}
              className={`chip text-[9px] ${c.cls ?? ""}`}
              title={c.title}
            >
              {c.text}
            </span>
          ))}
        </div>
        {v.subtitle && (
          <div className="text-[10px] text-dim tracking-wider truncate">
            {v.subtitle}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onClone}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px]"
          style={{
            borderColor: "var(--violet-dim)",
            color: "var(--violet)",
            background: "rgba(167, 139, 250, 0.08)",
          }}
          aria-label={`Дублировать ${v.name}`}
          title="Дублировать запись (черновик-копия)"
        >
          ⧉
        </button>
        <button
          onClick={onEdit}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px]"
          style={{
            borderColor: "var(--amber-dim)",
            color: "var(--amber)",
            background: "rgba(232, 161, 58, 0.08)",
          }}
          aria-label={`Редактировать ${v.name}`}
        >
          ✎
        </button>
        <button
          onClick={onDelete}
          onMouseEnter={() => sfx.hover()}
          className={`btn-crt clip-hud-sm px-2.5 py-1 text-[10px] ${
            isConfirm ? "btn-red glow-red" : ""
          }`}
          aria-label={`Удалить ${v.name}`}
        >
          {isConfirm ? "СЖЕЧЬ?" : "✕"}
        </button>
      </div>
    </div>
  );
}

// ── Форма редактирования ────────────────────────────────────────────────────

interface RecordEditorProps {
  editor: {
    mode: "create" | "edit";
    kind: RecKind;
    id: string | null;
    name: string;
    draft: Draft;
  };
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  tabSystem: GameSystem;
  factions: { id: string; name: string }[];
  media: string[];
  /** логин администратора — для загрузки файлов */
  requester: string;
  /** коды существующих достижений — подсказка в поле награды загадки */
  achievementCodes: string[];
  saving: boolean;
  saveError: string | null;
  /** черновик отличается от исходника — показать «ИЗМЕНЕНО» и ⌫ */
  dirty: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** вернуть значения до правок */
  onReset: () => void;
}

const KIND_LABEL: Record<RecKind, string> = {
  character: "досье",
  lore: "лор",
  location: "локация",
  faction: "фракция",
  riddle: "загадка-врата",
  achievement: "достижение",
};

function RecordEditor({
  editor,
  draft,
  setDraft,
  tabSystem,
  factions,
  media,
  requester,
  achievementCodes,
  saving,
  saveError,
  dirty,
  onSave,
  onCancel,
  onReset,
}: RecordEditorProps) {
  const kind = editor.kind;
  const isCharacter = kind === "character";
  const isLore = kind === "lore";
  const isLocation = kind === "location";
  const isFaction = kind === "faction";
  const isRiddle = kind === "riddle";
  const isAchievement = kind === "achievement";
  const hasDossierTheme = isCharacter || isLore || isLocation;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  // загрузка файла с диска → public/uploads
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // textarea описания — нужна тулбару порчи для работы с выделением
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  // Ctrl+Enter — сохранить (в любом поле формы)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  const doUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("requester", requester);
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !d.ok || !d.url) {
        const hints: Record<string, string> = {
          TOO_BIG: "Файл больше 4 МБ — сожмите изображение",
          BAD_TYPE: "Поддерживаются PNG, JPEG, WebP и GIF",
          READONLY_FS:
            "Диск хостинга недоступен для записи — используйте ссылку https://… или положите файл в public/ репозитория",
          FORBIDDEN: "Только Созидатель может загружать файлы",
          FS_ERROR: "Не удалось записать файл — проверьте права на public/uploads",
        };
        setUploadError(hints[d.error ?? ""] ?? `Загрузка не удалась: ${d.error ?? res.status}`);
        return;
      }
      setDraft({ imageUrl: d.url });
    } catch {
      setUploadError("Сеть архива недоступна — попробуйте ещё раз");
    } finally {
      setUploading(false);
    }
  };

  // сброс флага загрузки картинки при смене пути — паттерн
  // «adjust-state-during-render» (без эффекта, без лишнего рендера)
  const [prevImage, setPrevImage] = useState(draft.imageUrl);
  if (prevImage !== draft.imageUrl) {
    setPrevImage(draft.imageUrl);
    setImgOk(true);
  }

  const nameLabel = isCharacter
    ? "ИМЯ ГЕРОЯ"
    : isLocation
      ? "НАЗВАНИЕ МЕСТА"
      : isFaction
        ? "НАЗВАНИЕ ФРАКЦИИ"
        : isRiddle
          ? "ИМЯ ЗАПИСИ-ВРАТ"
          : isAchievement
            ? "НАЗВАНИЕ ДОСТИЖЕНИЯ"
            : "НАЗВАНИЕ ЗАПИСИ";

  const namePlaceholder = isCharacter
    ? "напр. Каэль"
    : isRiddle
      ? "имя записи, к которой привязана загадка (напр. Мартин)"
      : isAchievement
        ? "напр. Первая печать"
        : "напр. Хроники Пепла";

  const descLabel = isRiddle
    ? "Текст загадки"
    : isAchievement
      ? "Описание достижения"
      : "Описание";
  const descMax = isRiddle ? 2000 : 6000;
  // мягкая рекомендация архива: досье длиннее 1500 символов читаются тяжело
  const descSoftMax = 1500;

  const showStatus = isCharacter || isLore;
  const showFriendship = isLore && draft.folder === "SECONDARY_HEROES";
  const showOrder = isCharacter || isLore || isLocation || isFaction;

  return (
    <div
      className="panel clip-hud brackets p-3 sm:p-4 space-y-3 fade-in"
      style={{
        borderColor: "var(--amber-dim)",
        boxShadow: "0 0 30px rgba(232,161,58,0.12)",
      }}
    >
      {/* header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip chip-warn text-[10px]">
          {editor.mode === "create" ? "✦ ТВОРЕНИЕ" : "✎ ПРАВКА"}
        </span>
        <span className="text-[10px] text-dim tracking-wider">
          {editor.mode === "create"
            ? `// новая запись · ${KIND_LABEL[kind]} · ${SYSTEM_LABEL[tabSystem]} //`
            : `// ${editor.name} · ${KIND_LABEL[kind]} · ${SYSTEM_LABEL[tabSystem]} //`}
        </span>
        <span className="flex-1" />
        <button
          onClick={onCancel}
          disabled={saving}
          className="btn-crt clip-hud-sm px-2 py-0.5 text-[11px]"
          aria-label="Закрыть форму"
        >
          ✕
        </button>
      </div>

      {/* main fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={nameLabel}>
          <TextInput
            value={draft.name}
            onChange={(v) => setDraft({ name: v })}
            maxLength={120}
            placeholder={namePlaceholder}
          />
        </Field>

        {isAchievement && (
          <Field label="КОД (ЛАТИНИЦА + _)">
            <TextInput
              value={draft.code}
              onChange={(v) =>
                setDraft({ code: v.replace(/[^A-Za-z0-9_]/g, "").toUpperCase() })
              }
              maxLength={60}
              placeholder="напр. FIRST_SHARD"
            />
          </Field>
        )}

        {isRiddle && (
          <>
            <Field label="ЗАГОЛОВОК ВРАТ">
              <TextInput
                value={draft.title}
                onChange={(v) => setDraft({ title: v })}
                maxLength={120}
                placeholder="напр. МАРТИН (как в вратах)"
              />
            </Field>
            <Field label="ПОДЗАГОЛОВОК">
              <TextInput
                value={draft.subtitle}
                onChange={(v) => setDraft({ subtitle: v })}
                maxLength={120}
                placeholder="напр. // теневой покровитель //"
              />
            </Field>
          </>
        )}

        {(isRiddle || isAchievement) && (
          <Field label="МИР">
            <select
              value={draft.scopeSystem}
              onChange={(e) => setDraft({ scopeSystem: e.target.value })}
              className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)]"
            >
              <option value="">☾ Любой мир</option>
              <option value="DND">Элария (D&D)</option>
              <option value="PF2E">Голарион (PF2e)</option>
            </select>
          </Field>
        )}

        {isCharacter && (
          <>
            <Field label="ЭПИТЕТ (TITLE)">
              <TextInput
                value={draft.title}
                onChange={(v) => setDraft({ title: v })}
                maxLength={120}
                placeholder="напр. Странник Пепла"
              />
            </Field>
            <Field label="КЛАСС / РОЛЬ">
              <TextInput
                value={draft.category}
                onChange={(v) => setDraft({ category: v })}
                maxLength={120}
                placeholder="напр. Паладин"
              />
            </Field>
            <Field label="РАСА">
              <TextInput
                value={draft.race}
                onChange={(v) => setDraft({ race: v })}
                maxLength={120}
                placeholder="напр. Полуэльф"
              />
            </Field>
            <Field label="ТИП ЗАПИСИ">
              <div className="flex gap-1.5 flex-wrap">
                {(
                  [
                    ["HERO", "⚔ ГЕРОЙ"],
                    ["NPC", "🎭 NPC ФРАКЦИИ"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ kind: k })}
                    className={`chip text-[10px] cursor-pointer transition-all ${
                      draft.kind === k
                        ? "chip-warn"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    aria-pressed={draft.kind === k}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            {draft.kind === "NPC" && (
              <Field label="ФРАКЦИЯ">
                <select
                  value={draft.factionId}
                  onChange={(e) => setDraft({ factionId: e.target.value })}
                  className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)]"
                >
                  <option value="">— без фракции —</option>
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}

        {isLore && (
          <>
            <Field label="КАТЕГОРИЯ">
              <TextInput
                value={draft.category}
                onChange={(v) => setDraft({ category: v })}
                maxLength={120}
                placeholder="напр. Эпоха, Событие, Божество"
              />
            </Field>
            <Field label="ПАПКА (РАЗДЕЛ АРХИВА)">
              <select
                value={draft.folder}
                onChange={(e) => setDraft({ folder: e.target.value })}
                className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)]"
              >
                <option value="">Общий лор</option>
                <option value="PANTHEON">Божества (Пантеон)</option>
                <option value="SECONDARY_HEROES">Второстепенные герои</option>
                <option value="SECRETS">Секреты (за осколки)</option>
              </select>
            </Field>
          </>
        )}

        {isLocation && (
          <Field label="ТИП МЕСТА">
            <TextInput
              value={draft.category}
              onChange={(v) => setDraft({ category: v })}
              maxLength={120}
              placeholder="напр. Город, Руины, Портал"
            />
          </Field>
        )}

        {isRiddle && (
          <>
            <Field label="ВЕРНЫЕ ОТВЕТЫ (ЧЕРЕЗ ЗАПЯТУЮ)">
              <TextInput
                value={draft.answers}
                onChange={(v) => setDraft({ answers: v })}
                maxLength={600}
                placeholder="напр. тьма, темнота, мрак"
              />
            </Field>
            <Field label="ПОДСКАЗКА ВНИЗУ ВРАТ">
              <TextInput
                value={draft.hint}
                onChange={(v) => setDraft({ hint: v })}
                maxLength={300}
                placeholder="напр. // назови то, что умирает последним //"
              />
            </Field>
            <Field label="🏆 НАГРАДА-ДОСТИЖЕНИЕ ЗА РАЗГАДКУ">
              <div>
                <TextInput
                  value={draft.achievementCode}
                  onChange={(v) =>
                    setDraft({
                      achievementCode: v.replace(/[^A-Za-z0-9_]/g, "").toUpperCase(),
                    })
                  }
                  maxLength={60}
                  placeholder="напр. RIDDLE_MASTER (пусто — без награды)"
                  list="admin-ach-codes"
                />
                <datalist id="admin-ach-codes">
                  {achievementCodes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {draft.achievementCode &&
                  !achievementCodes.includes(draft.achievementCode) && (
                    <div className="text-[9px] mt-1 glow-amber">
                      {"// достижения с таким кодом пока нет — создайте его во вкладке 🏆 ДОСТИЖЕНИЯ, иначе награды не будет //"}
                    </div>
                  )}
                {!draft.achievementCode && (
                  <div className="text-[9px] text-dim mt-1">
                    {"// решивший получит достижение с этим кодом //"}
                  </div>
                )}
              </div>
            </Field>
          </>
        )}

        {/* sigil */}
        <Field label="СИГИЛА (ЭМОДЗИ)">
          <div className="flex items-center gap-1.5 flex-wrap">
            <TextInput
              value={draft.sigil}
              onChange={(v) => setDraft({ sigil: v })}
              maxLength={8}
              className="w-16 text-center text-base"
            />
            {SIGIL_PRESETS.slice(0, 12).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft({ sigil: s })}
                className={`w-7 h-7 flex items-center justify-center panel-inset text-sm cursor-pointer transition-all hover:border-[var(--amber-dim)] ${
                  draft.sigil === s ? "border-[var(--amber-dim)] glow-amber" : ""
                }`}
                aria-label={`Сигила ${s}`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        {/* dossier theme color */}
        {hasDossierTheme && (
          <Field label="ЦВЕТ ДОСЬЕ (КАК ФИОЛЕТОВОЕ У КАЛИ)">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setDraft({ themeColor: "" })}
                className={`chip text-[10px] cursor-pointer transition-all ${
                  !draft.themeColor ? "chip-ok" : "opacity-60 hover:opacity-100"
                }`}
                aria-pressed={!draft.themeColor}
                title="Стандартное оформление архива"
              >
                ✓ СТАНДАРТ
              </button>
              {DOSSIER_THEME_KEYS.map((k) => {
                const t = DOSSIER_THEMES[k];
                const active = draft.themeColor === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ themeColor: k })}
                    className={`w-7 h-7 flex items-center justify-center cursor-pointer transition-all border ${
                      active ? "scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{
                      background: t.btnBg,
                      borderColor: active ? t.accent : t.border,
                      boxShadow: active ? `0 0 10px ${t.accentDim}` : undefined,
                      clipPath:
                        "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)",
                    }}
                    aria-label={`Цвет досье: ${t.label}`}
                    title={t.label}
                  >
                    <span style={{ color: t.accent, textShadow: `0 0 6px ${t.accentDim}` }}>
                      ◆
                    </span>
                  </button>
                );
              })}
              <span className="text-[9px] text-dim ml-1">
                {draft.themeColor
                  ? DOSSIER_THEMES[draft.themeColor]?.label
                  : "стандартное зелёное"}
              </span>
            </div>
          </Field>
        )}

        {/* v5.5 — палитра ириса для полного искажения (⟪…⟫) */}
        {hasDossierTheme && (
          <Field label="ПАЛИТРА ИРИСА (ПОЛНОЕ ИСКАЖЕНИЕ ⟪…⟫)">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setDraft({ irisColor: "" })}
                className={`chip text-[10px] cursor-pointer transition-all ${
                  !draft.irisColor ? "chip-ok" : "opacity-60 hover:opacity-100"
                }`}
                aria-pressed={!draft.irisColor}
                title="Авто: спектр ириса подстраивается под цвет досье (v5.4.1)"
              >
                ✓ АВТО
              </button>
              {IRIS_PALETTE_KEYS.map((k) => {
                const pal = IRIS_PALETTES[k];
                const active = draft.irisColor === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ irisColor: k })}
                    className={`w-9 h-6 flex items-center justify-center cursor-pointer transition-all border ${
                      active ? "scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{
                      background: pal.swatch,
                      borderColor: active
                        ? "rgba(216, 160, 255, 0.9)"
                        : "rgba(216, 160, 255, 0.25)",
                      boxShadow: active
                        ? "0 0 10px rgba(196, 165, 255, 0.45)"
                        : undefined,
                      clipPath:
                        "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)",
                    }}
                    aria-label={`Палитра ириса: ${pal.label}`}
                    title={`${pal.label} — ${pal.hint}`}
                  >
                    <span
                      className="text-[10px] font-bold"
                      style={{
                        color: "#fff",
                        textShadow: "0 0 4px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.6)",
                      }}
                    >
                      ꙮ
                    </span>
                  </button>
                );
              })}
              <span className="text-[9px] text-dim ml-1">
                {draft.irisColor
                  ? IRIS_PALETTES[draft.irisColor]?.label
                  : "авто — под цвет досье"}
              </span>
            </div>
          </Field>
        )}

        {/* image path */}
        {!isRiddle && !isAchievement && (
        <Field label="ПУТЬ К ИЗОБРАЖЕНИЮ">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <input
                value={draft.imageUrl}
                onChange={(e) => setDraft({ imageUrl: e.target.value })}
                list="admin-media-list"
                maxLength={500}
                placeholder="/heroes/example.png или https://…"
                className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)]"
                style={{ clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
              />
              <datalist id="admin-media-list">
                {media.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[9px] text-dim">
                  {"// файл в public/ или ссылка https://… //"}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void doUpload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="btn-crt clip-hud-sm px-2 py-0.5 text-[9px] disabled:opacity-50"
                  title="Загрузить картинку с диска — файл ляжет в public/uploads"
                >
                  {uploading ? "⏳ КАНАЛ…" : "⇪ С ДИСКА"}
                </button>
              </div>
              {uploadError && (
                <div className="text-[9px] mt-1 leading-relaxed" style={{ color: "var(--red)" }}>
                  ⚠ {uploadError}
                </div>
              )}
            </div>
            {draft.imageUrl.trim() && imgOk && (
              <div
                className="shrink-0 w-20 h-20 panel-inset flex items-center justify-center overflow-hidden"
                style={{ borderColor: "var(--amber-dim)" }}
              >
                <img
                  src={draft.imageUrl.trim()}
                  alt="Предпросмотр"
                  className="max-w-full max-h-full object-contain"
                  onError={() => setImgOk(false)}
                />
              </div>
            )}
            {draft.imageUrl.trim() && !imgOk && (
              <div className="shrink-0 w-20 h-20 panel-inset flex items-center justify-center text-[9px] text-dim text-center leading-tight p-1">
                файл не найден
              </div>
            )}
          </div>
        </Field>
        )}

        {/* status */}
        {showStatus && (
          <Field label="СТАТУС">
            <div className="flex gap-1.5 flex-wrap">
              {(
                [
                  ["ALIVE", "✓ ЖИВ"],
                  ["DEAD", "💀 ПАЛ"],
                  ["MISSING", "? ПРОПАЛ"],
                ] as const
              ).map(([s, label]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDraft({ status: s })}
                  className={`chip text-[10px] cursor-pointer transition-all ${
                    draft.status === s ? "chip-warn" : "opacity-60 hover:opacity-100"
                  }`}
                  aria-pressed={draft.status === s}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* friendship */}
        {showFriendship && (
          <Field label="ДРУЖБА (0 = СКРЫТЬ)">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={10}
                value={draft.friendship ? parseInt(draft.friendship, 10) : 0}
                onChange={(e) => setDraft({ friendship: e.target.value === "0" ? "" : e.target.value })}
                className="flex-1 accent-[var(--amber)]"
                aria-label="Шкала дружбы"
              />
              <span className="text-[11px] glow-amber w-8 text-center">
                {draft.friendship ? `${draft.friendship}/10` : "—"}
              </span>
            </div>
          </Field>
        )}

        {/* sortOrder */}
        {showOrder && (
          <Field label="ПОРЯДОК СОРТИРОВКИ">
            <TextInput
              value={draft.sortOrder}
              onChange={(v) => setDraft({ sortOrder: v.replace(/[^\d-]/g, "") })}
              maxLength={5}
              placeholder="0"
            />
            <span className="text-[9px] text-dim mt-1 block">
              {"// меньше — выше; проще тянуть за ⠿ в списке //"}
            </span>
          </Field>
        )}
      </div>

      {/* description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-dim tracking-widest">
            {`// ${descLabel.toUpperCase()} //`}
          </span>
          <span
            className={`text-[9px] ${
              draft.description.length > descMax - 100
                ? "glow-red"
                : !isRiddle && !isAchievement && draft.description.length > descSoftMax
                  ? "glow-amber"
                  : "text-dim"
            }`}
            title={
              !isRiddle && !isAchievement && draft.description.length > descSoftMax
                ? "Архив рекомендует до 1500 символов — длинные досье читаются тяжело"
                : undefined
            }
          >
            {draft.description.length}/{descMax}
            {!isRiddle && !isAchievement && draft.description.length > descSoftMax
              ? " · длинновато"
              : ""}
          </span>
        </div>
        <textarea
          ref={descRef}
          value={draft.description}
          onChange={(e) => setDraft({ description: e.target.value })}
          maxLength={descMax}
          rows={7}
          spellCheck={false}
          className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-2 text-[13px] leading-relaxed text-[var(--text)] transition-colors crt-scroll resize-y min-h-[140px]"
          placeholder={
            isRiddle
              ? "Строки загадки. Пустая строка — новая строка в вратах…"
              : "Текст записи. Пустая строка — новый абзац…"
          }
        />
        {/* порча по выделению: только для текстов записей архива */}
        {!isRiddle && !isAchievement && (
          <div className="mt-2">
            <CorruptToolbar
              textareaRef={descRef}
              value={draft.description}
              onChange={(v) => setDraft({ description: v })}
              accent={
                draft.themeColor
                  ? DOSSIER_THEMES[draft.themeColor]?.accent
                  : undefined
              }
              irisPalette={draft.irisColor || undefined}
            />
          </div>
        )}
      </div>

      {/* mechanics */}
      {!isRiddle && !isAchievement && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="🧩 ОСКОЛОК ПАМЯТИ (СЛОВО)">
          <TextInput
            value={draft.shardWord}
            onChange={(v) => setDraft({ shardWord: v })}
            maxLength={60}
            placeholder="напр. надежда (пусто — нет осколка)"
          />
        </Field>
        <Field label="ФЛАГИ ЗАПИСИ">
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setDraft({ isLocked: !draft.isLocked })}
              className={`chip text-[10px] cursor-pointer transition-all ${
                draft.isLocked ? "chip-warn" : "opacity-60 hover:opacity-100"
              }`}
              aria-pressed={draft.isLocked}
              title="Запись опечатана — игрокам нужен ритуал"
            >
              🔒 {draft.isLocked ? "ПЕЧАТЬ ВКЛ" : "ПЕЧАТЬ ВЫКЛ"}
            </button>
            <button
              type="button"
              onClick={() => setDraft({ isCorrupted: !draft.isCorrupted })}
              className={`chip text-[10px] cursor-pointer transition-all ${
                draft.isCorrupted ? "chip-err" : "opacity-60 hover:opacity-100"
              }`}
              aria-pressed={draft.isCorrupted}
              title="Текст записи искажается корруптами"
            >
              ⚠ {draft.isCorrupted ? "ПОРЧА ВКЛ" : "ПОРЧА ВЫКЛ"}
            </button>
          </div>
        </Field>
      </div>
      )}

      {/* secret fragment */}
      {!isRiddle && (
      <div>
        <span className="text-[10px] text-dim tracking-widest mb-1 block">
          {"// ⟁ СОКРЫТОЕ (СКРЫТЫЙ ФРАГМЕНТ) //"}
        </span>
        <textarea
          value={draft.secretFragment}
          onChange={(e) => setDraft({ secretFragment: e.target.value })}
          maxLength={2000}
          rows={2}
          spellCheck={false}
          className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--violet-dim)] outline-none px-2.5 py-2 text-[12px] leading-relaxed text-[var(--text)] crt-scroll resize-y"
          placeholder="Тайна, которую игроки раскроют кнопкой в досье (пусто — нет тайны)…"
          style={{ borderColor: draft.secretFragment ? "var(--violet-dim)" : undefined }}
        />
      </div>
      )}

      {/* advanced */}
      {!isRiddle && !isAchievement && (
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-dim tracking-widest hover:text-[var(--amber)] transition-colors"
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? "▾" : "▸"} СЛУЖЕБНЫЕ ПОЛЯ (КАРТА)
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 mt-2 fade-in">
            <Field label="MAP_X">
              <TextInput
                value={draft.mapX}
                onChange={(v) => setDraft({ mapX: v.replace(/[^\d-]/g, "") })}
                maxLength={6}
                placeholder="0"
              />
            </Field>
            <Field label="MAP_Y">
              <TextInput
                value={draft.mapY}
                onChange={(v) => setDraft({ mapY: v.replace(/[^\d-]/g, "") })}
                maxLength={6}
                placeholder="0"
              />
            </Field>
          </div>
        )}
      </div>
      )}

      {/* ошибка — над панелью действий */}
      {saveError && (
        <div className="text-[11px] leading-relaxed" style={{ color: "var(--red)" }}>
          ⚠ {saveError}
        </div>
      )}
      {/* sticky-панель действий — всегда под рукой в длинной форме */}
      <div className="sticky bottom-2 z-20 -mx-1.5 px-1.5 py-1">
        <div
          className="panel clip-hud-sm p-2 flex items-center gap-2 flex-wrap"
          style={{
            borderColor: dirty ? "var(--amber-dim)" : "var(--line)",
            background:
              "color-mix(in srgb, var(--panel-1) 88%, transparent)",
            backdropFilter: "blur(6px)",
            boxShadow: dirty
              ? "0 6px 24px rgba(0,0,0,0.45), 0 0 18px rgba(232,161,58,0.10)"
              : "0 6px 24px rgba(0,0,0,0.45)",
          }}
        >
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-default"
          >
            {saving
              ? "▸ ЗАПИСЬ В АРХИВ…"
              : editor.mode === "create"
                ? "💾 ВОПЛОТИТЬ ЗАПИСЬ"
                : "💾 СОХРАНИТЬ ПРАВКИ"}
          </button>
          {dirty && !saving && (
            <span
              className="chip chip-warn dirty-pulse text-[9px]"
              title="Черновик отличается от сохранённой записи — автосохранён в браузере"
            >
              ● ИЗМЕНЕНО
            </span>
          )}
          <button
            onClick={onCancel}
            disabled={saving}
            className="btn-crt clip-hud-sm px-4 py-2 text-xs"
          >
            ✕ ОТМЕНА
          </button>
          {dirty && (
            <button
              onClick={onReset}
              disabled={saving}
              className="btn-crt clip-hud-sm px-3 py-2 text-[10px]"
              title="Вернуть значения, которые были при открытии формы"
            >
              ⌫ СБРОС
            </button>
          )}
          <span className="text-[9px] text-dim tracking-wider">
            {"// правки увидят все стражи · Ctrl+Enter — сохранить · черновик хранится в браузере //"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Мелкие компоненты формы ─────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-[10px] text-dim tracking-widest mb-1 block">
        {`// ${label} //`}
      </span>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  maxLength,
  placeholder,
  className = "",
  list,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  list?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      list={list}
      className={`w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)] transition-colors ${className}`}
      style={{ clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
    />
  );
}
