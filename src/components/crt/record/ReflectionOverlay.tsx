"use client";

import { useMemo } from "react";

const COLORS = ["#ff3366", "#a78bfa", "#660066", "#ff0033", "#990033"];
const SIZES = ["10px", "12px", "14px", "16px", "18px", "20px"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/**
 * «ОТРАЖЕНИЕ» — слова, разбросанные по экрану поверх досье Кали.
 * Позиции считаются один раз при открытии (раньше — на каждый рендер,
 * и слова дёргались при любом изменении состояния окна).
 */
export function ReflectionOverlay() {
  const words = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: pick(SIZES),
        color: pick(COLORS),
        glow: pick(COLORS),
        opacity: 0.08 + Math.random() * 0.25,
        rotate: Math.random() * 60 - 30,
        duration: 4 + Math.random() * 6,
        delay: i * 0.2,
      })),
    [],
  );
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9701 }} aria-hidden>
      {words.map((w, i) => (
        <div
          key={i}
          className="absolute font-bold tracking-wider whitespace-nowrap"
          style={{
            left: `${w.left}%`,
            top: `${w.top}%`,
            fontSize: w.size,
            color: w.color,
            opacity: w.opacity,
            transform: `rotate(${w.rotate}deg)`,
            textShadow: `0 0 8px ${w.glow}`,
            animation: `reflectionFloat ${w.duration}s ease-in-out ${w.delay}s infinite`,
          }}
        >
          ОТРАЖЕНИЕ
        </div>
      ))}
      <style>{`
        @keyframes reflectionFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.1; }
          50% { transform: translateY(-20px) rotate(5deg); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
