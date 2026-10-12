"use client";

import { useEffect } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { useRiddles } from "@/lib/useRiddles";
import type { Achievement } from "@/lib/types";

/** Кэш реестра достижений (имена/сигилы для тостов) — один запрос на страницу. */
let achRegistry: Achievement[] | null = null;
let achInflight: Promise<Achievement[]> | null = null;

function requestAchievements(): Promise<Achievement[]> {
  if (!achRegistry) {
    if (!achInflight) {
      achInflight = fetch("/api/achievements")
        .then((r) => (r.ok ? (r.json() as Promise<Achievement[]>) : []))
        .catch(() => [] as Achievement[])
        .then((list) => {
          achRegistry = list;
          achInflight = null;
          return list;
        });
    }
    return achInflight;
  }
  return Promise.resolve(achRegistry);
}

/**
 * Следит за состоянием стора и автоматически открывает достижения,
 * когда выполнены их условия.
 *
 * Вшитые достижения (страховка, работают без БД):
 *  - REFLECTION: открыть «Отражение» (обрабатывается в RecordModal)
 *  - DEMON_WIFE: разгадать загадку Четвёртого (solvedRiddles includes "Четвёртый")
 *  - MASTER_KEYS: ввести Konami-код (обрабатывается в KonamiHandler + RecordModal Мартина)
 *  - DEAD_PLAN: разгадать загадку Мёртвого Плана
 *  - BRUNO_SAVIOR: мини-игра Бруно (обрабатывается в BrunoMiniGame)
 *  - MARTIN_RIDDLE: разгадать загадку Мартина (Саймон говорит)
 *  - TARTUCCIO_RIDDLE / DESTROYER — PF2E-загадки
 *
 * Плюс ГЕНЕРИЧЕСКОЕ правило: загадка из БД с achievementCode награждает
 * решившего достижением с этим кодом (настраивается в Мастерской без кода).
 */
export function AchievementWatcher() {
  const solvedRiddles = useArchive((s) => s.solvedRiddles);
  const konamiUnlocked = useArchive((s) => s.konamiUnlocked);
  const achievements = useArchive((s) => s.achievements);
  const unlockAchievement = useArchive((s) => s.unlockAchievement);
  const pushToast = useArchive((s) => s.pushToast);
  const riddles = useRiddles();

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

  // DESTROYER — разгадать загадку Неизвестной личности (PF2E)
  useEffect(() => {
    if (
      solvedRiddles.includes("Неизвестная личность") &&
      !achievements.includes("DESTROYER")
    ) {
      const isNew = unlockAchievement("DESTROYER");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🌀",
          title: "ДОСТИЖЕНИЕ: ГУБИТЕЛЬ",
          body: "Ты разгадал загадку Неизвестной личности — Сатра погубит мир.",
        });
      }
    }
  }, [solvedRiddles, achievements, unlockAchievement, pushToast]);

  // ── ГЕНЕРИЧЕСКОЕ ПРАВИЛО: награда за БД-загадку ──
  // Загадка с achievementCode (задаётся в Мастерской) выдаёт достижение
  // с этим кодом каждому, кто её разгадал. Дубликаты с вшитыми правилами
  // выше безопасны: unlockAchievement игнорирует уже открытые коды.
  useEffect(() => {
    const awarded = riddles.filter(
      (r) =>
        r.achievementCode &&
        solvedRiddles.includes(r.recordName) &&
        !achievements.includes(r.achievementCode),
    );
    if (!awarded.length) return;
    void requestAchievements().then((registry) => {
      for (const r of awarded) {
        const code = r.achievementCode as string;
        const isNew = unlockAchievement(code);
        if (isNew) {
          const def = registry.find((a) => a.code === code);
          sfx.achievement();
          pushToast({
            kind: "ach",
            sigil: def?.sigil ?? "🏆",
            title: `ДОСТИЖЕНИЕ: ${def?.name ?? code}`,
            body: def?.description
              ? `«${r.title}» разгадана. ${def.description}`
              : `«${r.title}» разгадана — награда архива получена.`,
          });
        }
      }
    });
  }, [riddles, solvedRiddles, achievements, unlockAchievement, pushToast]);

  return null;
}
