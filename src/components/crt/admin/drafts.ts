import { type GameSystem } from "@/lib/types";
import { IRIS_PALETTES } from "@/lib/themes";
import { RecKind, TabKey, AdminCharacterRow, AdminLoreRow, AdminLocationRow, AdminFactionRow, AdminRiddleRow, AdminAchievementRow, AdminData, AnyRow, FOLDER_LABELS, Draft } from "./types";

export function emptyDraft(tab: TabKey): Draft {
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

export function draftFromRow(kind: RecKind, r: AnyRow): Draft {
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

export function buildPayload(kind: RecKind, d: Draft, system: GameSystem): Record<string, unknown> {
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

export function tabForRecord(kind: RecKind, r: AnyRow): TabKey {
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

export interface RowView {
  id: string;
  name: string;
  subtitle: string;
  sigil: string;
  chips: { text: string; cls?: string; title?: string }[];
}

export function rowsForTab(data: AdminData, tab: TabKey): AnyRow[] {
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

export function rowView(data: AdminData, kind: RecKind, r: AnyRow): RowView {
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
    if (l.friendship === -1) chips.push({ text: "❔ ???", title: "Отношения неизвестны" });
    else if (l.friendship) chips.push({ text: `❤ ${l.friendship}/10`, title: "Шкала дружбы" });
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
