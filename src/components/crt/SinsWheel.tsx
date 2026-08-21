"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/audio";

interface SinsWheelProps {
  onClose: () => void;
}

type Sin = {
  id: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  available: boolean;
  outcome: string;
};

const SINS: Sin[] = [
  {
    id: "pride",
    name: "ГОРДЫНЯ",
    emoji: "",
    x: 50,
    y: 15,
    available: false,
    outcome: "",
  },
  {
    id: "greed",
    name: "ЖАДНОСТЬ",
    emoji: "",
    x: 78,
    y: 27,
    available: false,
    outcome: "",
  },
  {
    id: "lust",
    name: "ПОХОТЬ",
    emoji: "",
    x: 83,
    y: 57,
    available: false,
    outcome: "",
  },
  {
    id: "envy",
    name: "ЗАВИСТЬ",
    emoji: "",
    x: 66,
    y: 82,
    available: false,
    outcome: "",
  },
  {
    id: "gluttony",
    name: "ЧРЕВОУГОДИЕ",
    emoji: "",
    x: 35,
    y: 83,
    available: false,
    outcome: "",
  },
  {
    id: "wrath",
    name: "ГНЕВ",
    emoji: "",
    x: 16,
    y: 58,
    available: false,
    outcome: "",
  },
  {
    id: "sloth",
    name: "УНЫНИЕ",
    emoji: "",
    x: 21,
    y: 27,
    available: true,
    outcome:
      "Бруно после того как убил Амелию своими руками, впал в абсолютное уныние. То, что было когда-то разумом величайшего чародея Эларии, превратилось в серую, безмолвную пустоту. Он перестал стремиться хоть к чему-то — ни к магии, ни к свободе, ни к жизни. Его глаза остекленели, его руки безвольно лежали на коленях, а его разум, прежде способный управлять куклами с точностью хирурга, замер, как сломанные часы. Он был согласен на всё, что скажет ему Кали. Каждое её слово становилось для него законом, каждый её приказ — единственной нитью, связывающей его с реальностью. Она шептала ему, кого ненавидеть, кому доверять, что делать — и он слушал, не имея сил даже на сомнение. Его воля была раздавлена не магией, а собственным горем: тяжестью рук, что убили ту, что его разбудила. Кали ласково гладила его по голове и называла «послушным мальчиком». А он улыбался — пустой, мёртвой улыбкой человека, который больше не существует.",
  },
];

type Phase = "wheel" | "outcome";

/**
 * SinsWheel — интерактивное колесо грехов Бруно.
 * Кнопка «А что могло бы быть?» в досье Бруно открывает это окно.
 * Клик на доступный грех (пока только «УНЫНИЕ») → показывает исход.
 *
 * Колесо НЕ вращается (статичное изображение).
 * Кнопки грехов — в полный размер черепа на изображении.
 */
export function SinsWheel({ onClose }: SinsWheelProps) {
  const [phase, setPhase] = useState<Phase>("wheel");
  const [selectedSin, setSelectedSin] = useState<Sin | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase === "outcome") {
          setPhase("wheel");
          setSelectedSin(null);
        } else {
          sfx.blip();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  if (typeof document === "undefined") return null;

  const handleClick = (sin: Sin) => {
    if (!sin.available) {
      sfx.error();
      return;
    }
    sfx.whisper();
    setSelectedSin(sin);
    setPhase("outcome");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9950] flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.95)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="mb-6">
          <div className="text-[10px] text-dim tracking-widest mb-1">
            {"// ЧТО МОГЛО БЫ БЫТЬ? //"}
          </div>
          <h2
            className="font-medieval text-2xl sm:text-3xl glow-amber tracking-wider"
            style={{ textShadow: "0 0 12px rgba(232, 161, 58, 0.5)" }}
          >
            КОЛЕСО ГРЕХОВ
          </h2>
          <div className="text-[10px] text-dim mt-2 tracking-widest">
            {"// нажми на череп, чтобы увидеть исход //"}
          </div>
        </div>

        {phase === "wheel" && (
          <div className="relative mx-auto" style={{ maxWidth: "500px", aspectRatio: "1" }}>
            {/* Изображение колеса — статичное, без вращения */}
            <img
              src="/heroes/sins_wheel.png"
              alt="Колесо грехов"
              className="absolute inset-0 w-full h-full object-contain rounded-full"
              style={{
                filter: "drop-shadow(0 0 30px rgba(232, 161, 58, 0.3))",
              }}
            />
            {/* Кликабельные зоны — грехи (кнопки на черепах, в полный размер) */}
            {SINS.map((sin) => (
              <button
                key={sin.id}
                onClick={() => handleClick(sin)}
                className="absolute -translate-x-1/2 -translate-y-1/2 group flex items-center justify-center"
                style={{
                  left: `${sin.x}%`,
                  top: `${sin.y}%`,
                  width: "72px",
                  height: "72px",
                  cursor: sin.available ? "pointer" : "not-allowed",
                }}
                aria-label={sin.name}
                title={sin.available ? sin.name : `${sin.name} (недоступно)`}
              >
                <div
                  className="w-full h-full rounded-full transition-all"
                  style={{
                    background: sin.available
                      ? "rgba(232, 161, 58, 0.1)"
                      : "transparent",
                    border: sin.available
                      ? "2px solid rgba(232, 161, 58, 0.5)"
                      : "2px solid transparent",
                    boxShadow: sin.available
                      ? "0 0 16px rgba(232, 161, 58, 0.3)"
                      : "none",
                    opacity: sin.available ? 1 : 0.4,
                    cursor: sin.available ? "pointer" : "default",
                  }}
                />

                {/* Hover tooltip */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap text-[10px] tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ color: sin.available ? "var(--amber)" : "var(--dim)" }}
                >
                  {sin.name}
                  {!sin.available && " (недоступно)"}
                </div>
              </button>
            ))}
          </div>
        )}

        {phase === "outcome" && selectedSin && (
          <div
            className="relative max-w-lg mx-auto fade-in"
            style={{ animation: "sinsOutcomeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
          >
            <div className="text-5xl glow-amber mb-4">💀</div>
            <div className="text-[10px] text-dim tracking-widest mb-2">
              {`// ИСХОД: ${selectedSin.name} //`}
            </div>
            <div className="panel clip-hud brackets p-6 text-left">
              {/* Картинка исхода */}
              <img
                src="/heroes/sloth_outcome.png"
                alt="Уныние"
                className="w-full max-h-[300px] object-contain rounded mb-4"
                style={{ filter: "drop-shadow(0 0 12px rgba(232, 161, 58, 0.3))" }}
              />
              <p className="text-[14px] leading-relaxed text-[var(--text)] italic">
                {selectedSin.outcome}
              </p>
            </div>
            <button
              onClick={() => {
                setPhase("wheel");
                setSelectedSin(null);
                sfx.blip();
              }}
              className="btn-crt clip-hud-sm px-6 py-2 text-xs mt-6"
            >
              ◂ НАЗАД К КОЛЕСУ
            </button>
          </div>
        )}

        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="btn-crt btn-red clip-hud-sm px-4 py-1 text-xs mt-6"
        >
          ✕ ЗАКРЫТЬ
        </button>
      </div>

      <style>{`
        @keyframes sinsOutcomeIn {
          0% { opacity: 0; transform: scale(0.9); filter: blur(8px); }
          60% { filter: blur(0); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
