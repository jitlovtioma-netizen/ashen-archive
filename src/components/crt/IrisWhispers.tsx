"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// ИРИС-ШЁПОТ ДОСЬЕ — v5.5.
//
// Когда страж открывает досье с полным искажением (⟪…⟫), ирис узнаёт
// читателя: у краёв экрана всплывает переливающаяся строка и тает.
// Это НЕ шёпот Созидателя (тот требует взгляда ≥80%) — это сам текст
// отвечает. Работает при любом взгляде, живёт по тем же законам
// атмосферности: pointer-events none, aria-hidden, reduced-motion —
// мгновенное появление/исчезание.
//
// Связь — глобальное событие "iris:whisper" на window: RecordModal
// диспатчит его при открытии досье с ⟪…⟫ (detail: { rune?: boolean }).
// Слой смонтирован в page.tsx рядом с GazeWhispers.
//
// v5.6 — фазы: "greet" (при открытии) и "farewell" (при закрытии —
// ирис прощается, пока страж захлопывает досье). Прощальные фразы
// мягче и личнее: ирис уже знает, что ты вернёшься.
//
// v5.7 — фазы "echo" и "devour":
//   echo  — ирис-эхо на КАРТОЧКЕ: при наведении на ирис-досье в списке
//           оно отвечает из списка — тихий голос из-под страницы;
//   devour — досье на стадии 5+ («ирис не отпускает») встречает читателя
//           не приветствием, а констатацией: ты пришёл туда, где тебя
//           уже меньше, чем ириса.
// ============================================================================

const IRIS_WHISPERS = [
  "ирис помнит тебя",
  "это не текст",
  "смысл уже утёк",
  "глубже",
  "не переводи взгляд",
  "цвета лгут",
  "он вплетает слова",
  "между глифами — ты",
  "долг ириса не возвращают",
  "это место уже твоё",
  "продолжай читать",
  "текст смотрит в ответ",
  "здесь не было смысла",
  "ирис почти заполнил страницу",
  "ты дочитаешь до конца",
] as const;

// v5.6 — прощальный ирис: досье закрывается, ирис отпускает не сразу
const IRIS_FAREWELLS = [
  "ты вернёшься",
  "ирис сохранил твой взгляд",
  "до встречи в цветах",
  "страница пуста без тебя",
  "он подождёт",
  "твой след остался здесь",
  "ирис не отпускает — отпускаешь ты",
  "цвета останутся",
  "закрой глаза — увидишь снова",
  "это ещё не конец текста",
  "ирис досмотрит за тебя",
  "возвращайся глубже",
] as const;

// v5.7 — эхо списка: карточка ирис-досье отвечает на наведение
const IRIS_ECHOES = [
  "открой меня",
  "здесь было больше слов",
  "ирис ждал",
  "не проходи мимо",
  "строка ещё помнит",
  "ты уже читал это",
  "осталось меньше, чем было",
  "цвет дрожит — заметил?",
  "загляни ещё раз",
  "это досье узнаёт тебя",
] as const;

// v5.7 — встреча стадии 5+: ирис не здоровается — он напоминает
const IRIS_DEVOURS = [
  "ты опять здесь",
  "ирис почти всё дочитал",
  "тебя осталось мало",
  "это уже не досье",
  "дальше читает ирис",
  "зачем ты возвращаешься",
  "текст кончился раньше тебя",
  "ирис держит страницу",
] as const;

const IRIS_RUNES = ["ꙮ", "◈", "◐", "✧"] as const;

export type IrisWhisperPhase = "greet" | "farewell" | "echo" | "devour";

type IrisPlate = {
  id: number;
  text: string;
  rune: string | null;
  top: number;
  side: "left" | "right";
  edge: number;
  dur: number;
  drift: number;
  echo?: boolean;
  devour?: boolean;
};

function randomOf<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function dispatchIrisWhisper(
  opts?: { rune?: boolean; phase?: IrisWhisperPhase },
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("iris:whisper", {
      detail: {
        rune: opts?.rune ?? Math.random() < 0.55,
        phase: opts?.phase ?? "greet",
      },
    }),
  );
}

export function IrisWhispers() {
  const [plates, setPlates] = useState<IrisPlate[]>([]);
  const idRef = useRef(0);
  const lastTextRef = useRef("");
  const lastAtRef = useRef(0);

  // доступность: при reduced-motion ирис-шёпот не оживает вовсе
  const [motionOk] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (!motionOk) return;

    const spawn = (e: Event) => {
      const detail = (e as CustomEvent<{ rune?: boolean; phase?: string }>).detail;
      const now = Date.now();
      const phase0 = (detail?.phase ?? "greet") as IrisWhisperPhase;
      // защита от шквала — но ТОЛЬКО для эха (наведение на карточку можно
      // дёргать сколько угодно). Приветствие/поглощение живут на монтировании
      // досье, прощание — на закрытии: это одиночные события, пусть проходят
      // всегда — иначе эхо при наведении «съедает» приветствие при открытии.
      if (phase0 === "echo" && now - lastAtRef.current < 2500) return;
      lastAtRef.current = now;

      const phase = phase0;
      const farewell = phase === "farewell";
      const echo = phase === "echo";
      const devour = phase === "devour";
      const pool = farewell
        ? IRIS_FAREWELLS
        : echo
          ? IRIS_ECHOES
          : devour
            ? IRIS_DEVOURS
            : IRIS_WHISPERS;

      const id = ++idRef.current;
      let text = randomOf(pool);
      for (let tries = 0; tries < 4 && text === lastTextRef.current; tries++) {
        text = randomOf(pool);
      }
      lastTextRef.current = text;

      const plate: IrisPlate = {
        id,
        text,
        rune: detail?.rune ? randomOf(IRIS_RUNES) : null,
        // зона досье: верхняя половина экрана у краёв; прощание — нижняя
        // половина (ирис «уходит вниз», вслед за закрывающейся модалкой);
        // эхо списка — средняя полоса (карточка говорит «изнутри» списка);
        // встреча стадии 5+ — верх, как приветствие, но жёстче тоном
        top: farewell
          ? 56 + Math.random() * 30 // 56..86 vh
          : echo
            ? 30 + Math.random() * 32 // 30..62 vh
            : 14 + Math.random() * 34, // 14..48 vh
        side: Math.random() < 0.5 ? "left" : "right",
        edge: 2 + Math.random() * 14,
        dur: echo
          ? 2600 + Math.random() * 1400 // эхо короче — это полмысли, не фраза
          : 3800 + Math.random() * 2200,
        drift: Math.round((Math.random() * 2 - 1) * 34),
        echo,
        devour,
      };

      setPlates((prev) => [...prev.slice(-1), plate]);
      // ирис-шёпот живёт своё время и уходит; таймер удаления НЕ
      // отменяется — state не копит призраков
      setTimeout(() => {
        setPlates((prev) => prev.filter((p) => p.id !== id));
      }, plate.dur + 250);
    };

    window.addEventListener("iris:whisper", spawn);
    return () => window.removeEventListener("iris:whisper", spawn);
  }, [motionOk]);

  if (!motionOk) return null;

  return (
    <div className="iris-whispers-root" aria-hidden="true">
      {plates.map((p) => (
        <span
          key={p.id}
          className={`iris-whisper${p.echo ? " iris-whisper--echo" : ""}${p.devour ? " iris-whisper--devour" : ""}`}
          style={
            {
              top: `${p.top}%`,
              [p.side]: `${p.edge}%`,
              "--dur": `${p.dur}ms`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        >
          {p.rune && <span className="iris-whisper-rune">{p.rune}</span>}
          {p.text}
        </span>
      ))}
    </div>
  );
}
