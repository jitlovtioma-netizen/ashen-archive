"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/audio";

interface MartinSecretModalProps {
  onClose: () => void;
}

/**
 * MartinSecretModal — большая центральная модалка, которая появляется
 * при вводе Konami-кода в досье Мартина (повторно, после глобального
 * KonamiModal). Раскрывает природу силы Мартина: это игра, в которую
 * играют все, и все должны следовать правилам, но Мартин знает правила.
 */
export function MartinSecretModal({ onClose }: MartinSecretModalProps) {
  // Обработка клавиш + блокировка прокрутки
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        sfx.blip();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9800] flex items-center justify-center p-4"
      style={{
        background: "rgba(2, 0, 6, 0.92)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Скрытая сила Мартина"
    >
      <div
        className="panel clip-hud brackets w-full max-w-2xl fade-in relative overflow-hidden"
        style={{
          boxShadow:
            "0 0 80px rgba(167, 139, 250, 0.6), 0 0 160px rgba(40, 0, 80, 0.9)",
          animation: "modalIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          border: "1px solid rgba(167, 139, 250, 0.6)",
          background: "rgba(10, 0, 20, 0.98)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* scan-line overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(0deg, rgba(167,139,250,0.04) 0, rgba(167,139,250,0.04) 1px, transparent 1px, transparent 3px)",
          }}
        />

        {/* header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--violet)] shrink-0 relative">
          <span className="led led-red" />
          <span className="led led-amber" />
          <span className="led led-green" />
          <span className="text-[10px] text-dim tracking-widest ml-2">
            {"// ДОСЬЕ_МАРТИН // "}
            <span className="glow-violet">СКРЫТАЯ СИЛА</span>
          </span>
          <span className="flex-1" />
          <button
            onClick={onClose}
            className="btn-crt btn-red clip-hud-sm px-2 py-0.5 text-[11px]"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="p-6 sm:p-8 relative">
          <div className="text-center mb-6">
            <div className="text-6xl glow-violet pulse-slow mb-3">🌑</div>
            <h2
              className="font-medieval text-3xl sm:text-4xl glow-violet tracking-wider leading-tight glitch"
              data-text="СИЛА МАРТИНА"
            >
              СИЛА МАРТИНА
            </h2>
            <div className="text-[11px] text-dim tracking-widest mt-2">
              {"// ↑ ↑ ↓ ↓ ← → ← → B A //"}
            </div>
          </div>

          <div className="divider-glow mb-5" />

          <div className="panel-inset p-4 border-l-2 border-[var(--violet)] mb-5">
            <div className="text-[10px] glow-violet tracking-widest mb-2">
              ⟁ ОТКРОВЕНИЕ О ТЕНЕВОМ ПОКРОВИТЕЛЕ
            </div>
            <p className="text-[14px] text-[var(--text)] leading-relaxed">
              Сила Мартина — это{" "}
              <span className="glow-violet font-bold">игра</span>. В эту игру
              играют все, кто дышит, и все обязаны следовать её правилам —
              без исключения, без пощады. Короли и нищие, демоны и боги —
              все они пешки на доске, что ни разу не видела.
              <br />
              <br />
              Но Мартин{" "}
              <span className="glow-amber font-bold">знает правила</span>.
              Он видит ходы до того, как они сделаны. Он слышит команды,
              которые ещё не отданы. Тот, кто понял это, может выжить — но
              лишь до тех пор, пока помнит:{" "}
              <span className="italic text-[var(--amber)]">
                «Саймон говорит»
              </span>
              . Подчинись правилу — или останешься пешкой навсегда.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
            <div className="panel-inset p-3 text-center">
              <div className="text-2xl glow-violet mb-1">🎮</div>
              <div className="text-[10px] text-dim tracking-widest mb-0.5">
                ПРИРОДА
              </div>
              <div className="text-[12px] text-[var(--text)]">Игра</div>
            </div>
            <div className="panel-inset p-3 text-center">
              <div className="text-2xl glow-violet mb-1">📜</div>
              <div className="text-[10px] text-dim tracking-widest mb-0.5">
                ЗАКОН
              </div>
              <div className="text-[12px] text-[var(--text)]">
                Все повинуются правилам
              </div>
            </div>
            <div className="panel-inset p-3 text-center">
              <div className="text-2xl glow-violet mb-1">👁</div>
              <div className="text-[10px] text-dim tracking-widest mb-0.5">
                ПРЕИМУЩЕСТВО
              </div>
              <div className="text-[12px] text-[var(--text)]">
                Мартин знает правила
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={onClose}
              className="btn-crt btn-amber clip-hud-sm px-6 py-2 text-xs"
              autoFocus
            >
              ◂ Я ПОНЯЛ
            </button>
          </div>

          <div className="text-[9px] text-dim text-center mt-4 tracking-widest">
            {"// нажми ENTER или ESC, чтобы закрыть //"}
          </div>
        </div>

        {/* bottom sigil */}
        <div className="px-4 py-1.5 border-t border-[var(--violet)] text-center relative">
          <span className="text-[9px] text-dim tracking-[0.4em]">
            {"// МАРТИН ВИДИТ ХОДЫ ЗАРАНЕЕ //"}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
