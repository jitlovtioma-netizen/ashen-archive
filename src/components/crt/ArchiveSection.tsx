"use client";

import { useArchiveData } from "@/lib/useArchiveData";
import { RecordCard, type CardRecord } from "./RecordCard";
import { useArchive } from "@/lib/store";
import type { ArchiveType, GameSystem } from "@/lib/types";

interface ArchiveSectionProps<T> {
  type: ArchiveType;
  system: GameSystem;
  title: string;
  code: string;
  blurb: string;
  normalize: (raw: T) => CardRecord;
  columns?: 1 | 3; // 1 = карточки в одну колонку (герои/NPC), 3 = сетка (по умолчанию)
  filter?: (raw: T) => boolean; // опциональный фильтр записей
  // Запись с этим названием показывается только при gaze >= 100
  revealAtMaxGaze?: string;
}

export function ArchiveSection<T>({
  type,
  system,
  title,
  code,
  blurb,
  normalize,
  columns = 3,
  filter,
  revealAtMaxGaze,
}: ArchiveSectionProps<T>) {
  const { data, loading, error } = useArchiveData<T>(type, system);
  const gaze = useArchive((s) => s.gaze);

  const records = (data ?? [])
    .filter((raw) => {
      if (filter && !filter(raw)) return false;
      // Скрываем "Отражение" пока gaze < 100
      if (revealAtMaxGaze) {
        const title = (raw as { title?: string }).title;
        if (title === revealAtMaxGaze && gaze < 100) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      const sa = (a as { sortOrder?: number }).sortOrder ?? 0;
      const sb = (b as { sortOrder?: number }).sortOrder ?? 0;
      return sa - sb;
    })
    .map(normalize);

  return (
    <section className="flex flex-col gap-3 h-full">
      {/* breadcrumb header */}
      <div className="panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; СЕКТОР_{system} &gt;
        </span>
        <span className="text-[11px] glow-green tracking-widest">{code}</span>
        <span className="flex-1" />
        <span className="text-[10px] text-dim hidden sm:inline">
          {blurb}
        </span>
      </div>

      {/* section title */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-green-strong tracking-wider">
          {title}
        </h2>
        <span className="chip chip-ok text-[10px]">
          ЗАПИСЕЙ: {records.length}
        </span>
      </div>

      {/* content */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="panel clip-hud p-4 h-48 animate-pulse"
              style={{ background: "var(--panel-2)" }}
            >
              <div className="h-3 w-20 bg-[var(--line)] mb-3" />
              <div className="h-4 w-2/3 bg-[var(--line)] mb-2" />
              <div className="h-3 w-full bg-[var(--line)] mb-1.5" />
              <div className="h-3 w-5/6 bg-[var(--line)] mb-1.5" />
              <div className="h-3 w-3/4 bg-[var(--line)]" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="panel clip-hud p-6 text-center">
          <div className="font-vt323 text-xl glow-red mb-2">
            [ ОШИБКА ПОДКЛЮЧЕНИЯ ]
          </div>
          <div className="text-dim text-sm">
            {"// не удалось получить данные архива: "}{error}{" //"}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div
          className={
            columns === 1
              ? "flex flex-col gap-3 content-start pb-2"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start pb-2"
          }
        >
          {records.map((r) => (
            <RecordCard key={r.id} record={r} horizontal={columns === 1} />
          ))}
        </div>
      )}
    </section>
  );
}
