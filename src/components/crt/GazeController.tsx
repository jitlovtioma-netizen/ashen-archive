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
  const pushToast = useArchive((s) => s.pushToast);
  const addGaze = useArchive((s) => s.addGaze);
  const prevGaze = useRef(gaze);

  useEffect(() => {
    const body = document.body;
    LEVELS.forEach((l) => body.classList.remove(l.cls));
    const level = [...LEVELS].reverse().find((l) => gaze >= l.min);
    if (level) body.classList.add(level.cls);

    // crossing 90 → предупреждение об Отражении (но достижение REFLECTION
    // открывается в RecordModal при открытии досье «Отражение»)
    if (gaze >= 90 && prevGaze.current < 90) {
      sfx.gaze();
      pushToast({
        kind: "warn",
        sigil: "🪞",
        title: "ОТРАЖЕНИЕ ЯВИЛОСЬ",
        body: "Взгляд Созидателя достиг 90%. Во «Второстепенных героях» появилась новая запись.",
      });
    }
    // reaching 100 → alert
    if (gaze >= 100 && prevGaze.current < 100) {
      sfx.gaze();
      pushToast({
        kind: "warn",
        sigil: "👁",
        title: "ОН ВИДИТ ТЕБЯ",
        body: "Взгляд Созидателя обратился в полную силу. Беги.",
      });
      // small recoil
      setTimeout(() => addGaze(-15), 1200);
    }
    prevGaze.current = gaze;
  }, [gaze, pushToast, addGaze]);

  return null;
}
