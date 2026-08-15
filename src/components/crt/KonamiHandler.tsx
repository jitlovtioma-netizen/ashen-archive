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
  const word = useRef<string>("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const S = useArchive.getState();

      // konami sequence
      seq.current.push(k);
      if (seq.current.length > KONAMI.length) seq.current.shift();
      if (seq.current.join(",") === KONAMI.join(",")) {
        seq.current = [];
        triggerKonami(S);
        return;
      }

      // word catcher
      if (/^[a-z]$/.test(k)) {
        word.current = (word.current + k).slice(-12);
        const w = word.current;
        if (w.endsWith("witch")) {
          word.current = "";
          S.forceWitching(90000);
          S.pushToast({
            kind: "secret",
            sigil: "🌙",
            title: "ПРОБУЖДЕНИЕ ЧАСА ВЕДЬМЫ",
            body: "Бог смотрит пристальнее. На 90 секунд.",
          });
          sfx.whisper();
        } else if (w.endsWith("gaze")) {
          word.current = "";
          S.addGaze(20);
          S.pushToast({
            kind: "warn",
            sigil: "👁",
            title: "ВЗГЛЯД УСИЛЕН",
            body: "+20% взгляда бога.",
          });
          sfx.gaze();
        } else if (w.endsWith("reset")) {
          word.current = "";
          S.resetGaze();
          // clear gaze body classes
          document.body.classList.remove(
            "gaze-low",
            "gaze-med",
            "gaze-high",
            "gaze-extreme"
          );
          S.pushToast({
            kind: "info",
            sigil: "✦",
            title: "ВЗГЛЯД СБРОШЕН",
            body: "Бог вновь задремал.",
          });
          sfx.blip();
        } else if (w.endsWith("ash")) {
          word.current = "";
          const isNew = S.unlockAchievement("ARCHIVIST");
          S.pushToast({
            kind: "ach",
            sigil: "📖",
            title: "ДОСТИЖЕНИЕ: АРХИВАРИУС",
            body: "Ты произнёс истинное слово пепла.",
          });
          if (isNew) sfx.achievement();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}

function triggerKonami(S: ReturnType<typeof useArchive.getState>) {
  if (!S.konamiUnlocked) S.setKonamiUnlocked(true);
  if (!S.secretRevealed) S.revealSecret();
  const isNew = S.unlockAchievement("MASTER_KEYS");
  S.addGaze(8);
  S.forceWitching(60000);
  sfx.achievement();
  S.pushToast({
    kind: "secret",
    sigil: "👁",
    title: "СОКРЫТАЯ ИСТИНА ОТКРЫТА",
    body: "Древний код пробудил память. Бог знает твоё имя.",
  });
  if (!isNew) {
    S.pushToast({
      kind: "info",
      sigil: "✦",
      title: "КОД УЖЕ ИЗВЕСТЕН",
      body: "Но истина не меркнет от повторения.",
    });
  }
}
