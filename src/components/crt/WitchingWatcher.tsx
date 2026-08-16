"use client";

import { useEffect, useRef } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

export function WitchingWatcher() {
  const witching = useArchive((s) => s.witching);
  const witchingForcedUntil = useArchive((s) => s.witchingForcedUntil);
  const grantedRef = useRef(false);

  useEffect(() => {
    const check = () => {
      const S = useArchive.getState();
      const now = new Date();
      // MSK = UTC+3. The dev env TZ is Europe/Moscow so local hour === MSK hour.
      const hour = now.getHours();
      const timeBased = hour === 3; // 03:00–03:59
      const forced = Date.now() < S.witchingForcedUntil;
      const active = timeBased || forced;

      if (active && !S.witching) {
        S.setWitching(true);
        document.body.classList.add("witching");
        S.addGaze(15);
        if (!grantedRef.current) {
          grantedRef.current = true;
          const isNew = S.unlockAchievement("WITCHING_HOUR");
          sfx.whisper();
          S.pushToast({
            kind: "secret",
            sigil: "🌙",
            title: "ЧАС ВЕДЬМЫ НАСТАЛ",
            body: "Созидатель смотрит пристальнее. +15% взгляда.",
          });
          if (isNew) {
            S.pushToast({
              kind: "ach",
              sigil: "🌙",
              title: "ДОСТИЖЕНИЕ: ЧАС ВЕДЬМЫ",
              body: "Вы были в архиве в проклятый час.",
            });
            sfx.achievement();
          }
        }
      } else if (!active && S.witching) {
        S.setWitching(false);
        document.body.classList.remove("witching");
        grantedRef.current = false;
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [witching, witchingForcedUntil]);

  return null;
}
