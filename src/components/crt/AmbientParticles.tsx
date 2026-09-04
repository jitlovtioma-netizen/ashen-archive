"use client";

import { useState, type CSSProperties } from "react";

/**
 * AmbientParticles — фоновые плавающие частицы для атмосферы CRT.
 * Лёгкие зелёные точки, дрейфующие в основном viewport.
 * pointer-events: none, не мешает交互.
 */

interface Particle {
  id: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
}

// Готовый набор частиц (детерминированный — без SSR-несоответствий)
const PARTICLES: Particle[] = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  left: (i * 37 + 13) % 100,
  top: (i * 61 + 7) % 100,
  delay: (i * 0.7) % 8,
  duration: 6 + ((i * 1.3) % 6),
}));

export function AmbientParticles({ count = 10 }: { count?: number }) {
  const [particles] = useState<Particle[]>(PARTICLES.slice(0, count));

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden
      style={{ zIndex: 0 } satisfies CSSProperties}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="ambient-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
