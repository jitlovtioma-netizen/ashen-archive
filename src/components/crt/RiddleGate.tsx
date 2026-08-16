"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

interface RiddleGateProps {
  recordName: string;
  onSolved: () => void;
  onCancel: () => void;
}

const RIDDLES: Record<string, {
  sigil: string;
  title: string;
  subtitle: string;
  riddle: string[];
  valid: string[];
  hint: string;
}> = {
  "Разум Бруно": {
    sigil: "🧠",
    title: "РАЗУМ БРУНО",
    subtitle: "// локация · искажена //",
    riddle: [
      "Что без крыльев летит,",
      "Без ног бежит,",
      "Без огня жжёт,",
      "А глазам не верит?",
    ],
    valid: ["обман", "обман.", "обман,"],
    hint: "// разгадай загадку, чтобы открыть локацию //",
  },
};

export function RiddleGate({ recordName, onSolved, onCancel }: RiddleGateProps) {
  const { solveRiddle, solvedRiddles, unlockAchievement, pushToast } = useArchive();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);

  const riddle = RIDDLES[recordName];
  if (!riddle) return null;

  // Если уже разгадана — пропускаем
  if (solvedRiddles.includes(recordName)) {
    onSolved();
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = answer.trim().toLowerCase();
    if (riddle.valid.includes(normalized)) {
      solveRiddle(recordName);
      sfx.unlock();
      pushToast({
        kind: "secret",
        sigil: "🎯",
        title: "ЗАГАДКА РАЗГАДАНА",
        body: "Доступ открыт.",
      });
      onSolved();
    } else {
      setError(true);
      sfx.error();
      setTimeout(() => setError(false), 2000);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9700] flex items-center justify-center p-4"
      style={{
        background: "rgba(2, 0, 2, 0.9)",
        backdropFilter: "blur(3px)",
      }}
      onClick={onCancel}
    >
      <div
        className="panel clip-hud brackets w-full max-w-lg p-6 fade-in"
        style={{
          boxShadow: "0 0 40px rgba(167, 139, 250, 0.3)",
          animation: "modalIn 0.3s ease-out forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="led led-amber" />
          <span className="text-[10px] text-dim tracking-widest ml-2">
            {"// ПЕЧАТЬ_ЗАГАДКИ //"}
          </span>
          <span className="flex-1" />
          <button
            onClick={onCancel}
            className="btn-crt btn-red clip-hud-sm px-2 py-0.5 text-[11px]"
          >
            ✕
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="text-4xl glow-violet mb-2 pulse-slow">{riddle.sigil}</div>
          <div className="font-medieval text-xl glow-violet tracking-wider">
            {riddle.title}
          </div>
          <div className="text-[10px] text-dim tracking-widest mt-1">
            {riddle.subtitle}
          </div>
        </div>

        <div className="panel-inset p-4 mb-4 border-l-2 border-[var(--violet)]">
          <div className="text-[10px] glow-violet tracking-widest mb-2">
            ⟁ ЗАГАДКА
          </div>
          <div className="text-[13px] text-[var(--text)] leading-relaxed italic space-y-1">
            {riddle.riddle.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] glow-violet tracking-widest mb-1.5">
              {"> ОТВЕТ:"}
            </label>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
              className={`w-full bg-[var(--bg-deep)] border px-3 py-2 text-sm text-[var(--green)] focus:outline-none transition-all font-mono-crt clip-hud-sm ${
                error
                  ? "border-[var(--red)] shadow-[0_0_10px_rgba(255,36,36,0.4)] animate-pulse"
                  : "border-[var(--line-bright)] focus:border-[var(--violet)] focus:shadow-[0_0_10px_rgba(167,139,250,0.3)]"
              }`}
              placeholder="впиши ответ..."
              disabled={error}
            />
          </div>

          {error && (
            <div className="text-center glow-red text-sm glitch" data-text="НЕВЕРНО">
              [ НЕВЕРНО — попробуй снова ]
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-crt btn-amber clip-hud-sm flex-1 py-2 text-xs"
            >
              🔑 ОТВЕТИТЬ
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="btn-crt clip-hud-sm px-4 py-2 text-xs"
            >
              ✕ ОТМЕНА
            </button>
          </div>
        </form>

        <div className="text-[9px] text-dim mt-4 text-center tracking-wider">
          {riddle.hint}
        </div>
      </div>
    </div>,
    document.body
  );
}
