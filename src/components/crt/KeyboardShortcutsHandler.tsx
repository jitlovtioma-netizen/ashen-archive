"use client";

import { useEffect } from "react";
import { useArchive, type Section } from "@/lib/store";
import { sfx } from "@/lib/audio";

// Цифровые клавиши 1-8 → быстрый переход по секциям архива
const NUM_TO_SECTION: Record<string, Section> = {
  Digit1: "characters",
  Digit2: "factions",
  Digit3: "lore",
  Digit4: "lore_gods",
  Digit5: "lore_npcs",
  Digit6: "locations",
  Digit7: "chronicles",
  Digit8: "achievements",
};

export function KeyboardShortcutsHandler() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Игнорируем, если фокус в текстовом поле
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Игнорируем модификаторы (Cmd/Ctrl/Alt комбинации — для Command Palette и т.д.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const S = useArchive.getState();

      // Цифры 1-8 → навигация по секциям
      if (NUM_TO_SECTION[e.code]) {
        e.preventDefault();
        const sec = NUM_TO_SECTION[e.code];
        S.setSection(sec);
        sfx.select();
        return;
      }

      // G → сброс gaze (бонус)
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

      // M → emit событие для MiniMap (слушает MiniMap через window event)
      if (e.code === "KeyM") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("ashen:toggle-minimap"));
        sfx.blip();
        return;
      }

      // W → переключение между мирами (DND ↔ PF2E) без logout
      if (e.code === "KeyW" && !e.shiftKey) {
        e.preventDefault();
        sfx.gaze();
        S.switchWorld();
        S.pushToast({
          kind: "info",
          sigil: "⇄",
          title: "МИР ИЗМЕНЁН",
          body: `// переход в ${S.user?.system === "DND" ? "Эларию" : "Голарион"} //`,
        });
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
