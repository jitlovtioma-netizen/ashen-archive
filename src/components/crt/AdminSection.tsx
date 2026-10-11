"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { SYSTEM_LABEL, SYSTEM_COLOR, type GameSystem } from "@/lib/types";
import { DOSSIER_THEMES, DOSSIER_THEME_KEYS } from "@/lib/themes";
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
  factionId: string | null;
  imageUrl: string | null;
  status: string;
  isLocked: boolean;
  isCorrupted: boolean;
  shardWord: string | null;
  secretFragment: string | null;
  mapX: number;
  mapY: number;
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
}

interface AdminLocationRow {
  id: string;
  name: string;
  type: string;
  description: string;
  sigil: string;
  system: string;
  isLocked: boolean;
  isCorrupted: boolean;
  shardWord: string | null;
  secretFragment: string | null;
  mapX: number;
  mapY: number;
}

interface AdminFactionRow {
  id: string;
  name: string;
  sigil: string;
  description: string;
  system: string;
  sortOrder: number;
  isCorrupted: boolean;
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
}

interface AdminAchievementRow {
  id: string;
  code: string;
  name: string;
  description: string;
  sigil: string;
  secretFragment: string | null;
  system: string | null;
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
  /** поля загадки-врат */
  subtitle: string;
  answers: string;
  hint: string;
  /** поле достижения */
  code: string;
  /** мир загадки/достижения: "" — любой */
  scopeSystem: string;
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
    subtitle: "",
    answers: "",
    hint: "",
    code: "",
    scopeSystem: "",
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
  } else {
    p.name = d.name.trim();
    p.sortOrder = num(d.sortOrder, 0);
    // у фракций нет цвета досье
    delete p.themeColor;
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

// ── Главный компонент ───────────────────────────────────────────────────────

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
  const [editor, setEditor] = useState<{
    mode: "create" | "edit";
    kind: RecKind;
    id: string | null;
    name: string;
    draft: Draft;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [media, setMedia] = useState<string[]>([]);

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

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

  // список изображений для подсказок в поле «путь к изображению»
  useEffect(() => {
    fetch("/api/admin/media")
      .then((r) => r.json())
      .then((d: { images?: string[] }) => setMedia(d.images ?? []))
      .catch(() => {});
  }, []);

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
      setEditor({
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
  }, [adminEditTarget, data, tabSystem]);

  // сброс подтверждения удаления через 3.5с
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(null), 3500);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const rows = useMemo<AnyRow[]>(() => (data ? rowsForTab(data, tab) : []), [data, tab]);
  const views = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ? rows.map((r) => rowView(data, activeTab.kind, r)) : []).filter((v) => {
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) || v.subtitle.toLowerCase().includes(q)
      );
    });
  }, [data, rows, search, activeTab.kind]);

  const openCreate = () => {
    setEditor({
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
    setEditor({
      mode: "edit",
      kind: activeTab.kind,
      id,
      name: rowView(data, activeTab.kind, rec).name,
      draft: draftFromRow(activeTab.kind, rec),
    });
    setSaveError(null);
    sfx.select();
  };

  const closeEditor = () => {
    setEditor(null);
    setSaveError(null);
    sfx.blip();
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
      setEditor(null);
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
      if (editor?.id === id) setEditor(null);
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="поиск по имени…"
          className="bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)] w-44"
          style={{ clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
          aria-label="Поиск записей"
        />
        <span className="text-[10px] text-dim tracking-wider flex-1 min-w-0 truncate">
          {activeTab.blurb}
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
          saving={saving}
          saveError={saveError}
          onSave={save}
          onCancel={closeEditor}
        />
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

      {/* rows */}
      {!loading && !error && (
        <div className="flex flex-col gap-2 content-start pb-2">
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
            views.map((v, i) => {
              const isConfirm = confirmDelete === v.id;
              return (
                <div
                  key={v.id}
                  className="panel clip-hud-sm p-2.5 flex items-center gap-3 card-stagger transition-all hover:border-[var(--amber-dim)]"
                  style={{ "--card-i": Math.min(i, 14) } as React.CSSProperties}
                >
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
                      onClick={() => openEdit(v.id)}
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
                      onClick={() => {
                        if (isConfirm) {
                          void doDelete(v.id, v.name);
                        } else {
                          setConfirmDelete(v.id);
                          sfx.error();
                        }
                      }}
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
            })
          )}
        </div>
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
          </ul>
        </details>
      )}
    </section>
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
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onCancel: () => void;
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
  saving,
  saveError,
  onSave,
  onCancel,
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
  // textarea описания — нужна тулбару порчи для работы с выделением
  const descRef = useRef<HTMLTextAreaElement | null>(null);

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
  const showOrder = isLore || isFaction;

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
              <div className="text-[9px] text-dim mt-1">
                {"// файл кладётся в public/ (напр. public/heroes/) //"}
              </div>
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

      {/* error + actions */}
      {saveError && (
        <div className="text-[11px] leading-relaxed" style={{ color: "var(--red)" }}>
          ⚠ {saveError}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
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
        <button
          onClick={onCancel}
          disabled={saving}
          className="btn-crt clip-hud-sm px-4 py-2 text-xs"
        >
          ✕ ОТМЕНА
        </button>
        <span className="text-[9px] text-dim tracking-wider">
          {"// правки увидят все стражи архива //"}
        </span>
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
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      className={`w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)] transition-colors ${className}`}
      style={{ clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
    />
  );
}
