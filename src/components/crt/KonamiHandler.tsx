"use client";

import { useEffect, useRef } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

// Используем e.code (физическая клавиша) — не зависит от раскладки.
// На русской раскладке "b" → "и", "a" → "ф", но e.code всегда "KeyB" / "KeyA".
const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
];

export function KonamiHandler() {
  const seq = useRef<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Игнорируем, если фокус в текстовом поле — чтобы не мешать вводу
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const code = e.code;
      const S = useArchive.getState();

      seq.current.push(code);
      if (seq.current.length > KONAMI.length) seq.current.shift();
      if (seq.current.join(",") === KONAMI.join(",")) {
        seq.current = [];
        triggerKonami(S);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}

function triggerKonami(S: ReturnType<typeof useArchive.getState>) {
  // Konami-код: открывает скрытую силу в досье Мартина.
  // Глобальный обработчик — отмечает, что код введён, и показывает табличку.
  if (!S.konamiUnlocked) S.setKonamiUnlocked(true);
  S.addGaze(8);
  sfx.achievement();
  S.pushToast({
    kind: "secret",
    sigil: "🎮",
    title: "КОД ПРИНЯТ",
    body: "Введи его в досье Мартина, чтобы узнать правила игры.",
  });
}
