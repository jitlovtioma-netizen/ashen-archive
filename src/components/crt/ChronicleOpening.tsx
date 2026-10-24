"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useArchive } from "@/lib/store";
import { startAudio, sfx } from "@/lib/audio";
import { chronicleOpening } from "@/lib/world";

// ─────────────────────────────────────────────────────────────────────────────
// Вход в «Хронику Эларии» (мир D&D) — вместо загрузочного лога терминала:
// обложка книги → книга раскрывается → Созидатель дописывает вступление
// строка за строкой → страница перелистывается.
// Клик / Enter / пробел — начать, а затем пропустить.
// ─────────────────────────────────────────────────────────────────────────────

type Phase = "cover" | "opening" | "writing" | "turning";

const LINE_MS = 1700;

export function ChronicleOpening() {
  const setBooted = useArchive((s) => s.setBooted);
  const user = useArchive((s) => s.user);
  const [phase, setPhase] = useState<Phase>("cover");
  const [lines, setLines] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const text = chronicleOpening(user?.displayName ?? "странник");

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const finish = useCallback(() => {
    setPhase("turning");
    sfx.page();
    later(() => setBooted(true), 900);
  }, [setBooted]);

  const advance = useCallback(() => {
    if (phase === "cover") {
      startAudio();
      sfx.boot();
      setPhase("opening");
      later(() => setPhase("writing"), 1100);
    } else if (phase === "writing") {
      // нетерпеливый читатель: дописать всё и перелистнуть
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setLines(text.length);
      finish();
    }
  }, [phase, finish, text.length]);

  // строки появляются одна за другой
  useEffect(() => {
    if (phase !== "writing") return;
    if (lines >= text.length) {
      const t = setTimeout(finish, 1400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLines((n) => n + 1);
      sfx.quill();
    }, lines === 0 ? 300 : LINE_MS);
    return () => clearTimeout(t);
  }, [phase, lines, text.length, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div
      className={`tale-boot ${phase === "turning" ? "tale-boot-out" : ""}`}
      onClick={advance}
      role="button"
      aria-label={phase === "cover" ? "Открыть хронику" : "Пропустить вступление"}
    >
      {phase === "cover" || phase === "opening" ? (
        <div className={`tale-cover ${phase === "opening" ? "tale-cover-open" : ""}`}>
          <div className="tale-cover-frame">
            <div className="tale-cover-sigil" aria-hidden>
              ✦
            </div>
            <div className="tale-cover-kicker">Орден Пепельной Длани</div>
            <h1 className="tale-cover-title">Хроники Эларии</h1>
            <div className="tale-cover-sub">записано рукой Созидателя</div>
            <div className="tale-cover-cta">открыть книгу</div>
          </div>
        </div>
      ) : (
        <div className="tale-page">
          <div className="tale-page-head">Вступление</div>
          <div className="tale-page-body">
            {text.slice(0, lines).map((l, i) => (
              <p key={i} className="tale-line">
                {l}
              </p>
            ))}
            {lines < text.length && <span className="tale-quill" aria-hidden>✒</span>}
          </div>
          <div className="tale-page-hint">
            {lines < text.length ? "нажми, чтобы пролистать" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
