"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/audio";

interface RemiTransformSelectorProps {
  onClose: () => void;
}

type Element = "nature" | "fire" | "water" | "air";

interface CharacterForm {
  id: string;
  name: string;
  element: Element;
  emoji: string;
  imageUrl: string;
  description: string;
  friendship: number | null;
}

const FORMS: CharacterForm[] = [
  {
    id: "remi",
    name: "РЕМИ",
    element: "nature",
    emoji: "🌿",
    imageUrl: "/heroes/remi.png",
    description:
      "▓▒░ Реми ░▒▓ — друид Круга Пастырей, выросший в лесах Феррумгарда. Не зная ни отца, ни матери, он бродил по миру с фамильяром Пинки, лечил раненых и говорил с дубами, что помнят рождение гор. Способен обернуться любым зверем — и говорят, иногда забывает вернуться. Ищет способ исцелить кристаллическую болезнь, от которой умер его дед Ганс.\n\nПрирода — его стихия. Лес отвечает на его зов, корни расступаются пред ним, звери приходят на его зов. В его руках — сила самой земли Эларии, зелёная и живая, пульсирующая, как сердце мира.",
    friendship: null,
  },
  {
    id: "irem",
    name: "ИРЕМ",
    element: "fire",
    emoji: "🔥",
    imageUrl: "/heroes/irem.png",
    description:
      "▓▒░ Ирем ░▒▓ — загадочный роготай, чья внешность до странности напоминает Реми, словно он — его искажённое, более яркое и хищное отражение. Облачённый в роскошные одежды багровых тонов, с рогами, венчающими его голову, он источает ауру опасной элегантности. Ирем утверждает, что был спасён Пинки, которая якобы скрылась в библиотеке, однако в этих словах чувствуется фальшь.\n\nОгонь — его стихия. Пламя подчиняется его воле, пляшет в его пальцах, пожирает тех, кто осмелится бросить ему вызов. За его изящными жестами и манящим красным цветом скрывается нечто неуловимое, заставляющее сомневаться в правдивости его истории. Действительно ли он спасён, или же этот мужчина — лишь очередная загадка, чьи истинные цели ещё предстоит раскрыть?",
    friendship: 8,
  },
  {
    id: "meri",
    name: "МЕРИ",
    element: "water",
    emoji: "💧",
    imageUrl: "/heroes/meri.png",
    description:
      "▓▒░ Мери ░▒▓ — девушка, что была заточена во льдах на множество лет из-за хотело Криоса, ледяного элементаля. Она могла превращать лёд в воду, воду в вино. Её сила не была могущественной, но очень интересной — не та, что сокрушает армии, но та, что меняет суть вещей, превращая одно в другое, словно алхимия самой природы.\n\nПо характеру она робкая и нерешительная. Говорит тихо, почти шёпотом, и всегда отводит взгляд, когда кто-то смотрит ей в глаза. Но за этой робостью скрывается сердце, что выдержало века во льду — и не замёрзло. Вода — её стихия: текучая, мягкая, но способная разрушить камень, если дать ей время.",
    friendship: 7,
  },
  {
    id: "ria",
    name: "РИЯ",
    element: "air",
    emoji: "🌪",
    imageUrl: "/heroes/ria.png",
    description:
      "▓▒░ Рия ░▒▓ — госпожа воздуха, гений воздуха. Имеет огромную власть над всем вокруг: способна своей силой искривлять гравитацию, оставлять мозг или лёгкие без воздуха одним движением воли. Воздух — не просто её стихия, это продолжение её тела, её мыслей, её прихотей. То, что она решает — становится законом воздуха, и ничто живое не может ей противиться.\n\nПо характеру, как описал её Мартин МакДона: стерва. Она любит, когда у всех вокруг шалят нервишки. Сама она непредсказуема, и что у неё на уме — не понять. Но она помогла Реми. И возможно, Бруно скорее всего в неё влюбился — ибо кто может устоять перед той, что держит в ладонях само небо?",
    friendship: 6,
  },
];

const ELEMENT_CONFIG: Record<Element, {
  primary: string;
  secondary: string;
  glow: string;
  bg: string;
  particleEmoji: string;
  label: string;
}> = {
  nature: {
    primary: "#4af626",
    secondary: "#1a5d0a",
    glow: "rgba(74,246,38,0.4)",
    bg: "radial-gradient(ellipse at center, rgba(26,93,10,0.2) 0%, rgba(0,0,0,0.95) 70%)",
    particleEmoji: "🍃",
    label: "ПРИРОДА",
  },
  fire: {
    primary: "#ff6b35",
    secondary: "#8b2500",
    glow: "rgba(255,107,53,0.4)",
    bg: "radial-gradient(ellipse at center, rgba(139,37,0,0.25) 0%, rgba(0,0,0,0.95) 70%)",
    particleEmoji: "🔥",
    label: "ОГОНЬ",
  },
  water: {
    primary: "#4a9eff",
    secondary: "#1a4a7a",
    glow: "rgba(74,158,255,0.4)",
    bg: "radial-gradient(ellipse at center, rgba(26,74,122,0.25) 0%, rgba(0,0,0,0.95) 70%)",
    particleEmoji: "💧",
    label: "ВОДА",
  },
  air: {
    primary: "#b0e0ff",
    secondary: "#5a8aaa",
    glow: "rgba(176,224,255,0.4)",
    bg: "radial-gradient(ellipse at center, rgba(90,138,170,0.15) 0%, rgba(0,0,0,0.95) 70%)",
    particleEmoji: "🌪",
    label: "ВОЗДУХ",
  },
};

type Phase = "select" | "dossier";

export function RemiTransformSelector({ onClose }: RemiTransformSelectorProps) {
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedForm, setSelectedForm] = useState<CharacterForm | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase === "dossier") {
          setPhase("select");
          setSelectedForm(null);
        } else {
          sfx.blip();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, onClose]);

  if (typeof document === "undefined") return null;

  const handleSelect = (form: CharacterForm) => {
    sfx.whisper();
    setSelectedForm(form);
    setPhase("dossier");
  };

  const config = selectedForm ? ELEMENT_CONFIG[selectedForm.element] : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9960] overflow-y-auto crt-scroll flex items-start justify-center p-4"
      style={{ background: "rgba(0,0,0,0.97)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div className="relative w-full max-w-4xl my-auto text-center py-4" onClick={(e) => e.stopPropagation()}>
        {/* === Phase: Select === */}
        {phase === "select" && (
          <div className="fade-in" style={{ animation: "remiSelectIn 0.4s ease-out forwards" }}>
            <div className="text-4xl mb-2">🌿🔥💧🌪</div>
            <h2 className="font-medieval text-2xl sm:text-3xl glow-green tracking-wider mb-2">
              ВЫБОР ФОРМЫ
            </h2>
            <div className="text-[10px] text-dim tracking-widest mb-8">
              {"// Реми может принимать разные облики //"}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {FORMS.map((form) => {
                const cfg = ELEMENT_CONFIG[form.element];
                return (
                  <button
                    key={form.id}
                    onClick={() => handleSelect(form)}
                    className="panel clip-hud-sm p-4 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-105"
                    style={{
                      borderColor: `${cfg.primary}55`,
                      boxShadow: `0 0 16px ${cfg.glow}`,
                      background: `linear-gradient(135deg, ${cfg.secondary}22, transparent)`,
                    }}
                    onMouseEnter={() => sfx.hover()}
                  >
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-3xl sm:text-4xl"
                      style={{
                        background: `radial-gradient(circle, ${cfg.primary}22, transparent)`,
                        boxShadow: `0 0 20px ${cfg.glow}`,
                        border: `2px solid ${cfg.primary}66`,
                      }}
                    >
                      {form.emoji}
                    </div>
                    <div
                      className="font-medieval text-sm sm:text-base tracking-wider"
                      style={{ color: cfg.primary, textShadow: `0 0 8px ${cfg.glow}` }}
                    >
                      {form.name}
                    </div>
                    <div className="text-[9px] text-dim tracking-widest">
                      {cfg.label}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="btn-crt btn-red clip-hud-sm px-4 py-1 text-xs mt-8"
            >
              ✕ ЗАКРЫТЬ
            </button>
          </div>
        )}

        {/* === Phase: Dossier === */}
        {phase === "dossier" && selectedForm && config && (
          <div className="fade-in" style={{ animation: "remiDossierIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards" }}>
            {/* Element particles */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.15 }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute text-2xl"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animation: `remiParticle ${3 + Math.random() * 4}s ease-in-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                    color: config.primary,
                    opacity: 0.5,
                  }}
                >
                  {config.particleEmoji}
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="mb-4">
              <div
                className="text-5xl mb-2"
                style={{ filter: `drop-shadow(0 0 16px ${config.glow})` }}
              >
                {selectedForm.emoji}
              </div>
              <div className="text-[10px] text-dim tracking-widest mb-1">
                {`// ${config.label} //`}
              </div>
            </div>

            {/* Body: text left, image right */}
            <div
              className="panel clip-hud brackets p-4 flex flex-col md:flex-row gap-4 text-left max-h-[70vh] overflow-y-auto crt-scroll"
              style={{
                borderColor: `${config.primary}55`,
                boxShadow: `0 0 30px ${config.glow}`,
                background: `linear-gradient(135deg, ${config.secondary}15, rgba(10,10,10,0.95))`,
              }}
            >
              {/* Left: text */}
              <div className="flex-1 min-w-0 order-2 md:order-1">
                <h3
                  className="font-medieval text-xl sm:text-2xl tracking-wider mb-2"
                  style={{ color: config.primary, textShadow: `0 0 12px ${config.glow}` }}
                >
                  {selectedForm.name}
                </h3>
                {typeof selectedForm.friendship === "number" && selectedForm.friendship > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    {selectedForm.friendship >= 10 && <span className="text-sm">❤️</span>}
                    <div
                      className="h-2 w-24 overflow-hidden rounded-full"
                      style={{ background: "rgba(0,0,0,0.4)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(selectedForm.friendship / 10) * 100}%`,
                          background: config.primary,
                          boxShadow: `0 0 4px ${config.glow}`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: config.primary }}>
                      {selectedForm.friendship}/10
                    </span>
                  </div>
                )}
                <p className="text-[13px] leading-relaxed text-[var(--text)] italic whitespace-pre-line">
                  {selectedForm.description}
                </p>
              </div>
              {/* Right: image */}
              <div className="md:w-[35%] shrink-0 order-1 md:order-2 flex items-start justify-center">
                <img
                  src={selectedForm.imageUrl}
                  alt={selectedForm.name}
                  className="w-full max-h-[200px] md:max-h-[350px] object-contain rounded"
                  style={{
                    filter: `drop-shadow(0 0 12px ${config.glow})`,
                    opacity: 0.9,
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => {
                setPhase("select");
                setSelectedForm(null);
                sfx.blip();
              }}
              className="btn-crt clip-hud-sm px-6 py-2 text-xs mt-4"
              style={{ borderColor: `${config.primary}55`, color: config.primary }}
            >
              ◂ НАЗАД К ВЫБОРУ
            </button>
          </div>
        )}

        <style>{`
          @keyframes remiSelectIn {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes remiDossierIn {
            0% { opacity: 0; transform: translateY(20px); filter: blur(8px); }
            60% { filter: blur(0); }
            100% { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          @keyframes remiParticle {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
            50% { transform: translateY(-30px) rotate(180deg); opacity: 0.6; }
          }
        `}</style>
      </div>
    </div>,
    document.body,
  );
}
