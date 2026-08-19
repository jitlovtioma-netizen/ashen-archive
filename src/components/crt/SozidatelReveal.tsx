"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface SozidatelRevealProps {
  imageUrl: string;
  onComplete: () => void;
}

type Phase = "darkness" | "art" | "done";

/**
 * SozidatelReveal — спецэффект при разгадке загадки «Неизвестный персонаж»
 * (Созидатель).
 *
 * Фазы:
 * 1. DARKNESS (7 секунд) — экран тухнет, везде глюки и лаги.
 * 2. ART (10 секунд) — показывается арт Созидателя на весь экран.
 * 3. DONE — onComplete(), открывается обычная модалка досье.
 */
export function SozidatelReveal({ imageUrl, onComplete }: SozidatelRevealProps) {
  const [phase, setPhase] = useState<Phase>("darkness");

  useEffect(() => {
    // Фаза 1: тьма + глюки — 7 секунд
    const darkTimer = setTimeout(() => {
      setPhase("art");
      // Фаза 2: арт — 10 секунд
      const artTimer = setTimeout(() => {
        setPhase("done");
        onComplete();
      }, 10000);
      return () => clearTimeout(artTimer);
    }, 7000);

    return () => clearTimeout(darkTimer);
  }, [onComplete]);

  if (phase === "done" || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ background: "#000" }}
    >
      {phase === "darkness" && (
        <>
          {/* Полная тьма */}
          <div
            className="absolute inset-0"
            style={{
              background: "#000",
              animation: "sozidatelFlicker 0.3s steps(3) infinite",
            }}
          />
          {/* Глюк-линии */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${20 + Math.random() * 60}%`,
                  height: `${1 + Math.random() * 4}px`,
                  background: `rgba(${Math.random() > 0.5 ? "63, 214, 200" : "255, 36, 36"}, ${0.2 + Math.random() * 0.4})`,
                  animation: `sozidatelGlitch${i % 3} ${0.1 + Math.random() * 0.3}s steps(2) infinite`,
                }}
              />
            ))}
          </div>
          {/* Текстовые глюки */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="font-vt323 text-2xl tracking-widest"
              style={{
                color: "rgba(63, 214, 200, 0.5)",
                textShadow: "2px 0 rgba(255,36,36,0.4), -2px 0 rgba(167,139,250,0.4)",
                animation: "sozidatelTextGlitch 0.15s steps(2) infinite",
              }}
            >
              {"// ОН ПРОБУЖДАЕТСЯ //"}
            </div>
          </div>
          {/* CRT noise */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              animation: "sozidatelNoise 0.3s steps(3) infinite",
            }}
          />
        </>
      )}

      {phase === "art" && (
        <>
          {/* Тёмный фон */}
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at center, rgba(0,10,10,0.8), #000)",
            }}
          />
          {/* Арт Созидателя */}
          <img
            src={imageUrl}
            alt="Созидатель"
            className="relative max-h-[90vh] max-w-[90vw] object-contain"
            style={{
              animation: "sozidatelArtIn 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              filter: "drop-shadow(0 0 30px rgba(63, 214, 200, 0.4))",
            }}
          />
          {/* Лёгкий glow по краям */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 50%, rgba(63, 214, 200, 0.05) 100%)",
              animation: "sozidatelGlow 3s ease-in-out infinite",
            }}
          />
        </>
      )}

      <style>{`
        @keyframes sozidatelFlicker {
          0%, 70% { opacity: 1; }
          72% { opacity: 0.7; }
          74% { opacity: 1; }
          76% { opacity: 0.5; }
          78% { opacity: 1; }
          100% { opacity: 1; }
        }
        @keyframes sozidatelGlitch0 {
          0% { transform: translateX(0); }
          100% { transform: translateX(${Math.random() > 0.5 ? "3px" : "-3px"}); }
        }
        @keyframes sozidatelGlitch1 {
          0% { transform: translateY(0); }
          100% { transform: translateY(${Math.random() > 0.5 ? "2px" : "-2px"}); }
        }
        @keyframes sozidatelGlitch2 {
          0% { opacity: 0.3; }
          100% { opacity: 0.8; }
        }
        @keyframes sozidatelTextGlitch {
          0% { transform: translate(0, 0); opacity: 0.5; }
          50% { transform: translate(2px, -1px); opacity: 0.8; }
          100% { transform: translate(-2px, 1px); opacity: 0.3; }
        }
        @keyframes sozidatelNoise {
          0% { transform: translate(0, 0); }
          33% { transform: translate(-2px, 1px); }
          66% { transform: translate(1px, -2px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes sozidatelArtIn {
          0% { opacity: 0; transform: scale(0.7); filter: blur(20px) drop-shadow(0 0 60px rgba(63, 214, 200, 0.8)); }
          60% { filter: blur(0) drop-shadow(0 0 30px rgba(63, 214, 200, 0.4)); }
          100% { opacity: 1; transform: scale(1); filter: blur(0) drop-shadow(0 0 30px rgba(63, 214, 200, 0.4)); }
        }
        @keyframes sozidatelGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
