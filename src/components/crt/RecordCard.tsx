"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sigil } from "./Sigil";
import { HoloPortrait } from "./HoloPortrait";
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
  horizontal?: boolean; // горизонтальная раскладка: portrait слева, текст справа
}

const GLITCH_CHARS = "█▓▒░▚▞▐▌╳╲╱▀▄";

function censorText(text: string, corrupted: boolean, revealed: boolean) {
  if (!corrupted) return text;
  if (revealed) return text;
  // corrupt ~45% of words
  const words = text.split(/(\s+)/);
  return words
    .map((w) => {
      if (/\s/.test(w) || w.length === 0) return w;
      if (Math.random() > 0.55) return w;
      // replace with glitch blocks of similar length
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
  } = useArchive();

  const isSealed = record.isLocked && !unlockedIds.includes(record.id);
  const isCorrupted = record.isCorrupted;
  const shardCollected = record.shardWord
    ? shards.includes(record.shardWord)
    : false;
  const secretRevealed = revealedSecrets.includes(record.id);

  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [ritualCharge, setRitualCharge] = useState(0);
  const [ritualActive, setRitualActive] = useState(false);
  const readRef = useRef(false);
  const ritualRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // reading gaze (once per session)
  useEffect(() => {
    if (expanded && !readRef.current && !isSealed) {
      readRef.current = true;
      addGaze(2);
    }
  }, [expanded, isSealed, addGaze]);

  // ritual completion (stable via useCallback)
  const completeRitual = useCallback(() => {
    setRitualActive(false);
    const isNew = unlockRecord(record.id);
    sfx.unlock();
    addGaze(4);
    if (isNew) {
      const firstBreach = unlockAchievement("FIRST_BREACH");
      pushToast({
        kind: "ach",
        sigil: "🔓",
        title: "ПЕЧАТЬ СНЯТА",
        body: record.name,
      });
      if (firstBreach) {
        pushToast({
          kind: "ach",
          sigil: "🔓",
          title: "ДОСТИЖЕНИЕ: ПЕРВЫЙ ПРОРЫВ",
          body: "Вы впервые открыли запечатанную запись архива.",
        });
        sfx.achievement();
      }
    }
  }, [record.id, record.name, unlockRecord, unlockAchievement, pushToast, addGaze]);

  // ritual charge loop
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
      // decay
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
      // SHARD_COLLECTOR at 3 shards
      if (shards.length + 1 >= 3) {
        const ach = unlockAchievement("SHARD_COLLECTOR");
        if (ach) {
          pushToast({
            kind: "ach",
            sigil: "🧩",
            title: "ДОСТИЖЕНИЕ: СОБИРАТЕЛЬ ОСКОЛКОВ",
            body: "Собрано 3 осколка памяти.",
          });
          sfx.achievement();
        }
      }
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
    if (isSealed) return;
    sfx.select();
    setModalOpen(true);
  };

  const corruptedDisplay = censorText(record.description, isCorrupted, false);

  return (
    <>
    <article
      className={`panel clip-hud brackets relative p-4 transition-all duration-200 ${
        expanded ? "md:col-span-2 lg:col-span-3" : ""
      } ${isSealed ? "opacity-90" : "hover:border-[var(--green-dim)]"} ${
        horizontal ? "hover:shadow-[0_0_16px_rgba(74,246,38,0.15)] cursor-pointer" : ""
      }`}
      onClick={horizontal ? onOpen : undefined}
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

      <div className={`flex gap-4 ${horizontal ? "flex-row items-center" : ""}`}>
        {/* portrait / sigil */}
        <div className="shrink-0">
          {record.imageUrl ? (
            <HoloPortrait
              src={record.imageUrl}
              corrupted={isCorrupted}
              sealed={isSealed}
              status={record.status}
              size={horizontal ? 88 : 120}
              fallbackGlyph={record.sigil}
            />
          ) : (
            <Sigil
              glyph={record.sigil}
              corrupted={isCorrupted}
              size={horizontal ? 72 : (expanded ? 96 : 72)}
            />
          )}
        </div>

        {/* content */}
        <div className="flex-1 min-w-0">
          <h3
            className={`font-medieval ${horizontal ? "text-xl" : "text-lg"} leading-tight ${
              isCorrupted ? "glow-red glitch" : "glow-green"
            }`}
            data-text={record.name}
          >
            {record.name}
          </h3>
          <div className="text-dim text-xs tracking-wider mt-0.5 mb-2">
            {record.subtitle}
          </div>

          {/* description */}
          {!isSealed ? (
            <p
              className={`text-[13px] leading-relaxed ${
                isCorrupted ? "text-[var(--red-dim)]" : "text-[var(--text)]"
              } ${horizontal ? "line-clamp-2" : "line-clamp-3"}`}
              dangerouslySetInnerHTML={
                isCorrupted
                  ? { __html: corruptedDisplay }
                  : undefined
              }
            >
              {isCorrupted ? undefined : record.description}
            </p>
          ) : (
            <div className="panel-inset p-3 text-center">
              <div className="font-vt323 text-lg glow-amber mb-1">
                [ ДАННЫЕ ОПЕЧАТАНЫ ]
              </div>
              <div className="text-dim text-[11px]">
                {"// для доступа требуется ритуал снятия печати //"}
              </div>
            </div>
          )}


          {/* secret fragment (revealed) */}
          {secretRevealed && record.secretFragment && (
            <div className="mt-3 panel-inset p-2 border-l-2 border-[var(--violet)]">
              <div className="text-[10px] glow-violet tracking-widest mb-1">
                ⟁ СОКРЫТОЕ
              </div>
              <div className="text-[12px] italic text-[var(--text)]">
                {record.secretFragment}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {isSealed ? (
          <button
            className="btn-crt btn-amber clip-hud-sm px-3 py-1.5 text-[11px] relative overflow-hidden"
            onMouseDown={startRitual}
            onMouseUp={stopRitual}
            onMouseLeave={stopRitual}
            onTouchStart={(e) => {
              e.preventDefault();
              startRitual();
            }}
            onTouchEnd={stopRitual}
            aria-label="Снятие печати"
          >
            {ritualActive || ritualCharge > 0 ? (
              <span className="relative z-10">
                РИТУАЛ... {Math.round(ritualCharge)}%
              </span>
            ) : (
              <span>🔑 СНЯТИЕ ПЕЧАТИ</span>
            )}
            {(ritualActive || ritualCharge > 0) && (
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(232,161,58,0.3), rgba(232,161,58,0.1))",
                  width: `${ritualCharge}%`,
                  transition: "width 0.05s linear",
                }}
              />
            )}
          </button>
        ) : (
          <button
            onClick={onOpen}
            className="btn-crt clip-hud-sm px-3 py-1.5 text-[11px]"
          >
            {expanded ? "◂ СВЕРНУТЬ" : "▸ ПОДРОБНЕЕ"}
          </button>
        )}

        {!isSealed && record.shardWord && (
          <button
            onClick={onCollectShard}
            disabled={shardCollected}
            className={`btn-crt clip-hud-sm px-3 py-1.5 text-[11px] ${
              shardCollected ? "opacity-50 cursor-default" : ""
            }`}
          >
            {shardCollected ? "✓ ОСКОЛОК СОБРАН" : "🧩 ОСКОЛОК ПАМЯТИ"}
          </button>
        )}

        {!isSealed && record.secretFragment && !secretRevealed && (
          <button
            onClick={onRevealSecret}
            className="btn-crt btn-amber clip-hud-sm px-3 py-1.5 text-[11px]"
            title="Сокрытое"
          >
            ⟁ ?
          </button>
        )}
      </div>
    </article>

      {modalOpen && (
        <RecordModal record={record} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
