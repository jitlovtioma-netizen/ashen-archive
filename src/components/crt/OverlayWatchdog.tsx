"use client";

import { useEffect } from "react";

// ============================================================================
// OVERLAY WATCHDOG — v5.7.2, «архив не молчит, когда закрыт».
//
// Фоновый сторож против класса багов «невидимый блокировщик кликов»:
// полноэкранный fixed-элемент (бэкдроп модалки) завершил анимацию закрытия
// на opacity:0 (fill both), но остался смонтированным — часы идут, звук
// играет, а нажать ничего нельзя. Именно так выглядел баг «сайт зависает
// через некоторое время использования» (RecordModal + ре-рендер родителя
// в 170мс-окне закрытия — исправлен там же в v5.7.2).
//
// Метод: раз в 4 секунды нативные хит-тесты elementsFromPoint по 5 точкам
// окна (центр + углы). В стек попадают ТОЛЬКО элементы, реально перехватывающие
// клики в этой точке (pointer-events:none в стек не входит — браузер сам их
// исключает). Если в стеке есть fixed-элемент z≥5000 с opacity < 0.03 —
// это «призрак»: невидим, но ест клики. Такого ждём 3 секунды (вдруг это
// короткая анимация закрытия) и обезвреживаем: pointer-events:none + warning.
// ============================================================================

const SCAN_INTERVAL_MS = 4000;
const STALE_MS = 3000;
const MIN_Z = 5000;
const MIN_OPACITY = 0.03;

const POINTS: Array<[number, number]> = [
  [0.5, 0.5], // центр
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8],
];

// ── v5.7.3 — статистика для панели «ДИАГНОСТИКА» в Мастерской ──
interface WatchdogStats {
  neutralized: number;
  lastScanAt: number;
  scans: number;
  lastGhosts: number;
}
const stats: WatchdogStats = {
  neutralized: 0,
  lastScanAt: 0,
  scans: 0,
  lastGhosts: 0,
};

export function getWatchdogStats(): WatchdogStats & { lastScanAgoMs: number } {
  return {
    ...stats,
    lastScanAgoMs: stats.lastScanAt ? Date.now() - stats.lastScanAt : -1,
  };
}

/** Внеплановое сканирование (кнопка в Мастерской). Возвращает число
 *  обезвреженных «призраков» в этом проходе. */
export function runWatchdogScanNow(): number {
  const before = stats.neutralized;
  scanImpl();
  return stats.neutralized - before;
}

let scanImpl: () => void = () => {};

export function OverlayWatchdog() {
  useEffect(() => {
    const firstSeen = new WeakMap<HTMLElement, number>();

    const scan = () => {
      if (document.hidden) return; // вкладка скрыта — не шумим
      const now = Date.now();
      const ghosts = new Set<HTMLElement>();

      for (const [fx, fy] of POINTS) {
        const stack = document.elementsFromPoint(
          window.innerWidth * fx,
          window.innerHeight * fy,
        );
        for (const el of stack) {
          if (!(el instanceof HTMLElement)) continue;
          const cs = getComputedStyle(el);
          if (cs.position !== "fixed") continue;
          const z = Number.parseFloat(cs.zIndex);
          if (!Number.isFinite(z) || z < MIN_Z) continue;
          const op = Number.parseFloat(cs.opacity);
          if (!Number.isFinite(op) || op >= MIN_OPACITY) continue;
          ghosts.add(el); // невидим, но перехватывает клики в этой точке
        }
      }

      stats.scans += 1;
      stats.lastScanAt = Date.now();
      stats.lastGhosts = ghosts.size;

      for (const el of ghosts) {
        const seen = firstSeen.get(el);
        if (seen === undefined) {
          firstSeen.set(el, now);
          continue;
        }
        if (now - seen < STALE_MS) continue; // ещё может быть анимацией закрытия

        // Призрак подтверждён: обезвредить и доложить.
        el.style.pointerEvents = "none";
        stats.neutralized += 1;
        console.warn(
          "[OverlayWatchdog] обезврежен невидимый блокировщик кликов:",
          el.tagName,
          el.className.toString().slice(0, 80),
          "z=" + getComputedStyle(el).zIndex,
        );
      }
    };

    scanImpl = scan; // для runWatchdogScanNow из Мастерской

    const id = setInterval(scan, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
