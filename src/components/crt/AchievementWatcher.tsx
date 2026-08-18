"use client";

import { useEffect } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

/**
 * Следит за состоянием стора и автоматически открывает достижения,
 * когда выполнены их условия.
 *
 * 6 достижений:
 *  - REFLECTION: открыть «Отражение» (обрабатывается в RecordModal)
 *  - DEMON_WIFE: разгадать загадку Четвёртого (solvedRiddles includes "Четвёртый")
 *  - MASTER_KEYS: ввести Konami-код (обрабатывается в KonamiHandler + RecordModal Мартина)
 *  - DEAD_PLAN: разгадать загадку Мёртвого Плана
 *  - BRUNO_SAVIOR: мини-игра Бруно (обрабатывается в BrunoMiniGame)
 *  - MARTIN_RIDDLE: разгадать загадку Мартина (Саймон говорит)
 */
export function AchievementWatcher() {
  const solvedRiddles = useArchive((s) => s.solvedRiddles);
  const konamiUnlocked = useArchive((s) => s.konamiUnlocked);
  const achievements = useArchive((s) => s.achievements);
  const unlockAchievement = useArchive((s) => s.unlockAchievement);
  const pushToast = useArchive((s) => s.pushToast);

  // DEMON_WIFE — разгадать загадку Четвёртого
  useEffect(() => {
    if (
      solvedRiddles.includes("Четвёртый") &&
      !achievements.includes("DEMON_WIFE")
    ) {
      const isNew = unlockAchievement("DEMON_WIFE");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "😈",
          title: "ДОСТИЖЕНИЕ: ЖЕНА ДЕМОНА",
          body: "Ты назвал имя жены Четвёртого — Ехидну. Предатель открыт.",
        });
      }
    }
  }, [solvedRiddles, achievements, unlockAchievement, pushToast]);

  // DEAD_PLAN — разгадать загадку Мёртвого Плана
  useEffect(() => {
    if (
      solvedRiddles.includes("Мёртвый План") &&
      !achievements.includes("DEAD_PLAN")
    ) {
      const isNew = unlockAchievement("DEAD_PLAN");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🏚",
          title: "ДОСТИЖЕНИЕ: МЁРТВЫЙ ПЛАН",
          body: "Ты назвал источник хмеля — волосы. Доступ открыт.",
        });
      }
    }
  }, [solvedRiddles, achievements, unlockAchievement, pushToast]);

  // MARTIN_RIDDLE — разгадать загадку Мартина (Саймон говорит)
  useEffect(() => {
    if (
      solvedRiddles.includes("Мартин") &&
      !achievements.includes("MARTIN_RIDDLE")
    ) {
      const isNew = unlockAchievement("MARTIN_RIDDLE");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🌑",
          title: "ДОСТИЖЕНИЕ: САЙМОН ГОВОРИТ",
          body: "Ты понял правило игры Мартина. Команда отдаётся только по «Саймон говорит».",
        });
      }
    }
  }, [solvedRiddles, achievements, unlockAchievement, pushToast]);

  // MASTER_KEYS — Konami-код (если не открыт в досье Мартина, открываем при глобальном вводе)
  useEffect(() => {
    if (konamiUnlocked && !achievements.includes("MASTER_KEYS")) {
      const isNew = unlockAchievement("MASTER_KEYS");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🎮",
          title: "ДОСТИЖЕНИЕ: МАСТЕР КЛЮЧЕЙ",
          body: "Konami-код принят. Введи его в досье Мартина, чтобы узнать скрытую силу.",
        });
      }
    }
  }, [konamiUnlocked, achievements, unlockAchievement, pushToast]);

  // TARTUCCIO_RIDDLE — разгадать загадку Тартуччио (PF2E)
  useEffect(() => {
    if (
      solvedRiddles.includes("Тартуччио") &&
      !achievements.includes("TARTUCCIO_RIDDLE")
    ) {
      const isNew = unlockAchievement("TARTUCCIO_RIDDLE");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🎪",
          title: "ДОСТИЖЕНИЕ: СТОИТ НАД ВСЕМИ НАРОДАМИ",
          body: "Ты разгадал загадку Тартуччио — гордыня падает больно и глубоко.",
        });
      }
    }
  }, [solvedRiddles, achievements, unlockAchievement, pushToast]);

  return null;
}
