"use client";

import { useArchive } from "@/lib/store";

export function WitchingBanner() {
  const witching = useArchive((s) => s.witching);
  if (!witching) return null;

  const now = new Date();
  const next = new Date(now);
  // next 03:00
  if (now.getHours() >= 3) next.setDate(next.getDate() + 1);
  next.setHours(3, 0, 0, 0);

  return (
    <div
      className="fixed top-20 right-3 z-[9400] max-w-[min(92vw,300px)] panel clip-hud-sm p-3"
      style={{
        borderColor: "rgba(167,139,250,0.5)",
        boxShadow: "0 0 20px rgba(167,139,250,0.25)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl glow-violet">🌙</span>
        <span className="font-medieval text-sm glow-violet tracking-wider">
          ЧАС ВЕДЬМЫ
        </span>
      </div>
      <div className="text-[11px] text-[var(--text)] leading-relaxed mb-2">
        Созидатель смотрит пристальнее. Ткань архива истончается.
      </div>
      <div className="text-[10px] text-dim tracking-wider border-t border-[var(--line)] pt-2">
        {"// ПЕРИОД: 03:00–04:00 МСК"}
        <br />{"// +15% ВЗГЛЯД"}
      </div>
    </div>
  );
}
