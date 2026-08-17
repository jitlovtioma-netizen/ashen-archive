"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

/**
 * Большая центральная табличка, которая появляется при вводе Konami-кода.
 * Не путать с маленьким тостом справа сверху — это отдельный полноэкранный модал.
 *
 * Состояние хранится в store (konamiUnlocked + konamiModalDismissed),
 * сбрасывается при login. Это позволяет избежать useState в useEffect.
 */
export function KonamiModal() {
  const konamiUnlocked = useArchive((s) => s.konamiUnlocked);
  const dismissed = useArchive((s) => s.konamiModalDismissed);
  const setDismissed = useArchive((s) => s.setKonamiModalDismissed);

  const open = konamiUnlocked && !dismissed;

  // Воспроизведение звука при открытии (один раз)
  useEffect(() => {
    if (open) {
      sfx.gaze();
    }
  }, [open]);

  const close = () => {
    sfx.blip();
    setDismissed(true);
  };

  // Обработка клавиш + блокировка прокрутки
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9900] flex items-center justify-center p-4"
      style={{
        background: "rgba(2, 0, 6, 0.92)",
        backdropFilter: "blur(6px)",
      }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Konami код принят"
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
            {"// ПРОТОКОЛ_СОКРЫТОГО // "}
            <span className="glow-violet">КОД ПРИНЯТ</span>
          </span>
          <span className="flex-1" />
          <button
            onClick={close}
            className="btn-crt btn-red clip-hud-sm px-2 py-0.5 text-[11px]"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="p-6 sm:p-8 relative">
          <div className="text-center mb-6">
            <div className="text-6xl glow-violet pulse-slow mb-3">🎮</div>
            <h2
              className="font-medieval text-3xl sm:text-4xl glow-violet tracking-wider leading-tight glitch"
              data-text="КОД ПРИНЯТ"
            >
              КОД ПРИНЯТ
            </h2>
            <div className="text-[11px] text-dim tracking-widest mt-2">
              {"// ↑ ↑ ↓ ↓ ← → ← → B A //"}
            </div>
          </div>

          <div className="divider-glow mb-5" />

          <div className="panel-inset p-4 border-l-2 border-[var(--violet)] mb-5">
            <div className="text-[10px] glow-violet tracking-widest mb-2">
              ⟁ СОКРЫТОЕ ОТКРОВЕНИЕ
            </div>
            <p className="text-[14px] text-[var(--text)] leading-relaxed">
              Ты принял код. Скрытая сила пробудилась.
              <br />
              <br />
              Теперь, когда войдёшь в досье{" "}
              <span className="glow-violet font-bold">Мартина</span>, повторно
              введи этот же код — и тайна, сокрытая под печатью, откроется тебе.
              <br />
              <br />
              <span className="italic text-[var(--amber)]">
                Но помни: не всё, что сокрыто, должно быть открыто.
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
            <div className="panel-inset p-3 text-center">
              <div className="text-2xl glow-violet mb-1">🎯</div>
              <div className="text-[10px] text-dim tracking-widest mb-0.5">
                ЦЕЛЬ
              </div>
              <div className="text-[12px] text-[var(--text)]">Досье Мартина</div>
            </div>
            <div className="panel-inset p-3 text-center">
              <div className="text-2xl glow-violet mb-1">🔓</div>
              <div className="text-[10px] text-dim tracking-widest mb-0.5">
                ДЕЙСТВИЕ
              </div>
              <div className="text-[12px] text-[var(--text)]">
                Повторить Konami
              </div>
            </div>
            <div className="panel-inset p-3 text-center">
              <div className="text-2xl glow-violet mb-1">👁</div>
              <div className="text-[10px] text-dim tracking-widest mb-0.5">
                РЕЗУЛЬТАТ
              </div>
              <div className="text-[12px] text-[var(--text)]">Скрытая сила</div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={close}
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
            {"// АРХИВ ПЕПЕЛЬНОЙ ДЛАНИ — ХОЗЯИН ВИДИТ ТЕБЯ //"}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
