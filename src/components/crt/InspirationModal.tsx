"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/audio";
import type { GameSystem } from "@/lib/types";

interface InspirationModalProps {
  system: GameSystem;
  onClose: () => void;
}

type Phase = "code" | "input" | "success";

export function InspirationModal({ system, onClose }: InspirationModalProps) {
  const [phase, setPhase] = useState<Phase>("code");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sfx.blip();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const isDND = system === "DND";
  const codeForPartner = isDND ? "13.09 DS" : "27.09 TG";
  const partnerSystem = isDND ? "PF2e" : "DnD";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = answer.trim().toLowerCase();
    if (normalized === "соносфера" || normalized === "соносфера.") {
      sfx.unlock();
      setPhase("success");
    } else {
      setError(true);
      sfx.error();
      setTimeout(() => setError(false), 2000);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9800] flex items-center justify-center p-4"
      style={{ background: "rgba(2, 0, 2, 0.92)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Получить вдохновение"
    >
      <div
        className="panel clip-hud brackets w-full max-w-lg p-6 sm:p-8 fade-in"
        style={{
          boxShadow: "0 0 40px rgba(232, 161, 58, 0.25)",
          animation: "modalIn 0.3s ease-out forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="led led-amber" />
          <span className="led led-green" />
          <span className="led led-red" />
          <span className="text-[10px] text-dim tracking-widest ml-2 truncate">
            {"// ПРОТОКОЛ_ВДОХНОВЕНИЕ //"}
          </span>
          <span className="flex-1" />
          <button onClick={onClose} className="btn-crt btn-red clip-hud-sm px-2 py-0.5 text-[11px]">
            ✕ ЗАКРЫТЬ
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💡</div>
          <h2 className="font-medieval text-xl glow-amber tracking-wider">
            ПОЛУЧИТЬ ВДОХНОВЕНИЕ
          </h2>
        </div>

        {/* Phase 1: Code message */}
        {phase === "code" && (
          <div className="space-y-4">
            <div className="panel-inset p-4 text-center">
              <div className="text-[10px] text-dim tracking-widest mb-3">
                {"// КОД ДЛЯ НАПАРНИКА //"}
              </div>
              <div className="text-[15px] text-[var(--text)] leading-relaxed mb-3">
                Обратитесь к напарнику из <span className="glow-amber font-bold">{partnerSystem}</span>
                {" "}и предъявите ему код:
              </div>
              <div
                className="font-mono text-2xl glow-amber tracking-widest py-3 px-4 rounded"
                style={{
                  background: "rgba(232, 161, 58, 0.1)",
                  border: "1px solid rgba(232, 161, 58, 0.3)",
                  textShadow: "0 0 12px rgba(232, 161, 58, 0.5)",
                }}
              >
                {codeForPartner}
              </div>
            </div>
            <div className="text-[11px] text-dim text-center leading-relaxed">
              {"// также вы можете ввести код, полученный от напарника //"}
            </div>
            <button
              onClick={() => {
                sfx.select();
                setPhase("input");
              }}
              className="btn-crt btn-amber clip-hud-sm w-full py-2 text-xs"
            >
              ▸ ВВЕСТИ КОД
            </button>
          </div>
        )}

        {/* Phase 2: Code input */}
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="panel-inset p-4">
              <div className="text-[10px] text-dim tracking-widest mb-2">
                {"// ВВЕДИТЕ КОД ОТ НАПАРНИКА //"}
              </div>
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                autoFocus
                className={`w-full bg-[var(--bg-deep)] border px-3 py-2 text-sm text-[var(--green)] focus:outline-none transition-all font-mono-crt clip-hud-sm ${
                  error
                    ? "border-[var(--red)] shadow-[0_0_10px_rgba(255,36,36,0.4)] animate-pulse"
                    : "border-[var(--line-bright)] focus:border-[var(--amber)] focus:shadow-[0_0_10px_rgba(232,161,58,0.3)]"
                }`}
                placeholder="код от напарника..."
                disabled={error}
              />
              {error && (
                <div className="text-center glow-red text-sm mt-2">
                  [ НЕВЕРНЫЙ КОД — попробуйте снова ]
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-crt btn-amber clip-hud-sm flex-1 py-2 text-xs">
                🔑 ПРОВЕРИТЬ
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.blip();
                  setPhase("code");
                  setAnswer("");
                  setError(false);
                }}
                className="btn-crt clip-hud-sm px-4 py-2 text-xs"
              >
                ◂ НАЗАД
              </button>
            </div>
          </form>
        )}

        {/* Phase 3: Success */}
        {phase === "success" && (
          <div className="space-y-4 text-center">
            <div
              className="panel-inset p-6"
              style={{
                borderColor: "var(--amber-dim)",
                boxShadow: "0 0 20px rgba(232, 161, 58, 0.2)",
                animation: "modalIn 0.5s ease-out forwards",
              }}
            >
              <div className="text-5xl mb-3 pulse-slow">✨</div>
              <div className="font-medieval text-lg glow-amber tracking-wider mb-4">
                КОД ПРИНЯТ
              </div>
              <div className="text-[15px] text-[var(--text)] leading-relaxed mb-2">
                Отправьте скриншот этой записи
              </div>
              <div className="text-[15px] text-[var(--text)] leading-relaxed mb-4">
                вместе со своим напарником <span className="glow-amber font-bold">одновременно в ЛС мастеру</span>.
              </div>
              <div className="text-[10px] text-dim tracking-widest mt-4">
                {"// СОНОСФЕРА АКТИВИРОВАНА //"}
              </div>
            </div>
            <button
              onClick={() => {
                sfx.blip();
                onClose();
              }}
              className="btn-crt clip-hud-sm px-6 py-2 text-xs"
            >
              ◂ ЗАКРЫТЬ
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
