"use client";

import { useEffect, useRef } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

/**
 * Следит за состоянием стора и автоматически открывает достижения,
 * когда выполнены их условия.
 *
 * 6 достижений:
 *  - FIRST_BREACH: впервые снять печать
 *  - SEALBREAKER: снять 5 печатей
 *  - SHARD_COLLECTOR: собрать 5 осколков
 *  - CREATOR_GAZE: Взгляд Созидателя ≥ 90% (обрабатывается в GazeController)
 *  - MASTER_KEYS: ввести Konami-код
 *  - BRUNO_SAVIOR: мини-игра Бруно (обрабатывается в BrunoMiniGame)
 */
export function AchievementWatcher() {
  const unlockedIds = useArchive((s) => s.unlockedIds);
  const shards = useArchive((s) => s.shards);
  const konamiUnlocked = useArchive((s) => s.konamiUnlocked);
  const achievements = useArchive((s) => s.achievements);
  const unlockAchievement = useArchive((s) => s.unlockAchievement);
  const pushToast = useArchive((s) => s.pushToast);

  const prev = useRef({
    unlocked: 0,
    shards: 0,
  });

  // FIRST_BREACH — первая снятая печать
  useEffect(() => {
    if (unlockedIds.length >= 1 && !achievements.includes("FIRST_BREACH")) {
      const isNew = unlockAchievement("FIRST_BREACH");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🔓",
          title: "ДОСТИЖЕНИЕ: ПЕРВЫЙ ПРОРЫВ",
          body: "Впервые открыта запечатанная запись.",
        });
      }
    }
  }, [unlockedIds, achievements, unlockAchievement, pushToast]);

  // SEALBREAKER — 5 снятых печатей
  useEffect(() => {
    if (
      unlockedIds.length >= 5 &&
      !achievements.includes("SEALBREAKER") &&
      prev.current.unlocked < 5
    ) {
      const isNew = unlockAchievement("SEALBREAKER");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🔑",
          title: "ДОСТИЖЕНИЕ: СЛОМИТЕЛЬ ПЕЧАТЕЙ",
          body: "Сняты печати с пяти записей.",
        });
      }
    }
    prev.current.unlocked = unlockedIds.length;
  }, [unlockedIds, achievements, unlockAchievement, pushToast]);

  // SHARD_COLLECTOR — 5 осколков
  useEffect(() => {
    if (
      shards.length >= 5 &&
      !achievements.includes("SHARD_COLLECTOR") &&
      prev.current.shards < 5
    ) {
      const isNew = unlockAchievement("SHARD_COLLECTOR");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🧩",
          title: "ДОСТИЖЕНИЕ: СОБИРАТЕЛЬ ОСКОЛКОВ",
          body: "Собрано пять осколков памяти.",
        });
      }
    }
    prev.current.shards = shards.length;
  }, [shards, achievements, unlockAchievement, pushToast]);

  // MASTER_KEYS — Konami-код
  useEffect(() => {
    if (konamiUnlocked && !achievements.includes("MASTER_KEYS")) {
      const isNew = unlockAchievement("MASTER_KEYS");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🎮",
          title: "ДОСТИЖЕНИЕ: МАСТЕР КЛЮЧЕЙ",
          body: "Konami-код принят. Введи его в досье Мартина.",
        });
      }
    }
  }, [konamiUnlocked, achievements, unlockAchievement, pushToast]);

  return null;
}
