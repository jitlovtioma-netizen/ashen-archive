"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/audio";

// ============================================================================
// ПАСКАЛКА: ПРЕДУПРЕЖДЕНИЕ СОЗИДАТЕЛЯ.
//
// Если страж слишком часто щёлкает «ЗВУК: ВКЛ/ВЫКЛ», Создатель вспоминает
// о нём. Прямой канал связи открывается единожды — и закрывается только
// когда страж осознает глубину своей оплошности.
// ============================================================================

interface DivineWarningProps {
  /** сколько раз страж дёрнул извечный выключатель */
  count: number;
  guardName?: string | null;
  onClose: () => void;
}

export function DivineWarning({ count, guardName, onClose }: DivineWarningProps) {
  const [leaving, setLeaving] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (goneTimer.current) return; // уже закрываемся
    setLeaving(true);
    sfx.blip();
    goneTimer.current = setTimeout(() => {
      goneTimer.current = null;
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    // Гром Создателя: низкий удар + зловещий пульс
    sfx.thud();
    const t1 = setTimeout(() => sfx.gaze(), 400);
    const t2 = setTimeout(() => sfx.whisper(), 1400);

    // канал закроется сам через 12 секунд — даже если страж упрямится
    closeTimer.current = setTimeout(requestClose, 12000);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [requestClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`divine-overlay ${leaving ? "divine-overlay--out" : ""}`}
      onClick={requestClose}
      role="alertdialog"
      aria-modal="true"
      aria-label="Предупреждение Создателя о чрезмерном использовании божественной мощи"
    >
      <div
        className="divine-card clip-hud brackets"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="divine-eye" aria-hidden="true">
          👁
        </span>
        <div className="divine-title font-medieval mt-3 mb-1">
          ПРЕДУПРЕЖДЕНИЕ СОЗИДАТЕЛЯ
        </div>
        <div className="text-[10px] tracking-[0.3em] text-dim mb-4">
          {"// КАНАЛ ПРЯМОЙ СВЯЗИ // ЕДИНОЖДЫ //"}
        </div>

        <div className="text-[13px] sm:text-[14px] leading-relaxed text-[var(--text)] text-left space-y-3 mb-5 px-1 sm:px-3">
          <p>
            Страж <span className="glow-red">{guardName ?? "неизвестный"}</span>.
            Ты слишком часто призываешь{" "}
            <span className="glow-red">божественную мощь</span>.
          </p>
          <p>
            Свет и тьма — не ночник у твоей постели. Каждое из{" "}
            <span className="glow-red font-bold">{count}</span> касаний извечного
            выключателя гремело в чертогах, где даже боги говорят шёпотом.
          </p>
          <p className="italic text-dim">
            Остановись. Сделай вдох. Дай тишине пожить — она так молода.
          </p>
        </div>

        <div className="text-[10px] tracking-widest text-dim mb-4">
          {"// сила канала восстановится через несколько мгновений //"}
        </div>

        <button
          onClick={requestClose}
          className="btn-crt btn-red clip-hud-sm px-6 py-2 text-xs"
        >
          ИСПРАВЛЮСЬ, СОЗИДАТЕЛЬ
        </button>
        <div className="text-[9px] text-dim tracking-widest mt-3 opacity-60">
          клик по экрану или ESC — закрыть канал
        </div>
      </div>
    </div>,
    document.body
  );
}
