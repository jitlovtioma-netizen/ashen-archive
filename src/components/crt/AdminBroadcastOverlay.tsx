"use client";

import { useEffect } from "react";
import { usePresence } from "@/lib/presence";
import { sfx } from "@/lib/audio";

// Полноэкранное сообщение от администратора архива.
// Показывается всем стражам онлайн; авто-скрытие через 12 секунд.
export function AdminBroadcastOverlay() {
  const broadcast = usePresence((s) => s.broadcast);
  const setBroadcast = usePresence((s) => s.setBroadcast);

  useEffect(() => {
    if (!broadcast) return;
    sfx.gaze();
    sfx.glitch();
    const id = setTimeout(() => setBroadcast(null), 12000);
    return () => clearTimeout(id);
  }, [broadcast, setBroadcast]);

  if (!broadcast) return null;

  return (
    <div
      className="fixed inset-0 z-[9800] flex items-center justify-center p-4 broadcast-backdrop"
      role="alert"
      aria-live="assertive"
      aria-label="Сообщение администратора архива"
    >
      <div className="absolute inset-0 crt-scanlines pointer-events-none" />
      <div
        className="panel clip-hud brackets relative w-full max-w-2xl p-6 sm:p-10 text-center fade-in broadcast-panel"
        style={{
          borderColor: "var(--red-dim)",
          boxShadow: "0 0 80px rgba(220, 60, 60, 0.35), inset 0 0 60px rgba(220,60,60,0.06)",
          background: "var(--bg-deep)",
        }}
      >
        <div className="text-[10px] tracking-[0.4em] glow-red mb-3">
          {"// ВНИМАНИЕ // ГОЛОС АРХИВА //"}
        </div>

        <div className="font-medieval text-xl sm:text-2xl glow-red tracking-widest mb-6 glitch" data-text="СООБЩЕНИЕ СОЗИДАТЕЛЯ">
          СООБЩЕНИЕ СОЗИДАТЕЛЯ
        </div>

        <div className="panel-inset p-5 mb-6 text-left">
          <p className="font-vt323 text-2xl sm:text-3xl leading-snug text-[var(--text)] broadcast-text whitespace-pre-wrap break-words">
            {broadcast.message}
          </p>
        </div>

        <div className="text-[11px] text-dim tracking-widest mb-5">
          — {broadcast.from.toUpperCase()} —
        </div>

        <button
          onClick={() => setBroadcast(null)}
          className="btn-crt btn-red clip-hud-sm px-6 py-2 text-xs"
        >
          ▂ ПРИНЯТЬ И ЗАКРЫТЬ
        </button>

        <div className="text-[9px] text-dim tracking-widest mt-4">
          {"// сообщение скроется само через несколько мгновений //"}
        </div>
      </div>
    </div>
  );
}
