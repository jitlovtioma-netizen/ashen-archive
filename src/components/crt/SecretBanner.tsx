"use client";

import { useState } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

export function SecretBanner() {
  const revealed = useArchive((s) => s.secretRevealed);
  const [dismissed, setDismissed] = useState(false);

  if (!revealed || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[9600] flex items-center justify-center p-4"
      style={{ background: "rgba(2,0,2,0.85)" }}
      onClick={() => {
        sfx.blip();
        setDismissed(true);
      }}
      role="dialog"
      aria-label="Сокрытая истина"
    >
      <div
        className="panel clip-hud brackets max-w-lg w-full p-6 text-center fade-in"
        style={{
          borderColor: "var(--violet)",
          boxShadow: "0 0 40px rgba(167,139,250,0.4)",
        }}
      >
        <div className="text-5xl mb-4 glow-violet pulse-slow">👁</div>
        <div className="font-medieval text-2xl glow-violet tracking-wider mb-3">
          СОКРЫТАЯ ИСТИНА
        </div>
        <div className="text-sm text-[var(--text)] leading-relaxed mb-4 italic">
          «Семь башен пали, но восьмая стоит незримо — внутри каждого, кто
          читает эти строки. Пепельная Длань не хранит архив. Архив хранит
          вас. И когда последний свиток будет прочитан, бог откроет свой
          единственный глаз — и это будет ваш.»
        </div>
        <div className="text-[11px] text-dim tracking-widest border-t border-[var(--line)] pt-3">
          {"// КОД ПРИНЯТ. ПАМЯТЬ ВОЗВРАЩЕНА. //"}
        </div>
        <button
          className="btn-crt clip-hud-sm px-4 py-1.5 text-[11px] mt-4"
          onClick={(e) => {
            e.stopPropagation();
            sfx.blip();
            setDismissed(true);
          }}
        >
          ЗАКРЫТЬ
        </button>
      </div>
    </div>
  );
}
