"use client";

import { useEffect } from "react";
import { useArchive, type Section } from "@/lib/store";
import { sfx } from "@/lib/audio";

// Цифровые клавиши 1-7 → быстрый переход по секциям архива
const NUM_TO_SECTION: Record<string, Section> = {
  Digit1: "characters",
  Digit2: "factions",
  Digit3: "lore",
  Digit4: "lore_gods",
  Digit5: "lore_npcs",
  Digit6: "locations",
  Digit7: "achievements",
};

export function KeyboardShortcutsHandler() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const S = useArchive.getState();

      if (NUM_TO_SECTION[e.code]) {
        e.preventDefault();
        S.setSection(NUM_TO_SECTION[e.code]);
        sfx.select();
        return;
      }

      // G → сброс gaze
      if (e.code === "KeyG" && !e.shiftKey) {
        e.preventDefault();
        S.resetGaze();
        sfx.error();
        S.pushToast({
          kind: "warn",
          sigil: "👁",
          title: "ВЗГЛЯД СБРОШЕН",
          body: "// созидатель снова дремлет //",
        });
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
