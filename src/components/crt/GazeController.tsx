"use client";

import { useEffect, useRef } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

const LEVELS = [
  { min: 1, cls: "gaze-low" },
  { min: 30, cls: "gaze-med" },
  { min: 60, cls: "gaze-high" },
  { min: 90, cls: "gaze-extreme" },
  { min: 120, cls: "gaze-extreme" },
] as const;

export function GazeController() {
  const gaze = useArchive((s) => s.gaze);
  const unlockAchievement = useArchive((s) => s.unlockAchievement);
  const pushToast = useArchive((s) => s.pushToast);
  const prevGaze = useRef(gaze);

  useEffect(() => {
    const body = document.body;
    LEVELS.forEach((l) => body.classList.remove(l.cls));
    const level = [...LEVELS].reverse().find((l) => gaze >= l.min);
    if (level) body.classList.add(level.cls);

    // crossing 90 → REFLECTION_SEEN
    if (gaze >= 90 && prevGaze.current < 90) {
      const isNew = unlockAchievement("REFLECTION_SEEN");
      sfx.gaze();
      if (isNew) {
        pushToast({
          kind: "ach",
          sigil: "👁",
          title: "ДОСТИЖЕНИЕ: ВЗГЛЯД СОЗИДАТЕЛЯ",
          body: "Взгляд достиг 90%. Он обратил на тебя внимание.",
        });
        sfx.achievement();
      }
    }

    // reaching 100 → alert (но БЕЗ сброса — продолжает расти)
    if (gaze >= 100 && prevGaze.current < 100) {
      sfx.gaze();
      pushToast({
        kind: "warn",
        sigil: "👁",
        title: "ОН ВИДИТ ТЕБЯ",
        body: "Взгляд созидателя обратился в полную силу. Но он не отступает...",
      });
    }

    // reaching 120 → усиление
    if (gaze >= 120 && prevGaze.current < 120) {
      sfx.gaze();
      pushToast({
        kind: "warn",
        sigil: "👁",
        title: "ВЗГЛЯД ПЕРЕПОЛНЕН",
        body: "Ткань реальности рвётся. Ещё немного — и ты будешь стёрт.",
      });
    }

    // reaching 140 → стирание (addGaze в store уже обработает сброс)
    if (gaze >= 140 && prevGaze.current < 140) {
      sfx.glitch();
      pushToast({
        kind: "warn",
        sigil: "👁",
        title: "СТЁРТ",
        body: "Созидатель поглотил твой след. Прогресс уничтожен. Возвращайся через 12 часов.",
      });
    }

    prevGaze.current = gaze;
  }, [gaze, unlockAchievement, pushToast]);

  return null;
}
