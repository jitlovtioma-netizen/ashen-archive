"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HoloPortrait } from "./HoloPortrait";
import { Sigil } from "./Sigil";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { SYSTEM_LABEL, SYSTEM_COLOR } from "@/lib/types";
import type { CardRecord } from "./RecordCard";

const GLITCH_CHARS = "█▓▒░▚▞▐▌╳╲╱▀▄";

function censorText(text: string) {
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

interface RecordModalProps {
  record: CardRecord;
  onClose: () => void;
}

export function RecordModal({ record, onClose }: RecordModalProps) {
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

  const [ritualCharge, setRitualCharge] = useState(0);
  const [ritualActive, setRitualActive] = useState(false);
  const readRef = useRef(false);
  const ritualRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!readRef.current && !isSealed) {
      readRef.current = true;
      addGaze(2);
    }
  }, [isSealed, addGaze]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sfx.blip();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    // Сохраняем позицию скролла и фиксируем body, чтобы модалка
    // центрировалась в видимой области без прыжка наверх.
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    return () => {
      window.removeEventListener("keydown", onKey);
      // Восстанавливаем позицию скролла
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

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

  const corruptedDisplay = censorText(record.description);

  return (
    <div
      className="fixed inset-0 z-[9700] flex items-center justify-center p-2 sm:p-4 modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={record.name}
    >
      <div
        className="modal-panel panel clip-hud brackets w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden fade-in"
        onClick={(e) => e.stopPropagation()}
      >
          {/* header bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--line-bright)] shrink-0 bg-[var(--panel-2)]">
            <span className="led led-red" />
            <span className="led led-amber" />
            <span className="led led-green" />
            <span className="text-[10px] text-dim tracking-widest ml-2 truncate">
              {"// ПРОТОКОЛ_ДОСЬЕ // "}
              <span className="glow-green">{record.name}</span>
            </span>
            <span className="flex-1" />
            <button
              onClick={onClose}
              className="btn-crt btn-red clip-hud-sm px-2 py-0.5 text-[11px]"
              aria-label="Закрыть"
            >
              ✕ ЗАКРЫТЬ
            </button>
          </div>

          {/* body: two columns */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto crt-scroll">
            {/* LEFT: text information (60%) */}
            <div className="md:w-3/5 p-4 sm:p-6 overflow-y-auto crt-scroll border-b md:border-b-0 md:border-r border-[var(--line)]">
              <div className="mb-4">
                <h2
                  className={`font-medieval text-2xl sm:text-3xl leading-tight mb-1 ${
                    isCorrupted ? "glow-red glitch" : "glow-green"
                  }`}
                  data-text={record.name}
                >
                  {record.name}
                </h2>
                <div className="text-dim text-sm tracking-wider">
                  {record.subtitle}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
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
                {isCorrupted && <span className="chip chip-err">⚠ ИСКАЖЕНО</span>}
                {!isSealed && !isCorrupted && (
                  <span className="chip chip-ok">✓ ДОСТУПНО</span>
                )}
                {record.status === "DEAD" && (
                  <span className="chip chip-err">💀 ПАЛ</span>
                )}
                {record.status === "MISSING" && (
                  <span className="chip chip-warn">? ПРОПАЛ</span>
                )}
              </div>

              <div className="divider-glow mb-3" />
              <div className="text-[10px] text-dim tracking-widest mb-2">
                {"// ОПИСАНИЕ //"}
              </div>
              {!isSealed ? (
                <p
                  className="text-[14px] leading-relaxed text-[var(--text)]"
                  dangerouslySetInnerHTML={
                    isCorrupted ? { __html: corruptedDisplay } : undefined
                  }
                >
                  {isCorrupted ? undefined : record.description}
                </p>
              ) : (
                <div className="panel-inset p-4 text-center">
                  <div className="font-vt323 text-xl glow-amber mb-1">
                    [ ДАННЫЕ ОПЕЧАТАНЫ ]
                  </div>
                  <div className="text-dim text-xs">
                    {"// для доступа требуется ритуал снятия печати //"}
                  </div>
                </div>
              )}

              {secretRevealed && record.secretFragment && (
                <div className="mt-4 panel-inset p-3 border-l-2 border-[var(--violet)]">
                  <div className="text-[10px] glow-violet tracking-widest mb-1">
                    ⟁ СОКРЫТОЕ
                  </div>
                  <div className="text-[13px] italic text-[var(--text)] leading-relaxed">
                    {record.secretFragment}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-5 flex-wrap">
                {isSealed ? (
                  <button
                    className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs relative overflow-hidden"
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
                    onClick={onClose}
                    className="btn-crt clip-hud-sm px-4 py-2 text-xs"
                  >
                    ◂ ЗАКРЫТЬ ДОСЬЕ
                  </button>
                )}

                {!isSealed && record.shardWord && (
                  <button
                    onClick={onCollectShard}
                    disabled={shardCollected}
                    className={`btn-crt clip-hud-sm px-4 py-2 text-xs ${
                      shardCollected ? "opacity-50 cursor-default" : ""
                    }`}
                  >
                    {shardCollected ? "✓ ОСКОЛОК СОБРАН" : "🧩 ОСКОЛОК ПАМЯТИ"}
                  </button>
                )}

                {!isSealed && record.secretFragment && !secretRevealed && (
                  <button
                    onClick={onRevealSecret}
                    className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs"
                  >
                    ⟁ РАСКРЫТЬ СОКРЫТОЕ
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT: holographic portrait (40%) */}
            <div className="md:w-2/5 p-4 sm:p-6 flex flex-col items-center justify-center bg-[var(--bg-deep)] min-h-[280px] relative">
              <div className="text-[10px] text-dim tracking-widest mb-4 absolute top-3 left-4">
                {"// ПРОЕКЦИЯ //"}
              </div>

              <div className="flex-1 flex items-center justify-center w-full">
                {record.imageUrl && !isSealed ? (
                  <HoloPortrait
                    src={record.imageUrl}
                    corrupted={isCorrupted}
                    sealed={isSealed}
                    status={record.status}
                    size={260}
                    fallbackGlyph={record.sigil}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Sigil
                      glyph={record.sigil}
                      corrupted={isCorrupted}
                      size={180}
                    />
                    {isSealed && (
                      <div className="text-center">
                        <div className="font-vt323 text-xl glow-amber">
                          [ ПЕЧАТЬ ]
                        </div>
                        <div className="text-dim text-[10px] tracking-wider mt-1">
                          {"// проекция недоступна //"}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 w-full panel-inset p-2 text-[9px] text-dim tracking-wider">
                <div className="flex justify-between">
                  <span>SIGIL</span>
                  <span className="glow-green">{record.sigil}</span>
                </div>
                <div className="flex justify-between">
                  <span>MAP_X</span>
                  <span>{record.mapX}</span>
                </div>
                <div className="flex justify-between">
                  <span>MAP_Y</span>
                  <span>{record.mapY}</span>
                </div>
                <div className="flex justify-between">
                  <span>STATUS</span>
                  <span
                    className={
                      record.status === "DEAD"
                        ? "glow-red"
                        : record.status === "MISSING"
                          ? "glow-amber"
                          : "glow-green"
                    }
                  >
                    {record.status ?? "ALIVE"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
