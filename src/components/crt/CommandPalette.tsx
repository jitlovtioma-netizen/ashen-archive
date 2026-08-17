"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useArchive, type Section } from "@/lib/store";
import { sfx } from "@/lib/audio";
import type { Character, Lore, Location, Chronicle, GameSystem } from "@/lib/types";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  sigil: string;
  section: Section;
  system: GameSystem;
}

const SECTION_META: Record<string, { label: string; code: string }> = {
  characters: { label: "Герои", code: "АРХИВ_ГЕРОЕВ" },
  lore: { label: "Лор", code: "БАЗА_ЛОРА" },
  lore_gods: { label: "Божества", code: "ЛОР_ПАНТЕОН" },
  lore_npcs: { label: "Второстеп. герои", code: "ЛОР_НПС" },
  locations: { label: "Локации", code: "РЕЕСТР_МЕСТ" },
  chronicles: { label: "Хроники", code: "ЛЕТОПИСЬ" },
};

const QUICK_NAV: SearchResult[] = [
  { id: "nav-characters", title: "Перейти: Герои", subtitle: "быстрый переход", sigil: "⚔", section: "characters", system: "DND" },
  { id: "nav-factions", title: "Перейти: Фракции", subtitle: "быстрый переход", sigil: "🜲", section: "factions", system: "DND" },
  { id: "nav-lore", title: "Перейти: Лор", subtitle: "быстрый переход", sigil: "📖", section: "lore", system: "DND" },
  { id: "nav-lore_gods", title: "Перейти: Божества", subtitle: "быстрый переход", sigil: "✦", section: "lore_gods", system: "DND" },
  { id: "nav-lore_npcs", title: "Перейти: Второстеп. герои", subtitle: "быстрый переход", sigil: "🎭", section: "lore_npcs", system: "DND" },
  { id: "nav-locations", title: "Перейти: Локации", subtitle: "быстрый переход", sigil: "🗺", section: "locations", system: "DND" },
  { id: "nav-chronicles", title: "Перейти: Хроники", subtitle: "быстрый переход", sigil: "📜", section: "chronicles", system: "DND" },
  { id: "nav-achievements", title: "Перейти: Достижения", subtitle: "быстрый переход", sigil: "🏆", section: "achievements", system: "DND" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const user = useArchive((s) => s.user);
  const setSection = useArchive((s) => s.setSection);
  const system = user?.system ?? "DND";

  // Загружаем все записи один раз при открытии
  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [chars, lore, locs, chron] = await Promise.all([
        fetch(`/api/archive?type=characters&system=${system}`).then((r) => r.json() as Promise<Character[]>),
        fetch(`/api/archive?type=lore&system=${system}`).then((r) => r.json() as Promise<Lore[]>),
        fetch(`/api/archive?type=locations&system=${system}`).then((r) => r.json() as Promise<Location[]>),
        fetch(`/api/archive?type=chronicles&system=${system}`).then((r) => r.json() as Promise<Chronicle[]>),
      ]);

      const out: SearchResult[] = [];
      for (const c of chars) {
        out.push({
          id: c.id,
          title: c.name,
          subtitle: c.category,
          sigil: c.sigil,
          section: "characters",
          system: c.system,
        });
      }
      const folderToSection: Record<string, Section> = {
        PANTHEON: "lore_gods",
        SECONDARY_HEROES: "lore_npcs",
        SECRETS: "secrets",
      };
      for (const l of lore) {
        const folder = (l as Record<string, unknown>).folder as string | null;
        const section = folder ? folderToSection[folder] ?? "lore" : "lore";
        if (section === "secrets") continue; // не показываем секреты в поиске
        out.push({
          id: l.id,
          title: l.title,
          subtitle: l.category,
          sigil: l.sigil,
          section,
          system: l.system,
        });
      }
      for (const l of locs) {
        out.push({
          id: l.id,
          title: l.name,
          subtitle: l.type,
          sigil: l.sigil,
          section: "locations",
          system: l.system,
        });
      }
      for (const c of chron) {
        out.push({
          id: c.id,
          title: `Сессия #${c.sessionNumber} — ${c.title}`,
          subtitle: c.date,
          sigil: "📜",
          section: "chronicles",
          system: c.system,
        });
      }
      setResults(out);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [user, system]);

  // Открытие по Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // При открытии — загружаем данные и фокусируемся
  useEffect(() => {
    if (open) {
      loadAll();
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      sfx.beep();
    }
  }, [open, loadAll]);

  // Фильтрация
  const q = query.trim().toLowerCase();
  // В PF2E секция «Достижения» скрыта — убираем из быстрого доступа и поиска.
  const hideAchievements = system === "PF2E";
  const quickNav = hideAchievements
    ? QUICK_NAV.filter((r) => r.section !== "achievements")
    : QUICK_NAV;
  const filtered = q
    ? results.filter((r) => {
        if (hideAchievements && r.section === "achievements") return false;
        const inTitle = r.title.toLowerCase().includes(q);
        const inSubtitle = r.subtitle.toLowerCase().includes(q);
        return inTitle || inSubtitle;
      })
    : quickNav.map((r) => ({ ...r, system }));

  // Сброс активного индекса при изменении фильтра
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Навигация стрелками
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      sfx.hover();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
      sfx.hover();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIdx];
      if (item) {
        setSection(item.section);
        sfx.select();
        setOpen(false);
      }
    }
  };

  // Прокрутка к активному элементу
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      className="cmdk-overlay"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Быстрый поиск по архиву"
    >
      <div
        className="cmdk-panel panel clip-hud"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="px-3 py-2 border-b border-[var(--line)] flex items-center gap-2">
          <span className="text-[10px] text-dim tracking-widest">
            {"// ПОИСК_ПО_АРХИВУ //"}
          </span>
          <span className="flex-1" />
          <span className="cmdk-hint">ESC</span>
        </div>

        {/* Поле ввода */}
        <div className="p-3 border-b border-[var(--line)]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              loading
                ? "// загрузка данных архива... //"
                : "// введите имя героя, лор, локацию... //"
            }
            className="cmdk-input clip-hud-sm w-full px-3 py-2 text-sm"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Список результатов */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto crt-scroll max-h-[50vh]"
        >
          {filtered.length === 0 && !loading && (
            <div className="p-6 text-center">
              <div className="font-vt323 text-lg glow-amber mb-1">
                [ НИЧЕГО НЕ НАЙДЕНО ]
              </div>
              <div className="text-[11px] text-dim">
                {q ? `// нет совпадений для: "${query}" //` : "// архив пуст //"}
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <>
              {!q && (
                <div className="px-3 py-1 text-[9px] text-dim tracking-widest border-b border-[var(--line)]">
                  {"// БЫСТРЫЙ ДОСТУП //"}
                </div>
              )}
              {filtered.map((r, idx) => {
                const meta = SECTION_META[r.section];
                return (
                  <div
                    key={`${r.id}-${idx}`}
                    data-idx={idx}
                    data-active={idx === activeIdx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => {
                      setSection(r.section);
                      sfx.select();
                      setOpen(false);
                    }}
                    className="cmdk-item"
                  >
                    <span className="cmdk-item-sigil text-sm">
                      {r.sigil}
                    </span>
                    <span className="flex flex-col items-start leading-tight min-w-0 flex-1">
                      <span className="text-xs tracking-wider truncate w-full">
                        {r.title}
                      </span>
                      <span className="text-[10px] text-dim truncate w-full">
                        {r.subtitle}
                      </span>
                    </span>
                    {meta && (
                      <span className="cmdk-hint">{meta.label}</span>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Футер */}
        <div className="px-3 py-2 border-t border-[var(--line)] flex items-center gap-3 text-[10px] text-dim">
          <span className="flex items-center gap-1">
            <kbd className="cmdk-hint">↑↓</kbd> навигация
          </span>
          <span className="flex items-center gap-1">
            <kbd className="cmdk-hint">↵</kbd> выбрать
          </span>
          <span className="flex items-center gap-1">
            <kbd className="cmdk-hint">ESC</kbd> закрыть
          </span>
          <span className="flex-1" />
          <span className="text-[9px]">
            {filtered.length} {q ? "совпадений" : "разделов"}
          </span>
        </div>
      </div>
    </div>
  );
}
