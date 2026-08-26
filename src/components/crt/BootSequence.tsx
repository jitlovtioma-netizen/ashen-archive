"use client";

import { useEffect, useRef, useState } from "react";
import { useArchive } from "@/lib/store";
import { startAudio, sfx } from "@/lib/audio";
import { SYSTEM_WORLD, SYSTEM_SHORT, type GameSystem } from "@/lib/types";

function bootLines(system: GameSystem) {
  const world = SYSTEM_WORLD[system];
  if (system === "DND") {
    // Зловещая демоническая загрузка для DND
    return [
      { tag: "FAIL" as const, text: "ДЕМОН ИЗ АДА ПРОРВАЛСЯ", tail: "КРИТИЧНО" },
      { tag: "WARN" as const, text: "ИМПЕРИЯ ЭЙРИОС АТАКОВАНА", tail: "ПАДАЕТ" },
      { tag: "FAIL" as const, text: "ДРЕВО ИГДРАСИЛЬ ГОРИТ", tail: "ОГНЬ" },
      { tag: "WARN" as const, text: "АВТОРИЗАЦИЯ СТРАЖА", tail: "ПОВРЕЖДЕНА" },
      { tag: "OK" as const, text: `ПОДКЛЮЧЕНИЕ К АРХИВУ ${world.toUpperCase()}`, tail: "ГОТОВО" },
      { tag: "WARN" as const, text: "ПЕЧАТЬ СТРАЖА", tail: "ТРЕЩИТ" },
      { tag: "OK" as const, text: "ЗАГРУЗКА ФРАКЦИЙ", tail: "5/7" },
      { tag: "FAIL" as const, text: "ФРАКЦИЯ ЭЙРИОС НЕ ОТВЕЧАЕТ", tail: "ПОТЕРЯНА" },
      { tag: "OK" as const, text: "ЗАГРУЗКА ГЕРОЕВ", tail: "5/6" },
      { tag: "FAIL" as const, text: "ГЕРОЙ РАУДОН ПАЛ", tail: "МЁРТВ" },
      { tag: "WARN" as const, text: "ОБНАРУЖЕНО ИСКАЖЕНИЙ", tail: "∞" },
      { tag: "FAIL" as const, text: "ДЕМОНЫ В АРХИВЕ", tail: "ВНУТРИ" },
      { tag: "WARN" as const, text: "ВЗГЛЯД СОЗИДАТЕЛЯ", tail: "ПАДАЕТ" },
      { tag: "OK" as const, text: "ВХОД В АРХИВ", tail: "...ВОЗМОЖЕН" },
    ];
  }
  // Обычная загрузка для PF2E
  return [
    { tag: "OK" as const, text: "ИНИЦИАЛИЗАЦИЯ ЯДРА", tail: "ГОТОВО" },
    { tag: "OK" as const, text: "АВТОРИЗАЦИЯ СТРАЖА", tail: "ОК" },
    { tag: "OK" as const, text: `ПОДКЛЮЧЕНИЕ К АРХИВУ ${world.toUpperCase()}`, tail: "ГОТОВО" },
    { tag: "WARN" as const, text: "ПЕЧАТЬ СТРАЖА", tail: "ЧАСТИЧНО" },
    { tag: "OK" as const, text: "ЗАГРУЗКА ФРАКЦИЙ", tail: "7/7" },
    { tag: "OK" as const, text: "ЗАГРУЗКА ГЕРОЕВ", tail: "5/5" },
    { tag: "OK" as const, text: "ЗАГРУЗКА ЛОРА", tail: "8/8" },
    { tag: "WARN" as const, text: "ОБНАРУЖЕНО ИСКАЖЕНИЙ", tail: "4" },
    { tag: "OK" as const, text: "ВЗГЛЯД СОЗИДАТЕЛЯ", tail: "7%" },
    { tag: "FAIL" as const, text: "УТЕЧКА ИЗ РАЗЛОМА", tail: "ОБНАРУЖЕНА" },
    { tag: "OK" as const, text: "ВХОД В АРХИВ", tail: "РАЗРЕШЁН" },
  ];
}

type Phase = "gate" | "flash" | "log" | "done";

export function BootSequence() {
  const booted = useArchive((s) => s.booted);
  const setBooted = useArchive((s) => s.setBooted);
  const user = useArchive((s) => s.user);
  const [phase, setPhase] = useState<Phase>("gate");
  const [visibleLines, setVisibleLines] = useState(0);
  const startedRef = useRef(false);

  const system = user?.system ?? "DND";
  const BOOT = bootLines(system);

  const beginBoot = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    startAudio();
    sfx.boot();
    setPhase("flash");
    setTimeout(() => setPhase("log"), 220);
  };

  useEffect(() => {
    if (phase !== "gate") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        beginBoot();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => {
    if (phase !== "log") return;
    if (visibleLines >= BOOT.length) {
      const t = setTimeout(() => {
        setBooted(true);
        setPhase("done");
      }, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setVisibleLines((v) => v + 1);
      sfx.beep();
    }, 230);
    return () => clearTimeout(t);
  }, [phase, visibleLines, BOOT.length]);

  if (booted || phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020202]"
      onClick={phase === "gate" ? beginBoot : undefined}
      role={phase === "gate" ? "button" : undefined}
      aria-label="Вход в архив"
    >
      {phase === "flash" && <div className="absolute inset-0 boot-flash" />}
      {phase === "flash" && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="boot-sweep" />
        </div>
      )}

      {phase === "gate" && (
        <div className="text-center px-6 fade-in cursor-pointer">
          {system === "DND" ? (
            <>
              <div className="font-medieval text-3xl sm:text-5xl glow-red mb-3 tracking-widest glitch" data-text={SYSTEM_WORLD[system].toUpperCase()}>
                {SYSTEM_WORLD[system].toUpperCase()}
              </div>
              <div className="text-[11px] sm:text-sm tracking-[0.3em] mb-2" style={{ color: "var(--red)" }}>
                {"// ДЕМОНИЧЕСКОЕ ВТОРЖЕНИЕ //"}
              </div>
              <div className="text-[11px] tracking-[0.25em] mb-10" style={{ color: "var(--red)" }}>
                {"СЕКТОР: "}{SYSTEM_SHORT[system]}{" // СТРАЖ: "}{user?.displayName ?? "---"}
              </div>
              <div className="font-vt323 text-2xl glow-red hint-caret pulse-slow">
                ВОЙДИ... ЕСЛИ СМЕЕШЬ
              </div>
              <div className="text-[10px] mt-6 max-w-md mx-auto leading-relaxed" style={{ color: "var(--red-dim)" }}>
                {"// демоны из ада прорвались. эйриос пылает. игдрасиль горит. //"}
              </div>
            </>
          ) : (
            <>
              <div className="font-medieval text-3xl sm:text-5xl glow-green-strong mb-3 tracking-widest">
                {SYSTEM_WORLD[system].toUpperCase()}
              </div>
              <div className="text-dim text-xs sm:text-sm tracking-[0.3em] mb-2">
                {"// АРХИВ ОРДЕНА ПЕПЕЛЬНОЙ ДЛАНИ //"}
              </div>
              <div className="text-[11px] tracking-[0.25em] mb-10" style={{ color: "var(--cyan)" }}>
                {"СЕКТОР: "}{SYSTEM_SHORT[system]}{" // СТРАЖ: "}{user?.displayName ?? "---"}
              </div>
              <div className="font-vt323 text-2xl glow-green hint-caret pulse-slow">
                НАЖМИТЕ ДЛЯ ВХОДА
              </div>
              <div className="text-dim text-[10px] mt-6 max-w-md mx-auto leading-relaxed">
                {"// бог человечества Ароден мёртв. пророчества утрачены. мир трещит. //"}
              </div>
            </>
          )}
        </div>
      )}

      {phase === "log" && (
        <div className="w-full max-w-2xl px-6">
          <div className="font-vt323 text-xl glow-green mb-4 tracking-wider">
            ЗАГРУЗКА АРХИВНОЙ ОБОЛОЧКИ v4.1
          </div>
          <div className="font-mono-crt text-[13px] space-y-1 min-h-[260px]">
            {BOOT.slice(0, visibleLines).map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className={
                    l.tag === "OK"
                      ? "glow-green"
                      : l.tag === "WARN"
                        ? "glow-amber"
                        : "glow-red"
                  }
                >
                  [{l.tag.padEnd(4)}]
                </span>
                <span className="text-dim">{l.text}</span>
                <span className="flex-1 text-dim opacity-40">
                  {".".repeat(Math.max(2, 40 - l.text.length))}
                </span>
                <span
                  className={
                    l.tag === "OK"
                      ? "glow-green"
                      : l.tag === "WARN"
                        ? "glow-amber"
                        : "glow-red"
                  }
                >
                  {l.tail}
                </span>
              </div>
            ))}
            {visibleLines < BOOT.length && <span className="boot-cursor" />}
          </div>
          <div className="boot-bar mt-6">
            <div
              className="boot-bar-fill"
              style={{
                width: `${(visibleLines / BOOT.length) * 100}%`,
                transition: "width 0.2s ease",
                animation: "none",
              }}
            />
          </div>
          <div className="text-dim text-[11px] mt-2 tracking-widest">
            ПРОГРЕСС: {Math.round((visibleLines / BOOT.length) * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}
