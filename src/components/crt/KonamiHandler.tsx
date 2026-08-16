"use client";

import { useEffect, useRef } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export function KonamiHandler() {
  const seq = useRef<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const S = useArchive.getState();

      // konami sequence — только для Мартина (открывает скрытую силу)
      seq.current.push(k);
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
  // Konami-код активируется только в досье Мартина (через RecordModal)
  // Здесь — глобальный обработчик. Он не делает Час Ведьмы.
  // Просто отмечаем, что код введён.
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
