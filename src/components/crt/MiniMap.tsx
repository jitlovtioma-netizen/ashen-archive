"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useArchiveData } from "@/lib/useArchiveData";
import { useArchive, type Section } from "@/lib/store";
import { sfx } from "@/lib/audio";
import type {
  Character,
  Lore,
  Location,
  Chronicle,
  GameSystem,
} from "@/lib/types";

interface MiniMapProps {
  system: GameSystem;
  section: Section;
}

// Единый тип для точек на карте
interface MapPoint {
  id: string;
  label: string;
  sigil: string;
  mapX: number;
  mapY: number;
  isLocked: boolean;
  isCorrupted: boolean;
  system: GameSystem;
}

// Нормализация разных типов записей в MapPoint
function toPoint(
  r: Character | Lore | Location | Chronicle,
  section: Section,
): MapPoint {
  const rec = r as Record<string, unknown>;
  switch (section) {
    case "characters":
      return {
        id: rec.id as string,
        label: rec.name as string,
        sigil: rec.sigil as string,
        mapX: (rec.mapX as number) ?? 0,
        mapY: (rec.mapY as number) ?? 0,
        isLocked: (rec.isLocked as boolean) ?? false,
        isCorrupted: (rec.isCorrupted as boolean) ?? false,
        system: rec.system as GameSystem,
      };
    case "lore":
    case "lore_gods":
    case "lore_npcs":
    case "secrets":
      return {
        id: rec.id as string,
        label: rec.title as string,
        sigil: rec.sigil as string,
        mapX: (rec.mapX as number) ?? 0,
        mapY: (rec.mapY as number) ?? 0,
        isLocked: (rec.isLocked as boolean) ?? false,
        isCorrupted: (rec.isCorrupted as boolean) ?? false,
        system: rec.system as GameSystem,
      };
    case "locations":
      return {
        id: rec.id as string,
        label: rec.name as string,
        sigil: rec.sigil as string,
        mapX: (rec.mapX as number) ?? 0,
        mapY: (rec.mapY as number) ?? 0,
        isLocked: (rec.isLocked as boolean) ?? false,
        isCorrupted: (rec.isCorrupted as boolean) ?? false,
        system: rec.system as GameSystem,
      };
    case "chronicles":
      return {
        id: rec.id as string,
        label: `#${rec.sessionNumber as number}`,
        sigil: "📜",
        mapX: ((rec.sessionNumber as number) - 1) * 120 + 40,
        mapY: 200,
        isLocked: (rec.isLocked as boolean) ?? false,
        isCorrupted: (rec.isCorrupted as boolean) ?? false,
        system: rec.system as GameSystem,
      };
    default:
      return {
        id: rec.id as string,
        label: "???",
        sigil: "?",
        mapX: 100,
        mapY: 100,
        isLocked: false,
        isCorrupted: false,
        system: rec.system as GameSystem,
      };
  }
}

// Маппинг секций на API-тип
const SECTION_TO_TYPE: Partial<Record<Section, "characters" | "lore" | "locations" | "chronicles">> = {
  characters: "characters",
  lore: "lore",
  lore_gods: "lore",
  lore_npcs: "lore",
  locations: "locations",
  chronicles: "chronicles",
};

// Фильтр по folder для lore-секций
const SECTION_FOLDER: Partial<Record<Section, string>> = {
  lore_gods: "PANTHEON",
  lore_npcs: "SECONDARY_HEROES",
  secrets: "SECRETS",
};

export function MiniMap({ system, section }: MiniMapProps) {
  const [expanded, setExpanded] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiType = SECTION_TO_TYPE[section];

  // Слушаем глобальное событие toggle (клавиша M)
  useEffect(() => {
    const onToggle = () => setExpanded((e) => !e);
    window.addEventListener("ashen:toggle-minimap", onToggle);
    return () => window.removeEventListener("ashen:toggle-minimap", onToggle);
  }, []);

  // Загружаем данные только для секций, у которых есть API-тип
  const { data, loading } = useArchiveData<
    Character | Lore | Location | Chronicle
  >(
    apiType ?? "characters",
    system,
  );

  const points = useMemo<MapPoint[]>(() => {
    if (!data || !apiType) return [];
    let rows = data;
    // Для lore-секций фильтруем по folder
    const folder = SECTION_FOLDER[section];
    if (apiType === "lore" && folder !== undefined) {
      rows = data.filter(
        (r) => (r as Record<string, unknown>).folder === folder,
      );
    } else if (apiType === "lore" && folder === undefined) {
      // Основной Лор — folder = null
      rows = data.filter(
        (r) => !(r as Record<string, unknown>).folder,
      );
    }
    return rows.map((r) => toPoint(r, section));
  }, [data, section, apiType]);

  // Вычисляем границы для нормализации координат
  const bounds = useMemo(() => {
    if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const xs = points.map((p) => p.mapX);
    const ys = points.map((p) => p.mapY);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      minX: minX - 20,
      minY: minY - 20,
      maxX: maxX + 20,
      maxY: maxY + 20,
    };
  }, [points]);

  const unlockedIds = useArchive((s) => s.unlockedIds);

  // Нормализация координат в 0-100%
  const norm = (val: number, min: number, max: number) => {
    const range = max - min || 1;
    return ((val - min) / range) * 90 + 5; // 5% padding
  };

  if (!apiType) return null;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-12 right-2 sm:bottom-14 sm:right-3 z-40 select-none"
      style={{ width: expanded ? "220px" : "48px" }}
    >
      <div className="panel clip-hud-sm minimap-container relative overflow-hidden transition-all">
        {/* Заголовок */}
        <button
          onClick={() => {
            setExpanded((e) => !e);
            sfx.hover();
          }}
          className="w-full flex items-center gap-1.5 px-2 py-1 border-b border-[var(--line)] hover:bg-[var(--green-deep)] transition-colors"
          aria-label={expanded ? "Свернуть мини-карту" : "Развернуть мини-карту"}
          title="Мини-карта (свернуть/развернуть)"
        >
          <span className="text-[9px] glow-green tracking-widest">MAP</span>
          {expanded && (
            <>
              <span className="text-[9px] text-dim">/</span>
              <span className="text-[9px] text-dim tracking-widest truncate">
                {section.toUpperCase()}
              </span>
              <span className="flex-1" />
              <span className="text-[9px] text-dim">{points.length}●</span>
            </>
          )}
          <span className="text-[10px] text-dim ml-auto">
            {expanded ? "▾" : "▴"}
          </span>
        </button>

        {/* Тело карты */}
        {expanded && (
          <div className="relative" style={{ height: "160px" }}>
            {/* grid backdrop */}
            <svg
              className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
              aria-hidden
            >
              <defs>
                <pattern
                  id="mm-grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="var(--green-deep)"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#mm-grid)" />
            </svg>

            {/* connection lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden
            >
              {points.map((a, i) =>
                points.slice(i + 1).map((b) => {
                  const ax = norm(a.mapX, bounds.minX, bounds.maxX);
                  const ay = norm(a.mapY, bounds.minY, bounds.maxY);
                  const bx = norm(b.mapX, bounds.minX, bounds.maxX);
                  const by = norm(b.mapY, bounds.minY, bounds.maxY);
                  const dist = Math.hypot(ax - bx, ay - by);
                  if (dist > 40) return null;
                  return (
                    <line
                      key={`${a.id}-${b.id}`}
                      x1={`${ax}%`}
                      y1={`${ay}%`}
                      x2={`${bx}%`}
                      y2={`${by}%`}
                      stroke="var(--green-deep)"
                      strokeWidth="0.4"
                      opacity={
                        hover === a.id || hover === b.id ? 0.7 : 0.2
                      }
                    />
                  );
                }),
              )}
            </svg>

            {/* nodes */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] text-dim tracking-widest hint-caret">
                  ЗАГРУЗКА
                </span>
              </div>
            )}

            {!loading && points.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] text-dim">{"// нет точек //"}</span>
              </div>
            )}

            {points.map((p) => {
              const sealed = p.isLocked && !unlockedIds.includes(p.id);
              const color = sealed
                ? "var(--amber)"
                : p.isCorrupted
                  ? "var(--red)"
                  : "var(--green)";
              const isHover = hover === p.id;
              const x = norm(p.mapX, bounds.minX, bounds.maxX);
              const y = norm(p.mapY, bounds.minY, bounds.maxY);
              return (
                <button
                  key={p.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onMouseEnter={() => {
                    setHover(p.id);
                    sfx.hover();
                  }}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => {
                    sfx.select();
                    // Скролл к карточке по id
                    const el = document.querySelector(
                      `[data-record-id="${p.id}"]`,
                    );
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      (el as HTMLElement).classList.add("seal-break");
                      setTimeout(
                        () => (el as HTMLElement).classList.remove("seal-break"),
                        600,
                      );
                    }
                  }}
                  aria-label={p.label}
                >
                  <span
                    className="block rounded-full transition-all"
                    style={{
                      width: isHover ? 10 : 6,
                      height: isHover ? 10 : 6,
                      background: color,
                      boxShadow: `0 0 ${isHover ? 8 : 4}px ${color}`,
                      opacity: sealed ? 0.7 : 1,
                    }}
                  />
                  {isHover && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap text-[9px] tracking-wider pointer-events-none"
                      style={{ color }}
                    >
                      {p.sigil} {p.label}
                    </span>
                  )}
                </button>
              );
            })}

            {/* legend */}
            <div className="absolute bottom-1 left-1 flex gap-2 text-[8px] text-dim pointer-events-none">
              <span className="flex items-center gap-0.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--green)" }}
                />
                ОТКР
              </span>
              <span className="flex items-center gap-0.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--amber)" }}
                />
                ПЕЧ
              </span>
              <span className="flex items-center gap-0.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--red)" }}
                />
                ИСК
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
