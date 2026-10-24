"use client";

import { CHRONICLE, useWorld } from "@/lib/world";

/**
 * Вступление Созидателя к разделу — только в мире D&D («Хроника Эларии»).
 * В CRT-мире ничего не рисует: там остаются хлебные крошки терминала.
 */
export function ChapterIntro({ code }: { code: string }) {
  const world = useWorld();
  const ch = CHRONICLE[code];
  if (world !== "dnd" || !ch) return null;
  return (
    <header className="chapter-intro">
      <div className="chapter-mark">
        <span className="chapter-rule" aria-hidden />
        <span>{ch.chapter}</span>
        <span className="chapter-rule" aria-hidden />
      </div>
      <div className="chapter-heading">{ch.heading}</div>
      <p className="chapter-narration">{ch.narration}</p>
      <div className="chapter-ornament" aria-hidden>
        ✦ ❦ ✦
      </div>
    </header>
  );
}
