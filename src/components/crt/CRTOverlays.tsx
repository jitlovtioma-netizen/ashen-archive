"use client";

import { useWorld } from "@/lib/world";

// Позиции пылинок фиксированы (без Math.random) — одинаково на сервере и клиенте
const MOTES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: -((i * 7.3) % 22),
  duration: 16 + ((i * 5) % 14),
  size: 2 + (i % 3),
  drift: ((i % 5) - 2) * 18,
}));

export function CRTOverlays() {
  const world = useWorld();

  // Хроника Эларии: свечной свет, зерно пергамента, золотая пыль
  if (world === "dnd") {
    return (
      <>
        <div className="tale-overlay tale-glow" aria-hidden />
        <div className="tale-overlay tale-grain" aria-hidden />
        <div className="tale-overlay tale-vignette" aria-hidden />
        <div className="tale-overlay tale-motes" aria-hidden>
          {MOTES.map((m, i) => (
            <span
              key={i}
              style={{
                left: `${m.left}%`,
                width: m.size,
                height: m.size,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.duration}s`,
                ["--drift" as string]: `${m.drift}px`,
              }}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="crt-overlay crt-scanlines" aria-hidden />
      <div className="crt-overlay crt-vignette" aria-hidden />
      <div className="crt-overlay crt-noise" aria-hidden />
      <div className="crt-overlay crt-flicker" aria-hidden />
    </>
  );
}
