"use client";

import { useEffect, useRef } from "react";
import { useArchive, CARTOGRAPHER_SECTIONS } from "@/lib/store";
import { sfx } from "@/lib/audio";

/**
 * Следит за состоянием стора и автоматически открывает достижения,
 * когда выполнены их условия.
 *
 * Список:
 *  - FIRST_BREACH: впервые открыть запечатанную запись (modal открыт для sealed)
 *  - ARCHIVIST: прочитать 10 уникальных записей
 *  - SEALBREAKER: снять печати с 5 записей
 *  - SHARD_COLLECTOR: собрать 5 осколков
 *  - CARTOGRAPHER: посетить все 6 контентных секций
 *  - MASTER_KEYS: ввести Konami-код
 *  - EYE_OF_GOD: взгляд бога ≥ 90% (обрабатывается в GazeController)
 *  - BRUNO_SAVIOR: мини-игра Бруно (обрабатывается в BrunoMiniGame)
 */
export function AchievementWatcher() {
  const unlockedIds = useArchive((s) => s.unlockedIds);
  const shards = useArchive((s) => s.shards);
  const konamiUnlocked = useArchive((s) => s.konamiUnlocked);
  const readRecordIds = useArchive((s) => s.readRecordIds);
  const visitedSections = useArchive((s) => s.visitedSections);
  const achievements = useArchive((s) => s.achievements);
  const unlockAchievement = useArchive((s) => s.unlockAchievement);
  const pushToast = useArchive((s) => s.pushToast);

  // Рефы чтобы не выдавать тост повторно при монтировании
  const prev = useRef({
    unlocked: 0,
    shards: 0,
    reads: 0,
    sections: 0,
  });

  // FIRST_BREACH — первая открытая (unsealed) запись
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

  // ARCHIVIST — 10 прочитанных записей
  useEffect(() => {
    if (
      readRecordIds.length >= 10 &&
      !achievements.includes("ARCHIVIST") &&
      prev.current.reads < 10
    ) {
      const isNew = unlockAchievement("ARCHIVIST");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "📖",
          title: "ДОСТИЖЕНИЕ: АРХИВАРИУС",
          body: "Прочитано десять записей без перерыва.",
        });
      }
    }
    prev.current.reads = readRecordIds.length;
  }, [readRecordIds, achievements, unlockAchievement, pushToast]);

  // CARTOGRAPHER — посетить все 6 контентных секций
  useEffect(() => {
    const required = CARTOGRAPHER_SECTIONS.length;
    const visitedCount = CARTOGRAPHER_SECTIONS.filter((s) =>
      visitedSections.includes(s)
    ).length;
    if (
      visitedCount >= required &&
      !achievements.includes("CARTOGRAPHER") &&
      prev.current.sections < required
    ) {
      const isNew = unlockAchievement("CARTOGRAPHER");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🗺",
          title: "ДОСТИЖЕНИЕ: КАРТОГРАФ",
          body: "Посещены все секции архива.",
        });
      }
    }
    prev.current.sections = visitedCount;
  }, [visitedSections, achievements, unlockAchievement, pushToast]);

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
