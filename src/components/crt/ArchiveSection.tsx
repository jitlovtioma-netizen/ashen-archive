"use client";

import type { CSSProperties } from "react";
import { ChapterIntro } from "./ChapterIntro";
import { useArchiveData } from "@/lib/useArchiveData";
import { RecordCard, type CardRecord } from "./RecordCard";
import { useArchive } from "@/lib/store";
import {
  secretsShardsRequired,
  shardsWordGenitive,
  type ArchiveType,
  type GameSystem,
} from "@/lib/types";

interface ArchiveSectionProps<T> {
  type: ArchiveType;
  system: GameSystem;
  title: string;
  code: string;
  blurb: string;
  normalize: (raw: T) => CardRecord;
  columns?: 1 | 3;
  filter?: (raw: T) => boolean;
  revealAtMaxGaze?: string;
  /** Если true — сортировать по дружбе (по убыванию), мёртвые внизу. */
  sortByFriendship?: boolean;
  /** Если true — не-живые (DEAD, MISSING, etc.) внизу, живые сверху. */
  sortDeadLast?: boolean;
  /** Стиль пустого состояния (когда записей нет вообще). */
  emptyHint?: "secrets";
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
  sortByFriendship = false,
  sortDeadLast = false,
  emptyHint,
}: ArchiveSectionProps<T>) {
  const { data, loading, error } = useArchiveData<T>(type, system);
  const gaze = useArchive((s) => s.gaze);

  const records = (data ?? [])
    .filter((raw) => {
      if (filter && !filter(raw)) return false;
      if (revealAtMaxGaze) {
        const title = (raw as Record<string, unknown>).title as string;
        if (title === revealAtMaxGaze && gaze < 90) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      const ra = a as Record<string, unknown>;
      const rb = b as Record<string, unknown>;

      if (sortByFriendship) {
        // Не-живые — внизу
        const aAlive = ra.status === "ALIVE" || ra.status === undefined;
        const bAlive = rb.status === "ALIVE" || rb.status === undefined;
        if (aAlive !== bAlive) return aAlive ? -1 : 1;
        // По дружбе по убыванию (null → 0)
        const fa = (ra.friendship as number) ?? 0;
        const fb = (rb.friendship as number) ?? 0;
        if (fa !== fb) return fb - fa;
      }

      if (sortDeadLast) {
        // Не-живые (DEAD, MISSING, etc.) — внизу, живые — сверху
        const aAlive = ra.status === "ALIVE" || ra.status === undefined;
        const bAlive = rb.status === "ALIVE" || rb.status === undefined;
        if (aAlive !== bAlive) return aAlive ? -1 : 1;
      }

      const sa = (ra.sortOrder as number) ?? 0;
      const sb = (rb.sortOrder as number) ?? 0;
      return sa - sb;
    })
    .map(normalize);

  return (
    <section className="flex flex-col gap-3 h-full">
      <ChapterIntro code={code} />
      <div className="crt-only panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; СЕКТОР_{system} &gt;
        </span>
        <span className="text-[11px] glow-green tracking-widest">{code}</span>
        <span className="flex-1" />
        <span className="text-[10px] text-dim hidden sm:inline">{blurb}</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-green-strong tracking-wider title-sweep">
          {title}
        </h2>
        <span className="chip chip-ok text-[10px]">
          ЗАПИСЕЙ: {records.length}
        </span>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="panel clip-hud p-4 h-20 animate-pulse"
              style={{ background: "var(--panel-2)" }}
            />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="panel clip-hud p-6 text-center">
          <div className="font-vt323 text-xl glow-red mb-2">
            [ ОШИБКА ПОДКЛЮЧЕНИЯ ]
          </div>
          <div className="text-dim text-sm">
            {"// не удалось получить данные: "}{error}{" //"}
          </div>
        </div>
      )}

      {!loading && !error && records.length === 0 && emptyHint === "secrets" && (
        <div
          className="panel clip-hud brackets p-8 sm:p-12 text-center fade-in"
          style={{
            borderColor: "var(--violet-dim)",
            boxShadow: "0 0 40px rgba(var(--violet-rgb), 0.12)",
          }}
        >
          <div className="text-5xl mb-4 pulse-slow">🔓</div>
          <div className="font-medieval text-xl glow-violet tracking-wider mb-3 glitch" data-text="ХРАНИЛИЩЕ ОТКРЫТО">
            ХРАНИЛИЩЕ ОТКРЫТО
          </div>
          <div className="text-[12px] text-dim leading-relaxed max-w-md mx-auto">
            {`// печать ${shardsWordGenitive(secretsShardsRequired(system))} осколков снята, но страницы этого мира ещё пусты. //`}
            <br />
            {"// сокрытое проявится, когда Создатель впишет его в архив. //"}
          </div>
          <div className="mt-4 flex justify-center gap-1.5 flex-wrap">
            {Array.from({ length: secretsShardsRequired(system) }).map((_, i) => (
              <span
                key={i}
                className="chip chip-violet text-[10px]"
                title="Осколок памяти собран"
              >
                🧩 •
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && !(records.length === 0 && emptyHint === "secrets") && (
        <div
          className={
            columns === 1
              ? "flex flex-col gap-3 content-start pb-2"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start pb-2"
          }
        >
          {records.map((r, i) => (
            <div
              key={r.id}
              className="card-stagger"
              style={{ "--card-i": Math.min(i, 14) } as CSSProperties}
            >
              <RecordCard record={r} horizontal={columns === 1} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
