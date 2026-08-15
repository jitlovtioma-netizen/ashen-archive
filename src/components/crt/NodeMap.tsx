"use client";

import { useState } from "react";
import type { CardRecord } from "./RecordCard";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { SYSTEM_COLOR } from "@/lib/types";

interface NodeMapProps {
  records: CardRecord[];
}

export function NodeMap({ records }: NodeMapProps) {
  const [hover, setHover] = useState<string | null>(null);
  const unlockedIds = useArchive((s) => s.unlockedIds);

  return (
    <div className="panel clip-hud brackets relative w-full aspect-[16/10] overflow-hidden">
      {/* grid backdrop */}
      <svg className="absolute inset-0 w-full h-full opacity-20" aria-hidden>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="var(--green-deep)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* connection lines between nearby nodes */}
      <svg className="absolute inset-0 w-full h-full" aria-hidden>
        {records.map((a, i) =>
          records.slice(i + 1).map((b) => {
            const dx = a.mapX - b.mapX;
            const dy = a.mapY - b.mapY;
            const dist = Math.hypot(dx, dy);
            if (dist > 380) return null;
            return (
              <line
                key={`${a.id}-${b.id}`}
                x1={`${a.mapX / 10}%`}
                y1={`${a.mapY / 10}%`}
                x2={`${b.mapX / 10}%`}
                y2={`${b.mapY / 10}%`}
                stroke="var(--green-deep)"
                strokeWidth="0.6"
                opacity={hover === a.id || hover === b.id ? 0.6 : 0.2}
              />
            );
          })
        )}
      </svg>

      {/* nodes */}
      {records.map((r) => {
        const sealed = r.isLocked && !unlockedIds.includes(r.id);
        const color = sealed
          ? "var(--amber)"
          : r.isCorrupted
            ? "var(--red)"
            : SYSTEM_COLOR[r.system];
        const isHover = hover === r.id;
        return (
          <button
            key={r.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${r.mapX / 10}%`, top: `${r.mapY / 10}%` }}
            onMouseEnter={() => {
              setHover(r.id);
              sfx.hover();
            }}
            onMouseLeave={() => setHover(null)}
            aria-label={r.name}
          >
            <span
              className="block rounded-full transition-all"
              style={{
                width: isHover ? 16 : 11,
                height: isHover ? 16 : 11,
                background: color,
                boxShadow: `0 0 ${isHover ? 14 : 8}px ${color}`,
                opacity: sealed ? 0.7 : 1,
              }}
            />
            {sealed && (
              <span
                className="absolute -top-1 -right-1 text-[10px] glow-amber"
                aria-hidden
              >
                🔒
              </span>
            )}
            <span
              className={`absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap text-[10px] tracking-wider transition-opacity ${
                isHover ? "opacity-100" : "opacity-0"
              }`}
              style={{ color }}
            >
              {r.name}
            </span>
          </button>
        );
      })}

      {/* legend */}
      <div className="absolute bottom-2 left-2 flex gap-3 text-[10px] text-dim">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "var(--green)" }}
          />
          D&D
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "var(--cyan)" }}
          />
          PF2e
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "var(--amber)" }}
          />
          Запечатано
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "var(--red)" }}
          />
          Искажено
        </span>
      </div>
      <div className="absolute top-2 right-2 text-[10px] text-dim tracking-widest">
        {"// ПРОЕКЦИЯ_АРХИВА"}
      </div>
    </div>
  );
}
