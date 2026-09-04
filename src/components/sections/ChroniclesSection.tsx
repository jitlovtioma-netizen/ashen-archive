"use client";

import { useState } from "react";
import { useArchiveData } from "@/lib/useArchiveData";
import type { Chronicle, GameSystem } from "@/lib/types";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { meltText } from "@/lib/melt";

interface SectionProps {
  system: GameSystem;
}

// Форматирование ISO-даты ("2024-03-15") в человекочитаемый вид
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const months = [
    "ЯНВ", "ФЕВ", "МАР", "АПР", "МАЯ", "ИЮН",
    "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК",
  ];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

export function ChroniclesSection({ system }: SectionProps) {
  const { data, loading, error } = useArchiveData<Chronicle>("chronicles", system);
  const gaze = useArchive((s) => s.gaze);
  const unlockRecord = useArchive((s) => s.unlockRecord);
  const unlockedIds = useArchive((s) => s.unlockedIds);
  const pushToast = useArchive((s) => s.pushToast);
  const addShard = useArchive((s) => s.addShard);
  const [expanded, setExpanded] = useState<string | null>(null);

  const records = (data ?? []).slice().sort((a, b) => a.sessionNumber - b.sessionNumber);

  const toggle = (id: string, locked: boolean) => {
    if (locked) {
      const isNew = unlockRecord(id);
      if (isNew) {
        sfx.unlock();
        pushToast({
          kind: "info",
          title: "ПЕЧАТЬ СНЯТА",
          body: "// хроника теперь доступна для чтения //",
          sigil: "📜",
        });
      } else {
        sfx.error();
      }
      return;
    }
    sfx.select();
    setExpanded((cur) => (cur === id ? null : id));
  };

  return (
    <section className="flex flex-col gap-3 h-full">
      <div className="panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; СЕКТОР_{system} &gt;
        </span>
        <span className="text-[11px] glow-green tracking-widest">ЗАПРОС_ХРОНИКИ_ПАРТИИ</span>
        <span className="flex-1" />
        <span className="text-[10px] text-dim hidden sm:inline">
          {`// летопись сессий партии в ${system === "DND" ? "Эларии" : "Голарионе"} //`}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-green-strong tracking-wider">
          Хроники Партии
        </h2>
        <span className="chip chip-ok text-[10px]">
          СЕССИЙ: {records.length}
        </span>
        {gaze >= 60 && (
          <span className="chip chip-warn text-[10px]">
            ⚠ ВЗГЛЯД {Math.round(gaze)}%
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="panel clip-hud p-4 h-24 animate-pulse"
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
            {"// не удалось получить хроники: "}{error}{" //"}
          </div>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="panel clip-hud p-8 text-center">
          <div className="font-vt323 text-xl glow-amber mb-2">
            [ АРХИВ ПУСТ ]
          </div>
          <div className="text-dim text-sm">
            {"// хроники партии ещё не записаны //"}
          </div>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div className="relative pb-2">
          {/* Вертикальная линия timeline */}
          <div
            className="absolute left-[19px] md:left-[27px] top-2 bottom-2 w-[2px] hidden sm:block"
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--green-dim) 8%, var(--green-dim) 92%, transparent)",
              boxShadow: "0 0 6px rgba(74, 246, 38, 0.3)",
            }}
            aria-hidden="true"
          />

          <ol className="flex flex-col gap-3">
            {records.map((c) => {
              const isExpanded = expanded === c.id;
              const isUnlocked = !c.isLocked || unlockedIds.includes(c.id);
              const shardCollected = c.shardWord
                ? useArchive.getState().shards.includes(c.shardWord)
                : false;

              return (
                <li key={c.id} className="relative flex gap-3 md:gap-4">
                  {/* Node — точка на timeline */}
                  <div className="relative z-10 shrink-0 flex items-start pt-3">
                    <button
                      onClick={() => toggle(c.id, c.isLocked && !isUnlocked)}
                      onMouseEnter={() => !c.isLocked || isUnlocked ? sfx.hover() : sfx.error()}
                      aria-label={`Сессия ${c.sessionNumber}: ${c.title}`}
                      className="relative w-10 h-10 md:w-14 md:h-14 flex items-center justify-center clip-hud-sm panel-inset cursor-pointer transition-all"
                      style={{
                        borderColor: c.isCorrupted
                          ? "var(--red-dim)"
                          : isUnlocked
                            ? "var(--green-dim)"
                            : "var(--amber-dim)",
                        boxShadow: isUnlocked
                          ? "0 0 10px rgba(74, 246, 38, 0.25)"
                          : "0 0 8px rgba(232, 161, 58, 0.2)",
                      }}
                    >
                      <span
                        className="font-vt323 text-lg md:text-2xl leading-none"
                        style={{
                          color: c.isCorrupted
                            ? "var(--red)"
                            : isUnlocked
                              ? "var(--green)"
                              : "var(--amber)",
                          textShadow:
                            c.isCorrupted
                              ? "0 0 8px rgba(255,36,36,0.6)"
                              : isUnlocked
                                ? "0 0 8px rgba(74,246,38,0.6)"
                                : "0 0 8px rgba(232,161,58,0.6)",
                        }}
                      >
                        {c.isLocked && !isUnlocked ? "🔒" : c.isCorrupted ? "⚠" : "📜"}
                      </span>
                      {/* session number badge */}
                      <span
                        className="absolute -top-2 -right-2 text-[9px] px-1 leading-tight panel-2 clip-hud-sm"
                        style={{ color: "var(--dim)", borderColor: "var(--line-bright)" }}
                      >
                        #{String(c.sessionNumber).padStart(2, "0")}
                      </span>
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div
                      data-record-id={c.id}
                      className={`panel clip-hud p-3 md:p-4 transition-all ${
                        c.isCorrupted ? "glitch" : ""
                      }`}
                      data-text={c.title}
                      style={{
                        borderColor: c.isCorrupted
                          ? "var(--red-dim)"
                          : isUnlocked
                            ? "var(--line-bright)"
                            : "var(--amber-dim)",
                        opacity: isUnlocked ? 1 : 0.7,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                        <div className="min-w-0 flex-1">
                          {c.isLocked && !isUnlocked ? (
                            <h3 className="font-medieval text-lg tracking-wider glow-amber truncate">
                              ▓▒░ ОПЕЧАТАНО ░▒▓
                            </h3>
                          ) : (
                            <h3
                              className={`font-medieval text-lg md:text-xl tracking-wider truncate ${
                                c.isCorrupted ? "glow-red" : "glow-green-strong"
                              }`}
                            >
                              {c.title}
                            </h3>
                          )}
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-[10px] text-dim tracking-widest">
                              СЕССИЯ #{String(c.sessionNumber).padStart(2, "0")}
                            </span>
                            <span className="text-[10px] text-dim">·</span>
                            <span className="text-[10px] tracking-widest" style={{ color: "var(--green-dim)" }}>
                              {fmtDate(c.date)}
                            </span>
                            {c.isCorrupted && (
                              <span className="chip chip-err text-[9px]">⚠ ИСКАЖЕНО</span>
                            )}
                            {c.shardWord && shardCollected && (
                              <span className="chip chip-violet text-[9px]">🧩 {c.shardWord}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {c.isLocked && !isUnlocked ? (
                        <div className="text-center py-3">
                          <div className="text-[11px] glow-amber tracking-widest mb-1">
                            {"// ПЕЧАТЬ НЕ СНЯТА //"}
                          </div>
                          <div className="text-[10px] text-dim">
                            нажмите на значок, чтобы попытаться снять печать
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`text-sm leading-relaxed ${
                            isExpanded ? "" : "line-clamp-2"
                          }`}
                          style={{
                            color: c.isCorrupted ? "var(--red-dim)" : "var(--text)",
                            opacity: c.isCorrupted ? 0.85 : 1,
                          }}
                        >
                          {c.isCorrupted
                            ? meltText(c.summary, isExpanded ? 5 : 3)
                            : c.summary}
                        </div>
                      )}

                      {isUnlocked && !c.isLocked && (
                        <button
                          onClick={() => {
                            sfx.select();
                            setExpanded((cur) => (cur === c.id ? null : c.id));
                          }}
                          className="mt-2 text-[10px] tracking-widest btn-crt clip-hud-sm px-2 py-1"
                        >
                          {isExpanded ? "◂ СВЕРНУТЬ" : "РАЗВЕРНУТЬ ДОСЬЕ ▸"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
