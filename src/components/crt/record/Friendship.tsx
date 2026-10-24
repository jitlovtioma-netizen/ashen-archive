"use client";

import { FRIENDSHIP_UNKNOWN } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Шкала отношений второстепенного героя: 1–10 (от красного к зелёному,
// на 10 — розовый с сердцем) или FRIENDSHIP_UNKNOWN («неизвестно» — шкала
// растворена в ирисе). 0 / null — шкала скрыта.
// ─────────────────────────────────────────────────────────────────────────────

/** Цвет шкалы для значения 1–10. */
export function friendshipColor(value: number): string {
  if (value >= 10) return "#ff69b4";
  if (value >= 7) return `rgb(${Math.round(232 * (1 - (value - 7) / 3))}, 246, 38)`;
  if (value >= 4) return `rgb(255, ${Math.round(140 + 92 * ((value - 4) / 3))}, 40)`;
  const t = (value - 1) / 2;
  return `rgb(${Math.round(160 + 95 * t)}, ${Math.round(20 + 16 * t)}, 20)`;
}

/** Компактная шкала для карточки досье. */
export function FriendshipBar({ value }: { value: number | null | undefined }) {
  if (value === FRIENDSHIP_UNKNOWN) {
    return (
      <span className="friend-unknown-chip" title="Отношения неизвестны">
        ???
      </span>
    );
  }
  if (typeof value !== "number" || value <= 0) return null;
  const color = friendshipColor(value);
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {value >= 10 && <span className="text-[10px] leading-none">❤️</span>}
      <div className="h-1 w-12 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.4)" }}>
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{ width: `${Math.min(100, value * 10)}%`, background: color, boxShadow: `0 0 4px ${color}` }}
        />
      </div>
      <span className="text-[8px] font-mono" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/** Большая шкала в окне досье. */
export function FriendshipMeter({ value }: { value: number | null | undefined }) {
  if (value === FRIENDSHIP_UNKNOWN) {
    return (
      <div className="mb-4">
        <div className="friend-unknown-bar" aria-hidden />
        <div className="text-[10px] tracking-[0.3em] mt-1 text-dim">
          ОТНОШЕНИЯ: <span className="friend-unknown-label">НЕИЗВЕСТНО</span>
        </div>
      </div>
    );
  }
  if (typeof value !== "number" || value <= 0) return null;
  const color = friendshipColor(value);
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        {value >= 10 && <span className="text-2xl">❤️</span>}
        <div
          className="flex-1 h-3 overflow-hidden rounded-full"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--line)" }}
        >
          <div
            className="h-full transition-all duration-500 rounded-full"
            style={{ width: `${(value / 10) * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }}
          />
        </div>
        <span className="text-sm font-mono tracking-wider shrink-0" style={{ color }}>
          {value}/10
        </span>
      </div>
      <div className="text-[9px] text-dim tracking-widest mt-1 text-center">{"// ОТНОШЕНИЯ //"}</div>
    </div>
  );
}
