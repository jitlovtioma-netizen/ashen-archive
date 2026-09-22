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
  outcomeImage: string;
  outcomeGlyph: string;
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
    outcomeImage: "",
    outcomeGlyph: "🦁",
  },
  {
    id: "greed",
    name: "ЖАДНОСТЬ",
    emoji: "",
    x: 78,
    y: 27,
    available: false,
    outcome: "",
    outcomeImage: "",
    outcomeGlyph: "💰",
  },
  {
    id: "lust",
    name: "ПОХОТЬ",
    emoji: "",
    x: 83,
    y: 57,
    available: true,
    outcome:
      "Бруно отвернулся от всего, что когда-то определяло его суть — от магии, что текла по его жилам густее крови, от знаний, накопленных за шесть веков, от дружбы с Тургонвэ Аулендил Оромэар Таурингвэнтилем, чьё имя он больше не помнил. Всё это — пепел. Всё это — прах. Кали предложила ему нечто иное: вечный праздник плоти, утопию наслаждения, где каждый вздох — стон, каждое прикосновение — пожар, а каждое мгновенье растворяется в горячем, влажном забытьи.\n\nОн согласился — не от слабости, нет. От жадности. От того голода, что просыпается в мужчине, познавшем, что Кали может дать ему всё: власть над сном, власть над болью, власть над чужими телами и собственным разумом. Она шептала ему в уши, что мир — это пиршественный стол, а он — единственный достойный гость. И он поверил.\n\nЕго куклы — Чинчиро и Динамо — больше не сражаются. Они прислуживают: подносят вино, зажигают благовония, расстилают шёлковые покрывала. Его разум, когда-то способный управлять армиями, теперь пирует лишь образами: изгиб её спины, влажный блеск её глаз, вкус её губ, шёпот, от которого содрогается позвоночник. Кали — его богиня, его наложница, его тюрьма и его рай одновременно.\n\nОн позабыл своих друзей. Реми — друид, что когда-то делил с ним хлеб и дорогу — стал для него никем. Человек, которого он знал сотни лет, превратился в тень, в ничто, в пустое имя, не вызывающее ни тёплого воспоминания, ни укола совести. Все, кого он любил, все, кому клялся в верности — стёрты, выжжены, заменены единым образом: Кали. Её прикосновение, её голос, её дыхание на его коже. Бруно — величайший чародей Эларии — превратился в существо, живущее лишь плотью, лишь удовольствием, лишь этой бесконечной, ненасытной, всепоглощающей похотью, что сжигает его изнутри ярче любого пламени и слаще любого вина.\n\nА Кали улыбается. Она всегда улыбается. Она получила то, что хотела — не его разум, нет. Его желание. Его голод. Его вечную, трепещущую, беспомощную жажду её. И он отдаст ей всё — мир, душу, вечность — лишь бы она не переставала шептать его имя.",
    outcomeImage: "/heroes/sloth_outcome_lust.png",
    outcomeGlyph: "💋",
  },
  {
    id: "envy",
    name: "ЗАВИСТЬ",
    emoji: "",
    x: 66,
    y: 82,
    available: false,
    outcome: "",
    outcomeImage: "",
    outcomeGlyph: "🐍",
  },
  {
    id: "gluttony",
    name: "ЧРЕВОУГОДИЕ",
    emoji: "",
    x: 35,
    y: 83,
    available: false,
    outcome: "",
    outcomeImage: "",
    outcomeGlyph: "🍖",
  },
  {
    id: "wrath",
    name: "ГНЕВ",
    emoji: "",
    x: 16,
    y: 58,
    available: false,
    outcome: "",
    outcomeImage: "",
    outcomeGlyph: "🔥",
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
    outcomeImage: "/heroes/sloth_outcome.png",
    outcomeGlyph: "💀",
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
      className="fixed inset-0 z-[9950] overflow-y-auto crt-scroll flex items-start justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.95)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className={`relative ${phase === "outcome" ? "max-w-4xl" : "max-w-2xl"} w-full text-center py-4`}
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
            className="relative max-w-4xl mx-auto fade-in"
            style={{ animation: "sinsOutcomeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
          >
            <div className="text-4xl glow-amber mb-1">{selectedSin.outcomeGlyph}</div>
            <div className="text-[10px] text-dim tracking-widest mb-2">
              {`// ИСХОД: ${selectedSin.name} //`}
            </div>
            <div className="panel clip-hud brackets p-4 flex flex-col md:flex-row gap-4 text-left">
              {/* Левая колонка — текст */}
              <div className="flex-1 min-w-0 order-2 md:order-1">
                <p className="text-[12px] sm:text-[13px] leading-relaxed text-[var(--text)] italic whitespace-pre-line">
                  {selectedSin.outcome}
                </p>
              </div>
              {/* Правая колонка — картинка */}
              {selectedSin.outcomeImage && (
                <div className="md:w-[35%] shrink-0 order-1 md:order-2 flex items-start justify-center">
                  <img
                    src={selectedSin.outcomeImage}
                    alt={selectedSin.name}
                    className="w-full max-h-[150px] md:max-h-[250px] object-contain rounded"
                    style={{ filter: "drop-shadow(0 0 10px rgba(232, 161, 58, 0.3))" }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setPhase("wheel");
                setSelectedSin(null);
                sfx.blip();
              }}
              className="btn-crt clip-hud-sm px-6 py-2 text-xs mt-3"
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
