"use client";

import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

const KIND_STYLE: Record<
  string,
  { border: string; glow: string; label: string }
> = {
  ach: { border: "var(--amber-dim)", glow: "glow-amber", label: "ДОСТИЖЕНИЕ" },
  secret: {
    border: "rgba(167,139,250,0.5)",
    glow: "glow-violet",
    label: "СОКРЫТОЕ",
  },
  warn: { border: "var(--red-dim)", glow: "glow-red", label: "ПРЕДУПРЕЖДЕНИЕ" },
  info: { border: "var(--green-dim)", glow: "glow-green", label: "СООБЩЕНИЕ" },
};

export function AchievementToaster() {
  const toasts = useArchive((s) => s.toasts);
  const dismissToast = useArchive((s) => s.dismissToast);

  return (
    <div className="fixed top-3 right-3 z-[9500] flex flex-col gap-2 max-w-[min(92vw,360px)]">
      {toasts.map((t) => {
        const st = KIND_STYLE[t.kind] ?? KIND_STYLE.info;
        return (
          <div
            key={t.id}
            className="ach-toast panel clip-hud-sm p-3 flex gap-3 items-start cursor-pointer"
            style={{ borderColor: st.border }}
            onClick={() => {
              sfx.blip();
              dismissToast(t.id);
            }}
            role="alert"
          >
            <span className={`text-2xl leading-none ${st.glow}`}>
              {t.sigil}
            </span>
            <div className="flex-1 min-w-0">
              <div
                className={`text-[10px] tracking-widest ${st.glow} mb-0.5`}
              >
                {st.label}
              </div>
              <div className="font-medieval text-sm leading-tight glow-green">
                {t.title}
              </div>
              {t.body && (
                <div className="text-[11px] text-dim mt-1 leading-relaxed">
                  {t.body}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
