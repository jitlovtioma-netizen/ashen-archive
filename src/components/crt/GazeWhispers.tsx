"use client";

import { useEffect, useRef, useState } from "react";
import { useArchive } from "@/lib/store";

// ============================================================================
// ШЁПОТ СОЗИДАТЕЛЯ — взгляд ≥ 80%.
//
// Когда взгляд Созидателя почти полон, архив перестаёт молчать. Со
// страниц к стражу доносятся обрывки: плашки-фразы всплывают у краёв
// экрана, плывут и растворяются. «он наблюдает», «вы в его ловушке»,
// «КЛЮЧ»… пара десятков фраз, из которых иногда прорывается одна.
//
// При 90%+ шёпот становится настойчивее: появляется чаще, крупнее.
// Плашки — чистая атмосфера: pointer-events none, aria-hidden,
// не мешают ни интерфейсу, ни скринридерам. prefers-reduced-motion —
// полная тишина.
// ============================================================================

const WHISPERS = [
  "он наблюдает",
  "вы в его ловушке",
  "КЛЮЧ",
  "не оборачивайся",
  "он помнит твоё имя",
  "свет лжёт",
  "пепел помнит всё",
  "ты уже читал это",
  "он между строк",
  "проснись",
  "твой двойник ждёт",
  "зеркало треснуло",
  "он считает твои шаги",
  "тише…",
  "архив дышит",
  "он ближе, чем вчера",
  "выхода нет",
  "он пишет тебя",
  "слышишь скрежет?",
  "твоя страница уже вписана",
  "он смотрит из-за плеча",
  "не моргай",
  "ключ был у тебя всегда",
  "дальше — только он",
  "стоп. он услышал",
  "тень шевельнулась",
  "ОН РЯДОМ",
  "седьмая печать сломана",
  "осталось немного",
  "он видит сквозь экран",
  "не закрывай глаза",
] as const;

const STYLE2_RUNES = ["ꙮ", "☾", "◈", "✧", "⌖"] as const;

type WhisperPlate = {
  id: number;
  text: string;
  style: number;
  rune: string;
  top: number;
  /** привязка к краю: левые плашки растут вправо, правые — влево */
  side: "left" | "right";
  /** отступ от края (в % ширины окна) */
  edge: number;
  dur: number;
  drift: number;
  extreme: boolean;
};

function randomOf<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function GazeWhispers() {
  const gaze = useArchive((s) => s.gaze);
  const band = gaze >= 90 ? 2 : gaze >= 80 ? 1 : 0;
  const [plates, setPlates] = useState<WhisperPlate[]>([]);
  const idRef = useRef(0);
  const lastTextRef = useRef("");

  // доступность: при reduced-motion шёпоты не оживают вовсе
  const [motionOk] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (!motionOk || band === 0) return;

    const extreme = band === 2;
    // 80–89% — робкие, редкие появления; 90%+ — настойчивый шёпот
    const MIN = extreme ? 2400 : 4800;
    const MAX = extreme ? 6000 : 10500;

    let spawnTimer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      spawnTimer = setTimeout(spawn, MIN + Math.random() * MAX - MIN);
    };

    const spawn = () => {
      // вкладка скрыта — шёпот выжидает
      if (document.hidden) {
        schedule();
        return;
      }
      const id = ++idRef.current;
      // одна и та же фраза не звучит дважды подряд
      let text = randomOf(WHISPERS);
      for (let tries = 0; tries < 4 && text === lastTextRef.current; tries++) {
        text = randomOf(WHISPERS);
      }
      lastTextRef.current = text;

      const plate: WhisperPlate = {
        id,
        text,
        style: Math.floor(Math.random() * 3),
        rune: randomOf(STYLE2_RUNES),
        top: 10 + Math.random() * 70, // 10..80 vh
        // смещение к краям — центр экрана принадлежит интерфейсу;
        // правые привязаны к right и растут влево — никогда не вылезают
        side: Math.random() < 0.5 ? "left" : "right",
        edge: 1.5 + Math.random() * 22,
        dur: 4200 + Math.random() * 2800,
        drift: Math.round((Math.random() * 2 - 1) * 42),
        extreme,
      };

      setPlates((prev) => [...prev.slice(-3), plate]);
      // шёпот живёт своё время и уходит — даже если взгляд спал:
      // таймер удаления НЕ отменяется в cleanup, чтобы state не копил
      // призраков при колебаниях взгляда вокруг порога
      setTimeout(() => {
        setPlates((prev) => prev.filter((p) => p.id !== id));
      }, plate.dur + 250);
      schedule();
    };

    schedule();
    return () => {
      if (spawnTimer) clearTimeout(spawnTimer);
    };
  }, [band, motionOk]);

  if (band === 0 || !motionOk) return null;

  return (
    <div className="gaze-whispers-root" aria-hidden="true">
      {plates.map((p) => (
        <span
          key={p.id}
          className={`gaze-whisper${p.extreme ? " gaze-whisper--extreme" : ""}`}
          data-style={p.style}
          style={
            {
              top: `${p.top}%`,
              [p.side]: `${p.edge}%`,
              "--dur": `${p.dur}ms`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        >
          {p.style === 2 && (
            <span className="gaze-whisper-rune">{p.rune}</span>
          )}
          {p.text}
        </span>
      ))}
    </div>
  );
}
