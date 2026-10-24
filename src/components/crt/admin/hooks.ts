"use client";

import { useCallback, useEffect, useState } from "react";
import { sfx } from "@/lib/audio";
import type { useArchive } from "@/lib/store";
import { getWatchdogStats, runWatchdogScanNow } from "../OverlayWatchdog";

type ArchiveState = ReturnType<typeof useArchive.getState>;
type PushToast = ArchiveState["pushToast"];
type User = ArchiveState["user"];

/** Пульс сторожа оверлеев + внеплановый осмотр (блок «⌁ ДИАГНОСТИКА АРХИВА»). */
export function useDiagnostics(pushToast: PushToast) {
  // v5.7.3 — «диагностика архива»: пульс сторожа оверлеев + здоровье вкладки
  const [diag, setDiag] = useState<{
    neutralized: number;
    scans: number;
    lastScanAgoMs: number;
    centerHijacked: boolean;
    domNodes: number;
  } | null>(null);

  // v5.7.3 — диагностика: пульс сторожа + клик-просвет центра экрана.
  // Обновляем пачкой каждые 5с, пока вкладка жива (не только на рендере).
  const refreshDiag = useCallback(() => {
    const st = getWatchdogStats();
    // клик-просвет: что лежит в центре экрана по хит-тесту. Если сверху
    // невидимый fixed-элемент — центр «угнан». (Сторож его уже обезвредил
    // или обезредит — здесь мы только показываем состояние.)
    const el = document.elementFromPoint(
      Math.round(window.innerWidth / 2),
      Math.round(window.innerHeight / 2),
    );
    let centerHijacked = false;
    if (el instanceof HTMLElement) {
      const cs = getComputedStyle(el);
      const z = Number.parseFloat(cs.zIndex);
      centerHijacked =
        cs.position === "fixed" &&
        Number.isFinite(z) &&
        z >= 5000 &&
        Number.parseFloat(cs.opacity) < 0.03;
    }
    setDiag({
      neutralized: st.neutralized,
      scans: st.scans,
      lastScanAgoMs: st.lastScanAgoMs,
      centerHijacked,
      domNodes: document.querySelectorAll("*").length,
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) refreshDiag();
    }, 5000);
    return () => clearInterval(id);
  }, [refreshDiag]);

  // внеплановый осмотр: кнопка в сводке — прогон сторожа + отчёт
  const runDiagnostics = useCallback(() => {
    sfx.beep();
    const killed = runWatchdogScanNow();
    refreshDiag();
    pushToast({
      kind: killed > 0 ? "warn" : "info",
      sigil: killed > 0 ? "⌁" : "✔",
      title: killed > 0 ? "ОБНАРУЖЕНЫ ПРИЗРАКИ" : "ОСМОТР ЧИСТ",
      body:
        killed > 0
          ? `Сторож обезвредил ${killed} невидимых блокировщиков кликов.`
          : "Невидимых блокировщиков кликов не найдено.",
    });
  }, [pushToast, refreshDiag]);

  return { diag, runDiagnostics };
}
