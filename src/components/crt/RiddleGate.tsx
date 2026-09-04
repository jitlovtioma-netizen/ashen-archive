"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

interface RiddleGateProps {
  recordName: string;
  onSolved: () => void;
  onCancel: () => void;
}

const RIDDLES: Record<string, {
  sigil: string;
  title: string;
  subtitle: string;
  riddle: string[];
  valid: string[];
  hint: string;
}> = {
  "Разум Бруно": {
    sigil: "🧠",
    title: "РАЗУМ БРУНО",
    subtitle: "// локация · искажена //",
    riddle: [
      "Что без крыльев летит,",
      "Без ног бежит,",
      "Без огня жжёт,",
      "А глазам не верит?",
    ],
    valid: ["обман", "обман.", "обман,"],
    hint: "// разгадай загадку, чтобы открыть локацию //",
  },
  "Мартин": {
    sigil: "🌑",
    title: "МАРТИН",
    subtitle: "// теневой покровитель //",
    riddle: [
      "Он не царь и не король,",
      "Но в игре он главный роль.",
      "Если имя назовёт —",
      "Каждый руки поднесёт.",
      "А без имени приказ",
      "Выполнять нельзя сейчас!",
      "Кто команду отдаёт,",
      "Угадай-ка, в тот же ждёт?",
    ],
    valid: ["саймон говорит", "симон говорит", "саймон", "симон", "саймон говорит.", "симон говорит."],
    hint: "// разгадай загадку, чтобы открыть досье Мартина //",
  },
  "Мёртвый План": {
    sigil: "🏚",
    title: "МЁРТВЫЙ ПЛАН",
    subtitle: "// измерение · сокрытое //",
    riddle: [
      "Мёртвый мир, где нет веселья,",
      "Куклы-стражи, дом, безделье.",
      "Мика пьёт, чтоб заглушить",
      "То, что страшно пережить.",
      "Но откуда хмель берёт?",
      "В мире, где никто не пьёт?",
      "Тайна скрыта в ней самой —",
      "Где источник хмеля той?",
    ],
    valid: ["волосы", "волос", "из волос", "волосы.", "волос."],
    hint: "// разгадай загадку, чтобы открыть досье Мёртвого Плана //",
  },
  "Четвёртый": {
    sigil: "😈",
    title: "ЧЕТВЁРТЫЙ",
    subtitle: "// демон · предатель //",
    riddle: [
      "Мужчина. Демон. Предатель.",
      "Жену знаешь ты, читатель?",
      "Имя жены его назови —",
      "И предатель оживёт в любви.",
      "Ведьма злая, мать змеи,",
      "Кровь её — в его семье.",
      "Кто она? Скажи скорей —",
      "И Четвёртый станет visible.",
    ],
    valid: ["ехидна", "эхидна", "ехидна.", "эхидна."],
    hint: "// назови имя его жены, чтобы открыть досье Четвёртого //",
  },
  "Джейтал": {
    sigil: "🌑",
    title: "ДЖЕЙТАЛ",
    subtitle: "// инквизитор · искажена //",
    riddle: [
      "Что это: чем больше его,",
      "Тем меньше видишь?",
    ],
    valid: ["тьма", "тьма.", "темнота", "темнота.", "мрак", "мрак."],
    hint: "// разгадай загадку, чтобы открыть досье Джейтал //",
  },
  "Тартуччио": {
    sigil: "🎪",
    title: "ТАРТУЧЧИО",
    subtitle: "// бард · гном · искажён //",
    riddle: [
      "Нос задирает высоко,",
      "Смотрит на всех свысока,",
      "Считает себя лучше других,",
      "А падает больно и глубоко.",
      "Что это?",
    ],
    valid: ["гордыня", "гордыня.", "гордость", "гордость.", "высокомерие", "высокомерие."],
    hint: "// разгадай загадку, чтобы открыть досье Тартуччио //",
  },
  "Неизвестная личность": {
    sigil: "🌀",
    title: "НЕИЗВЕСТНАЯ ЛИЧНОСТЬ",
    subtitle: "// сущность · загадка · искажена //",
    riddle: [
      "Кто погубит мир?",
    ],
    valid: ["сатра", "сатра.", "сатра,"],
    hint: "// назови имя, чтобы открыть досье Неизвестной личности //",
  },
  "Неизвестный персонаж": {
    sigil: "👁",
    title: "НЕИЗВЕСТНЫЙ ПЕРСОНАЖ",
    subtitle: "// ??? · всесущий · искажён //",
    riddle: [
      "Я везде сущее, и все могущее,",
      "Я пытаюсь исправить то, что и сам разрушил...",
      "Кто я?",
    ],
    valid: ["созидатель", "созидатель.", "созидатель,"],
    hint: "// назови имя того, кто создал и разрушил //",
  },
  "Микси": {
    sigil: "🧚",
    title: "МИКСИ",
    subtitle: "// пикси · наследница фиолетового леса · искажена //",
    riddle: [
      "Я добро, и зло,",
      "Мне любят и ненавидят,",
      "Но расставшись, я пытаюсь восстановиться...",
      "Кто я?",
    ],
    valid: ["любовь", "любовь.", "любовь,"],
    hint: "// разгадай загадку, чтобы открыть досье Микси //",
  },
  "Безымянная": {
    sigil: "🌑",
    title: "БЕЗЫМЯННАЯ",
    subtitle: "// ??? · без имени · искажена //",
    riddle: [
      "Какая часть человека",
      "Видна только на свету?",
    ],
    valid: ["тень", "тень.", "тень,"],
    hint: "// назови часть, что видна лишь при свете //",
  },
  "Надежда": {
    sigil: "✨",
    title: "НАДЕЖДА",
    subtitle: "// спасительница · видимая лишь одному //",
    riddle: [
      "Что умирает последним?",
    ],
    valid: ["надежда", "надежда.", "надежда,"],
    hint: "// назови то, что умирает последним //",
  },
};

export function RiddleGate({ recordName, onSolved, onCancel }: RiddleGateProps) {
  const { solveRiddle, solvedRiddles, unlockAchievement, pushToast } = useArchive();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);
  const [echidnaEaster, setEchidnaEaster] = useState(false);

  const riddle = RIDDLES[recordName];
  if (!riddle) return null;

  // Если уже разгадана — пропускаем
  if (solvedRiddles.includes(recordName)) {
    onSolved();
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = answer.trim().toLowerCase();

    // Пасхалка: «Ехидна» или «молоко» в любую загадку, КРОМЕ «Четвёртый»
    // (где «Ехидна» — настоящий правильный ответ).
    if (
      (normalized === "ехидна" || normalized === "ехидна." ||
       normalized === "молоко" || normalized === "молоко.") &&
      recordName !== "Четвёртый"
    ) {
      sfx.whisper();
      setEchidnaEaster(true);
      return;
    }

    if (riddle.valid.includes(normalized)) {
      solveRiddle(recordName);
      sfx.unlock();
      pushToast({
        kind: "secret",
        sigil: "🎯",
        title: "ЗАГАДКА РАЗГАДАНА",
        body: "Доступ открыт.",
      });
      onSolved();
    } else {
      setError(true);
      sfx.error();
      setTimeout(() => setError(false), 2000);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9700] flex items-center justify-center p-4"
      style={{
        background: "rgba(2, 0, 2, 0.9)",
        backdropFilter: "blur(3px)",
      }}
      onClick={onCancel}
    >
      <div
        className="panel clip-hud brackets w-full max-w-lg p-6 fade-in"
        style={{
          boxShadow: "0 0 40px rgba(167, 139, 250, 0.3)",
          animation: "modalIn 0.3s ease-out forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="led led-amber" />
          <span className="text-[10px] text-dim tracking-widest ml-2">
            {"// ПЕЧАТЬ_ЗАГАДКИ //"}
          </span>
          <span className="flex-1" />
          <button
            onClick={onCancel}
            className="btn-crt btn-red clip-hud-sm px-2 py-0.5 text-[11px]"
          >
            ✕
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="text-4xl glow-violet mb-2 pulse-slow">{riddle.sigil}</div>
          <div className="font-medieval text-xl glow-violet tracking-wider">
            {riddle.title}
          </div>
          <div className="text-[10px] text-dim tracking-widest mt-1">
            {riddle.subtitle}
          </div>
        </div>

        <div className="panel-inset p-4 mb-4 border-l-2 border-[var(--violet)]">
          <div className="text-[10px] glow-violet tracking-widest mb-2">
            ⟁ ЗАГАДКА
          </div>
          <div className="text-[13px] text-[var(--text)] leading-relaxed italic space-y-1">
            {riddle.riddle.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] glow-violet tracking-widest mb-1.5">
              {"> ОТВЕТ:"}
            </label>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
              className={`w-full bg-[var(--bg-deep)] border px-3 py-2 text-sm text-[var(--green)] focus:outline-none transition-all font-mono-crt clip-hud-sm ${
                error
                  ? "border-[var(--red)] shadow-[0_0_10px_rgba(255,36,36,0.4)] animate-pulse"
                  : "border-[var(--line-bright)] focus:border-[var(--violet)] focus:shadow-[0_0_10px_rgba(167,139,250,0.3)]"
              }`}
              placeholder="впиши ответ..."
              disabled={error}
            />
          </div>

          {error && (
            <div className="text-center glow-red text-sm glitch" data-text="НЕВЕРНО">
              [ НЕВЕРНО — попробуй снова ]
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-crt btn-amber clip-hud-sm flex-1 py-2 text-xs"
            >
              🔑 ОТВЕТИТЬ
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="btn-crt clip-hud-sm px-4 py-2 text-xs"
            >
              ✕ ОТМЕНА
            </button>
          </div>
        </form>

        <div className="text-[9px] text-dim mt-4 text-center tracking-wider">
          {riddle.hint}
        </div>
      </div>

      {/* Пасхалка: арт Ехидны при вводе «Ехидна» или «молоко» */}
      {echidnaEaster && (
        <div
          className="fixed inset-0 z-[9800] flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.95)", backdropFilter: "blur(4px)" }}
          onClick={() => setEchidnaEaster(false)}
        >
          <div className="relative fade-in" onClick={(e) => e.stopPropagation()}>
            <img
              src="/heroes/echidna2.png"
              alt="Ехидна"
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
              style={{
                filter: "drop-shadow(0 0 30px rgba(167, 139, 250, 0.4))",
                animation: "echidnaIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            />
            <button
              onClick={() => setEchidnaEaster(false)}
              className="absolute -top-3 -right-3 btn-crt btn-red clip-hud-sm px-2 py-0.5 text-xs"
            >
              ✕
            </button>
            <div className="text-center mt-3 text-[10px] text-dim tracking-widest">
              {"// ...что ты наделал... //"}
            </div>
          </div>
          <style>{`
            @keyframes echidnaIn {
              0% { opacity: 0; transform: scale(0.5) rotate(-10deg); filter: blur(20px) drop-shadow(0 0 60px rgba(167, 139, 250, 0.8)); }
              60% { filter: blur(0) drop-shadow(0 0 30px rgba(167, 139, 250, 0.4)); }
              100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0) drop-shadow(0 0 30px rgba(167, 139, 250, 0.4)); }
            }
          `}</style>
        </div>
      )}
    </div>,
    document.body
  );
}
