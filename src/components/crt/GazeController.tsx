"use client";

import { useEffect, useRef } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

const LEVELS = [
  { min: 1, cls: "gaze-low" },
  { min: 30, cls: "gaze-med" },
  { min: 60, cls: "gaze-high" },
  { min: 90, cls: "gaze-extreme" },
] as const;

export function GazeController() {
  const gaze = useArchive((s) => s.gaze);
  const unlockAchievement = useArchive((s) => s.unlockAchievement);
  const pushToast = useArchive((s) => s.pushToast);
  const addGaze = useArchive((s) => s.addGaze);
  const prevGaze = useRef(gaze);

  useEffect(() => {
    const body = document.body;
    LEVELS.forEach((l) => body.classList.remove(l.cls));
    const level = [...LEVELS].reverse().find((l) => gaze >= l.min);
    if (level) body.classList.add(level.cls);

    // crossing 90 → EYE_OF_GOD
    if (gaze >= 90 && prevGaze.current < 90) {
      const isNew = unlockAchievement("EYE_OF_GOD");
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
    // reaching 100 → alert
    if (gaze >= 100 && prevGaze.current < 100) {
      sfx.gaze();
      pushToast({
        kind: "warn",
        sigil: "👁",
        title: "ОН ВИДИТ ТЕБЯ",
        body: "Взгляд созидателя обратился в полную силу. Беги.",
      });
      // small recoil
      setTimeout(() => addGaze(-15), 1200);
    }
    prevGaze.current = gaze;
  }, [gaze, unlockAchievement, pushToast, addGaze]);

  return null;
}
