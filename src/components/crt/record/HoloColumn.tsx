"use client";

import { HoloPortrait } from "../HoloPortrait";
import { Sigil } from "../Sigil";
import type { CardRecord } from "../RecordCard";

interface HoloColumnProps {
  record: CardRecord;
  /** картинка показываемой версии записи (у Дианы есть «swap»-форма) */
  imageUrl: string | null | undefined;
  isSealed: boolean;
  isCorrupted: boolean;
  missingLabel?: string;
}

/** Правая колонка окна досье: голограмма-портрет (или сигил) и техданные. */
export function HoloColumn({ record, imageUrl, isSealed, isCorrupted, missingLabel }: HoloColumnProps) {
  return (
    <div className="md:w-[45%] p-4 sm:p-6 flex flex-col bg-[var(--bg-deep)] min-h-[300px] relative">
      <div className="text-[10px] text-dim tracking-widest mb-3 absolute top-3 left-4 z-30">{"// ПРОЕКЦИЯ //"}</div>
      <div className="flex-1 flex items-center justify-center w-full min-h-[280px] holo-reveal">
        {record.imageUrl && !isSealed ? (
          <HoloPortrait
            src={imageUrl ?? ""}
            corrupted={isCorrupted}
            sealed={isSealed}
            status={record.status}
            missingLabel={missingLabel}
            full
            fallbackGlyph={record.sigil}
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Sigil glyph={record.sigil} corrupted={isCorrupted} size={180} />
            {isSealed && (
              <div className="text-center">
                <div className="font-vt323 text-xl glow-amber">[ ПЕЧАТЬ ]</div>
                <div className="text-dim text-[10px] tracking-wider mt-1">{"// проекция недоступна //"}</div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 w-full panel-inset p-2 text-[9px] text-dim tracking-wider">
        <div className="flex justify-between"><span>SIGIL</span><span className="glow-green">{record.sigil}</span></div>
        <div className="flex justify-between"><span>MAP_X</span><span>{record.mapX}</span></div>
        <div className="flex justify-between"><span>MAP_Y</span><span>{record.mapY}</span></div>
        <div className="flex justify-between">
          <span>STATUS</span>
          <span className={record.status === "DEAD" ? "glow-red" : record.status === "MISSING" ? "glow-amber" : "glow-green"}>
            {record.status ?? "ALIVE"}
          </span>
        </div>
      </div>
    </div>
  );
}
