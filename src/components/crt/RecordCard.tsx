"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sigil } from "./Sigil";
import { HoloPortrait } from "./HoloPortrait";
import { BrunoMiniGame } from "./BrunoMiniGame";
import { RiddleGate } from "./RiddleGate";
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
  horizontal?: boolean;
}

const GLITCH_CHARS = "█▓▒░▚▞▐▌╳╲╱▀▄";

function censorText(text: string, corrupted: boolean, revealed: boolean) {
  if (!corrupted) return text;
  if (revealed) return text;
  const words = text.split(/(\s+)/);
  return words
    .map((w) => {
      if (/\s/.test(w) || w.length === 0) return w;
      if (Math.random() > 0.55) return w;
      let out = "";
      for (let i = 0; i < w.length; i++) {
        out += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
      }
      return `<span class="censor-glitch">${out}</span>`;
    })
    .join(" ");
}

export function RecordCard({ record, horizontal = false }: RecordCardProps) {
  const {
    unlockedIds,
    unlockRecord,
    shards,
    addShard,
    revealedSecrets,
    revealRecordSecret,
    addGaze,
    unlockAchievement,
    pushToast,
    solvedRiddles,
  } = useArchive();

  const isSealed = record.isLocked && !unlockedIds.includes(record.id);
  const isCorrupted = record.isCorrupted;
  const isEntity = record.name === "???" || record.name === "Неизвестная личность";
  const shardCollected = record.shardWord
    ? shards.includes(record.shardWord)
    : false;
  const secretRevealed = revealedSecrets.includes(record.id);
  const riddleLocked =
    (record.name === "Мартин" || record.name === "Мёртвый План" || record.name === "Четвёртый" || record.name === "Разум Бруно" || record.name === "Джейтал" || record.name === "Тартуччио" || record.name === "Неизвестная личность") &&
    !solvedRiddles.includes(record.name);

  const [modalOpen, setModalOpen] = useState(false);
  const [ritualCharge, setRitualCharge] = useState(0);
  const [ritualActive, setRitualActive] = useState(false);
  const [miniGameOpen, setMiniGameOpen] = useState(false);
  const [riddleOpen, setRiddleOpen] = useState(false);
  const readRef = useRef(false);
  const ritualRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const completeRitual = useCallback(() => {
    setRitualActive(false);
    const isNew = unlockRecord(record.id);
    sfx.unlock();
    addGaze(4);
    if (isNew) {
      pushToast({
        kind: "ach",
        sigil: "🔓",
        title: "ПЕЧАТЬ СНЯТА",
        body: record.name,
      });
    }
  }, [record.id, record.name, unlockRecord, pushToast, addGaze]);

  useEffect(() => {
    if (!ritualActive) return;
    ritualRef.current = setInterval(() => {
      setRitualCharge((c) => {
        if (c >= 100) {
          if (ritualRef.current) clearInterval(ritualRef.current);
          completeRitual();
          return 100;
        }
        return c + 4;
      });
    }, 40);
    return () => {
      if (ritualRef.current) clearInterval(ritualRef.current);
    };
  }, [ritualActive, completeRitual]);

  const startRitual = () => {
    if (ritualCharge >= 100) return;
    setRitualActive(true);
    sfx.whisper();
  };
  const stopRitual = () => {
    if (ritualCharge >= 100) return;
    setRitualActive(false);
    if (ritualCharge > 0) {
      setRitualCharge(0);
      sfx.error();
    }
  };

  const onCollectShard = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!record.shardWord || shardCollected) return;
    const isNew = addShard(record.shardWord);
    if (isNew) {
      addGaze(2);
      sfx.beep();
      pushToast({
        kind: "secret",
        sigil: "🧩",
        title: "ОСКОЛОК ПАМЯТИ",
        body: `Собрано: «${record.shardWord}»`,
      });
    }
  };

  const onRevealSecret = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!record.secretFragment || secretRevealed) return;
    const isNew = revealRecordSecret(record.id);
    if (isNew) {
      addGaze(2);
      sfx.whisper();
      pushToast({
        kind: "secret",
        sigil: "⟁",
        title: "СОКРЫТОЕ ОБНАРУЖЕНО",
        body: record.secretFragment,
      });
    }
  };

  const onOpen = () => {
    // Загадка для записей с загадкой
    if (riddleLocked) {
      sfx.select();
      setRiddleOpen(true);
      return;
    }
    // Открываем модалку ВСЕГДА (даже для запечатанных — там есть ритуал)
    sfx.select();
    setModalOpen(true);
  };

  const corruptedDisplay = censorText(record.description, isCorrupted, false);

  return (
    <>
      <article
        data-record-id={record.id}
        className={`panel clip-hud brackets relative p-4 transition-all duration-200 cursor-pointer hover:border-[var(--green-dim)] hover:shadow-[0_0_16px_rgba(74,246,38,0.15)] ${
          isSealed ? "opacity-90" : ""
        } ${record.name === "???" ? "entity-card" : ""}`}
        onClick={onOpen}
      >
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
          {isSealed && <span className="chip chip-warn">🔒 ОПЕЧАТАНО</span>}
          {isCorrupted && <span className={`chip ${isEntity ? "chip-cyan" : "chip-err"}`}>⚠ ИСКАЖЕНО</span>}
          {!isSealed && !isCorrupted && <span className="chip chip-ok">✓ ДОСТУПНО</span>}
          {record.status === "DEAD" && <span className="chip chip-err">💀 ПАЛ</span>}
          {record.status === "MISSING" && <span className="chip chip-warn">? ПРОПАЛ</span>}
        </div>

        <div className={`flex gap-4 ${horizontal ? "flex-row items-center" : ""}`}>
          <div className="shrink-0">
            {record.imageUrl ? (
              <HoloPortrait
                src={record.imageUrl}
                corrupted={isCorrupted}
                sealed={isSealed}
                status={record.status}
                size={horizontal ? 88 : 72}
                fallbackGlyph={record.sigil}
              />
            ) : (
              <Sigil glyph={record.sigil} corrupted={isCorrupted} size={horizontal ? 72 : 72} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              className={`font-medieval ${horizontal ? "text-xl" : "text-lg"} leading-tight ${
                isEntity ? "glow-cyan glitch" : isCorrupted ? "glow-red glitch" : "glow-green"
              }`}
              data-text={record.name}
            >
              {record.name}
            </h3>
            <div className={`text-xs tracking-wider mt-0.5 mb-2 ${isEntity ? "text-[var(--cyan)] opacity-80" : "text-dim"}`}>
              {record.subtitle}
            </div>

            {riddleLocked ? (
              <div className="panel-inset p-3 text-center">
                <div className="font-vt323 text-lg glow-violet mb-1">
                  [ ДАННЫЕ СОКРЫТЫ ]
                </div>
                <div className="text-dim text-[11px]">
                  {"// разгадай загадку, чтобы открыть досье //"}
                </div>
              </div>
            ) : !isSealed ? (
              <p
                className={`text-[13px] leading-relaxed ${
                  isEntity ? "text-[var(--cyan)]" : isCorrupted ? "text-[var(--red-dim)]" : "text-[var(--text)]"
                } line-clamp-2`}
                dangerouslySetInnerHTML={
                  isCorrupted ? { __html: corruptedDisplay } : undefined
                }
              >
                {isCorrupted ? undefined : record.description}
              </p>
            ) : (
              <div className="text-dim text-[11px] italic">
                {"// данные опечатаны //"}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end mt-3">
          <span className="text-[10px] text-dim tracking-widest hint-caret">
            {isSealed ? "РИТУАЛ" : riddleLocked ? "ЗАГАДКА" : "ОТКРЫТЬ ДОСЬЕ"}
          </span>
        </div>
      </article>

      {modalOpen && typeof document !== "undefined" && createPortal(
        <RecordModal record={record} onClose={() => setModalOpen(false)} />,
        document.body
      )}

      {miniGameOpen && typeof document !== "undefined" && createPortal(
        <BrunoMiniGame onClose={() => setMiniGameOpen(false)} />,
        document.body
      )}

      {riddleOpen && typeof document !== "undefined" && createPortal(
        <RiddleGate
          recordName={record.name}
          onSolved={() => {
            setRiddleOpen(false);
            setModalOpen(true);
          }}
          onCancel={() => setRiddleOpen(false)}
        />,
        document.body
      )}
    </>
  );
}
