"use client";

import { useEffect } from "react";
import { useArchive, type Section } from "@/lib/store";
import { sfx } from "@/lib/audio";

// Цифровые клавиши 1-7 → быстрый переход по секциям архива
// (порядок как в сайдбаре: профиль → … → локации).
// 0 → МАСТЕРСКАЯ Созидателя (только для админов).
const NUM_TO_SECTION: Record<string, Section> = {
  Digit1: "profile",
  Digit2: "characters",
  Digit3: "factions",
  Digit4: "lore",
  Digit5: "lore_gods",
  Digit6: "lore_npcs",
  Digit7: "locations",
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

      // 0 → Мастерская Созидателя — только для Длани (админов)
      if (e.code === "Digit0") {
        e.preventDefault();
        if (!S.user || S.user.role !== "ADMIN") {
          sfx.error();
          S.pushToast({
            kind: "warn",
            sigil: "🚫",
            title: "ПУТЬ ЗАПЕЧАТАН",
            body: "// мастерская открыта только Длани //",
          });
          return;
        }
        S.setSection("admin");
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

      // W → переключить мир (DND ↔ PF2E) без logout — ТОЛЬКО ДЛЯ АДМИНОВ.
      // Игроки Эларии не должны видеть Голарион и наоборот.
      if (e.code === "KeyW" && !e.shiftKey) {
        e.preventDefault();
        if (!S.user) return;
        if (S.user.role !== "ADMIN") {
          // загадочный отказ: не раскрываем, что скрывается за клавишей
          sfx.error();
          S.pushToast({
            kind: "warn",
            sigil: "🚫",
            title: "ПУТЬ ЗАПЕЧАТАН",
            body: "// некоторые двери открывает только Длань //",
          });
          return;
        }
        S.switchWorld();
        sfx.glitch();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
