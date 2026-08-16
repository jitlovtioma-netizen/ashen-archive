"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    solvedRiddles,
    solveRiddle,
  } = useArchive();

  const isSealed = record.isLocked && !unlockedIds.includes(record.id);
  const isCorrupted = record.isCorrupted;
  const shardCollected = record.shardWord
    ? shards.includes(record.shardWord)
    : false;
  const secretRevealed = revealedSecrets.includes(record.id);

  const [ritualCharge, setRitualCharge] = useState(0);
  const [ritualActive, setRitualActive] = useState(false);
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleError, setRiddleError] = useState(false);
  const readRef = useRef(false);
  const ritualRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Загадка для Мартина и Внешнего Плана — показывается перед досье
  const needsMartinRiddle =
    record.name === "Мартин" && !solvedRiddles.includes(record.id);
  const needsOuterPlaneRiddle =
    record.name === "Внешний План" && !solvedRiddles.includes(record.id);
  const needsRiddle = needsMartinRiddle || needsOuterPlaneRiddle;

  // Данные загадок
  const riddleData = needsMartinRiddle
    ? {
        sigil: "🌑",
        title: "МАРТИН",
        subtitle: "// теневой покровитель //",
        riddle: [
          "Он не царь и не король,",
          "Но в игре он главный роль.",
          "Если имя назовёт —",
          "Каждый руки поднесёт.",
          "А без имени приказ",
          "Выполнять нельзя сейчас!",
          "Кто команду отдаёт,",
          "Угадай-ка, в тот же ждёт?",
        ],
        valid: ["саймон говорит", "симон говорит", "саймон", "симон", "саймон говорит.", "симон говорит."],
        achievementCode: "RIDDLE_MARTIN",
        hint: "// разгадай загадку, чтобы открыть досье Мартина //",
      }
    : needsOuterPlaneRiddle
      ? {
          sigil: "🏚",
          title: "ВНЕШНИЙ ПЛАН",
          subtitle: "// измерение · сокрытое //",
          riddle: [
            "Мёртвый мир, где нет веселья,",
            "Куклы-стражи, дом, безделье.",
            "Мика пьёт, чтоб заглушить",
            "То, что страшно пережить.",
            "Но откуда хмель берёт?",
            "В мире, где никто не пьёт?",
            "Тайна скрыта в ней самой —",
            "Где источник хмеля той?",
          ],
          valid: ["волосы", "волос", "из волос", "волосы.", "волос."],
          achievementCode: "RIDDLE_OUTER_PLANE",
          hint: "// разгадай загадку, чтобы открыть досье Внешнего Плана //",
        }
      : null;

  const checkRiddle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!riddleData) return;
    const answer = riddleAnswer.trim().toLowerCase();
    if (riddleData.valid.includes(answer)) {
      solveRiddle(record.id);
      sfx.unlock();
      // Разблокируем соответствующее достижение
      unlockAchievement(riddleData.achievementCode);
      sfx.achievement();
      pushToast({
        kind: "secret",
        sigil: "🎯",
        title: "ЗАГАДКА РАЗГАДАНА",
        body: "Доступ к досье открыт.",
      });
    } else {
      setRiddleError(true);
      sfx.error();
      setTimeout(() => setRiddleError(false), 2000);
    }
  };

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
    // Блокируем скролл body, чтобы модалка оставалась статичной
    // по центру экрана и не "уезжала" при скролле.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const completeRitual = useCallback(() => {
    setRitualActive(false);
    const isNew = unlockRecord(record.id);
    sfx.unlock();
    addGaze(4);
    if (isNew) {
      const firstBreach = unlockAchievement("SECRETS_OPENED");
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
        const ach = unlockAchievement("SECRETS_OPENED");
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

  // Portal: рендерим модалку прямо в document.body, а не внутри скроллимого
  // <main>. Так position: fixed гарантированно работает относительно viewport.
  if (typeof document === "undefined") return null;

  // ─── Специальное досье для «Отражения» — фиолетовый glitch ───
  const isReflection = record.name === "Отражение";

  // ─── Экран загадки (Мартин / Внешний План) ───
  if (needsRiddle && riddleData) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9700] flex items-center justify-center p-4"
        style={{
          background: "rgba(2, 0, 2, 0.9)",
          backdropFilter: "blur(3px)",
        }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Загадка"
      >
        <div
          className="panel clip-hud brackets w-full max-w-lg p-6 fade-in"
          style={{
            boxShadow: "0 0 40px rgba(167, 139, 250, 0.3)",
            animation: "modalIn 0.3s ease-out forwards",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="flex items-center gap-2 mb-4">
            <span className="led led-amber" />
            <span className="text-[10px] text-dim tracking-widest ml-2">
              {"// ПЕЧАТЬ_ЗАГАДКИ //"}
            </span>
            <span className="flex-1" />
            <button
              onClick={onClose}
              className="btn-crt btn-red clip-hud-sm px-2 py-0.5 text-[11px]"
            >
              ✕
            </button>
          </div>

          {/* sigil */}
          <div className="text-center mb-4">
            <div className="text-4xl glow-violet mb-2 pulse-slow">{riddleData.sigil}</div>
            <div className="font-medieval text-xl glow-violet tracking-wider">
              {riddleData.title}
            </div>
            <div className="text-[10px] text-dim tracking-widest mt-1">
              {riddleData.subtitle}
            </div>
          </div>

          {/* riddle text */}
          <div className="panel-inset p-4 mb-4 border-l-2 border-[var(--violet)]">
            <div className="text-[10px] glow-violet tracking-widest mb-2">
              ⟁ ЗАГАДКА
            </div>
            <div className="text-[13px] text-[var(--text)] leading-relaxed italic space-y-1">
              {riddleData.riddle.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>

          {/* input */}
          <form onSubmit={checkRiddle} className="space-y-3">
            <div>
              <label className="block text-[11px] glow-violet tracking-widest mb-1.5">
                {"> ОТВЕТ:"}
              </label>
              <input
                type="text"
                value={riddleAnswer}
                onChange={(e) => setRiddleAnswer(e.target.value)}
                autoFocus
                className={`w-full bg-[var(--bg-deep)] border px-3 py-2 text-sm text-[var(--green)] focus:outline-none transition-all font-mono-crt clip-hud-sm ${
                  riddleError
                    ? "border-[var(--red)] shadow-[0_0_10px_rgba(255,36,36,0.4)] animate-pulse"
                    : "border-[var(--line-bright)] focus:border-[var(--violet)] focus:shadow-[0_0_10px_rgba(167,139,250,0.3)]"
                }`}
                placeholder="впиши ответ..."
                disabled={riddleError}
              />
            </div>

            {riddleError && (
              <div className="text-center glow-red text-sm glitch" data-text="НЕВЕРНО">
                [ НЕВЕРНО — попробуй снова ]
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-crt btn-amber clip-hud-sm flex-1 py-2 text-xs"
              >
                🔑 ОТВЕТИТЬ
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-crt clip-hud-sm px-4 py-2 text-xs"
              >
                ✕ ОТМЕНА
              </button>
            </div>
          </form>

          <div className="text-[9px] text-dim mt-4 text-center tracking-wider">
            {riddleData.hint}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[9700] flex items-center justify-center p-2 sm:p-4 ${isReflection ? "reflection-overlay" : ""}`}
      style={{
        background: isReflection
          ? "rgba(20, 0, 30, 0.9)"
          : "rgba(2, 0, 2, 0.85)",
        backdropFilter: isReflection ? "blur(4px)" : "blur(2px)",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={record.name}
    >
      <div
        className={`panel clip-hud brackets w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden fade-in ${isReflection ? "reflection-panel" : ""}`}
        style={{
          boxShadow: isReflection
            ? "0 0 60px rgba(167, 139, 250, 0.4), 0 0 120px rgba(40, 0, 60, 0.9)"
            : "0 0 60px rgba(74, 246, 38, 0.2), 0 0 120px rgba(0, 0, 0, 0.8)",
          animation: isReflection
            ? "reflectionGlitch 0.15s steps(2) infinite, modalIn 0.3s ease-out forwards"
            : "modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          background: isReflection ? "rgba(15, 0, 25, 0.95)" : undefined,
          border: isReflection ? "1px solid rgba(167, 139, 250, 0.5)" : undefined,
        }}
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
            <div className="md:w-[55%] p-4 sm:p-6 overflow-y-auto crt-scroll border-b md:border-b-0 md:border-r border-[var(--line)]">
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
              {/* Предупреждения для Отражения */}
              {isReflection && (
                <div className="mb-3 text-center space-y-1">
                  <div className="reflection-warning text-lg">ОНА ОБМАНЫВАЕТ!</div>
                  <div className="reflection-warning text-lg">НЕ ВЕРЬ ЕЙ!</div>
                  <div className="reflection-warning text-2xl">БЕГИ!</div>
                </div>
              )}
              {!isSealed ? (
                <p
                  className={`text-[14px] leading-relaxed ${isReflection ? "reflection-text" : "text-[var(--text)]"}`}
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

            {/* RIGHT: holographic portrait (45%) */}
            <div className="md:w-[45%] p-4 sm:p-6 flex flex-col bg-[var(--bg-deep)] min-h-[300px] relative">
              <div className="text-[10px] text-dim tracking-widest mb-3 absolute top-3 left-4 z-30">
                {"// ПРОЕКЦИЯ //"}
              </div>

              <div className="flex-1 flex items-center justify-center w-full min-h-[280px]">
                {record.imageUrl && !isSealed ? (
                  <HoloPortrait
                    src={record.imageUrl}
                    corrupted={isCorrupted}
                    sealed={isSealed}
                    status={record.status}
                    full
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
    </div>,
    document.body
  );
}
