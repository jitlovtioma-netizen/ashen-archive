"use client";

import { createPortal } from "react-dom";
import { useArchive } from "@/lib/store";
import { useState } from "react";
import type { GameSystem } from "@/lib/types";

/**
 * WorldFlash — полноэкранная анимация при переключении между мирами
 * (DND ↔ PF2E). Показывает radial flash + название нового мира.
 */
export function WorldFlash() {
  const worldFlash = useArchive((s) => s.worldFlash);
  const user = useArchive((s) => s.user);
  const [mounted] = useState(() => typeof document !== "undefined");

  if (!mounted || !worldFlash || !user) return null;
  if (typeof document === "undefined") return null;

  const system: GameSystem = user.system;
  const worldName = system === "DND" ? "ЭЛАРИЯ" : "ГОЛАРИОН";
  const color = system === "DND" ? "var(--red)" : "var(--cyan)";

  return createPortal(
    <div
      className="fixed inset-0 z-[9700] pointer-events-none flex items-center justify-center"
      aria-hidden
    >
      <div className="world-flash" />
      <div
        className="absolute font-medieval text-5xl md:text-7xl tracking-[0.2em]"
        style={{
          color,
          textShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
          animation: "worldFlashText 0.9s ease-out forwards",
        }}
      >
        {worldName}
      </div>
      <style>{`
        @keyframes worldFlashText {
          0% { opacity: 0; transform: scale(0.5); letter-spacing: 0.5em; }
          30% { opacity: 1; transform: scale(1.1); letter-spacing: 0.2em; }
          60% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.2); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
