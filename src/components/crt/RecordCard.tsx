"use client";

import { useState } from "react";
import { Sigil } from "./Sigil";
import { RecordModal } from "./RecordModal";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { SYSTEM_LABEL, SYSTEM_COLOR, type GameSystem } from "@/lib/types";

export interface CardRecord {
  id: string;
  name: string;
  subtitle: string;
  system: GameSystem;
  description: string;
  sigil: string;
  isLocked: boolean;
  isCorrupted: boolean;
  secretFragment: string | null;
  shardWord: string | null;
  mapX: number;
  mapY: number;
  imageUrl?: string | null;
  status?: "ALIVE" | "DEAD" | "MISSING";
}

interface RecordCardProps {
  record: CardRecord;
}

export function RecordCard({ record }: RecordCardProps) {
  const { unlockedIds } = useArchive();
  const [modalOpen, setModalOpen] = useState(false);

  const isSealed = record.isLocked && !unlockedIds.includes(record.id);
  const isCorrupted = record.isCorrupted;

  const onOpen = () => {
    sfx.select();
    setModalOpen(true);
  };

  return (
    <>
      <article
        className={`panel clip-hud brackets relative p-4 transition-all duration-200 cursor-pointer hover:border-[var(--green-dim)] hover:shadow-[0_0_16px_rgba(74,246,38,0.15)] ${
          isSealed ? "opacity-90" : ""
        }`}
        onClick={onOpen}
      >
        {/* status chips */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span
            className="chip"
            style={{
              color: SYSTEM_COLOR[record.system],
              borderColor: `color-mix(in srgb, ${SYSTEM_COLOR[record.system]} 40%, transparent)`,
            }}
          >
            {SYSTEM_LABEL[record.system]}
          </span>
          {isSealed && (
            <span className="chip chip-warn" title="Запечатано">
              🔒 ОПЕЧАТАНО
            </span>
          )}
          {isCorrupted && (
            <span className="chip chip-err" title="Искажено">
              ⚠ ИСКАЖЕНО
            </span>
          )}
          {!isSealed && !isCorrupted && (
            <span className="chip chip-ok" title="Доступно">
              ✓ ДОСТУПНО
            </span>
          )}
          {record.status === "DEAD" && (
            <span className="chip chip-err" title="Пал">
              💀 ПАЛ
            </span>
          )}
          {record.status === "MISSING" && (
            <span className="chip chip-warn" title="Пропал без вести">
              ? ПРОПАЛ
            </span>
          )}
        </div>

        <div className="flex gap-4">
          {/* sigil (compact) */}
          <div className="shrink-0">
            <Sigil glyph={record.sigil} corrupted={isCorrupted} size={72} />
          </div>

          {/* content */}
          <div className="flex-1 min-w-0">
            <h3
              className={`font-medieval text-lg leading-tight ${
                isCorrupted ? "glow-red glitch" : "glow-green"
              }`}
              data-text={record.name}
            >
              {record.name}
            </h3>
            <div className="text-dim text-xs tracking-wider mt-0.5 mb-2">
              {record.subtitle}
            </div>

            {/* short description / sealed notice */}
            {!isSealed ? (
              <p
                className={`text-[13px] leading-relaxed line-clamp-2 ${
                  isCorrupted ? "text-[var(--red-dim)]" : "text-[var(--text)]"
                }`}
              >
                {record.description}
              </p>
            ) : (
              <div className="text-dim text-[11px] italic">
                {"// данные опечатаны //"}
              </div>
            )}
          </div>
        </div>

        {/* open hint */}
        <div className="flex items-center justify-end mt-3">
          <span className="text-[10px] text-dim tracking-widest hint-caret">
            {isSealed ? "РИТУАЛ" : "ОТКРЫТЬ ДОСЬЕ"}
          </span>
        </div>
      </article>

      {modalOpen && (
        <RecordModal record={record} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
