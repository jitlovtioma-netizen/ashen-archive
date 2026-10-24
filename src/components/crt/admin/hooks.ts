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

/** seed.zip: статус, скачивание по подписанной ссылке и пересборка. */
export function useSeedArchive(user: User, pushToast: PushToast) {
  // v5.7.1 — seed.zip: весь проект одним файлом (исходники + база + доки)
  // для развёртывания вручную. В песочнице архив фантомно исчезает при
  // снапшот-ресторах — потому кнопка в тулбаре проверяет наличие (HEAD
  // /seed.zip) и умеет пересобирать его прямо из браузера (API make-seed).
  const [seedState, setSeedState] = useState<"checking" | "ready" | "missing" | "error">("checking");
  const [seedSize, setSeedSize] = useState(0);
  const [seedBusy, setSeedBusy] = useState(false);

  // v5.7.1 — проверить доступность seed.zip. Файл живёт в seed-archive/
  // (НЕ в public/: dev-вотчер Next.js стирал его оттуда — «фантом»),
  // поэтому статус спрашиваем у API, а не у статики
  const checkSeedZip = useCallback(() => {
    if (!user) return;
    setSeedState("checking");
    fetch(`/api/admin/make-seed`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.ok && d.exists) {
          if (typeof d.size === "number" && d.size > 0) setSeedSize(d.size);
          setSeedState("ready");
        } else if (d && d.ok) {
          setSeedState("missing");
        } else {
          setSeedState("error");
        }
      })
      .catch(() => setSeedState("error"));
  }, [user]);

  useEffect(() => {
    checkSeedZip();
  }, [checkSeedZip]);

  // v5.7.4 — пульс статуса архива (30с): если seed.zip пересобрали извне
  // (ssh, ensure-seed при старте dev, другой страж), кнопка «⇩» сама
  // подтянет свежий размер. Спит в скрытой вкладке; «checking» не
  // выставляем — лейбл не мигает; во время своей пересборки лейбл всё
  // равно занят «⟳ СОБИРАЮ…» (seedBusy), а статус-чтение read-only
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/admin/make-seed`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.ok && d.exists) {
            if (typeof d.size === "number" && d.size > 0) setSeedSize(d.size);
            setSeedState("ready");
          } else if (d && d.ok) {
            setSeedState("missing");
          }
        })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [user]);

  // v5.7.1 — скачивание: подписанная ссылка (только админам, 15 минут),
  // файл приходит аттачментом через blob — без ухода со страницы
  const downloadSeedZip = useCallback(async () => {
    if (!user || seedBusy) return;
    setSeedBusy(true);
    try {
      const res = await fetch(
        `/api/admin/make-seed?issue=1`,
      );
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.hint ?? d.error ?? `HTTP ${res.status}`);
      const fileRes = await fetch(d.url as string);
      if (!fileRes.ok) {
        const err = await fileRes.json().catch(() => null);
        throw new Error(err?.hint ?? `HTTP ${fileRes.status}`);
      }
      const blob = await fileRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "seed.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      pushToast({
        kind: "info",
        sigil: "⇩",
        title: "АРХИВ УХОДИТ К ВАМ",
        body: `seed.zip · ${(blob.size / 1024).toFixed(0)} КБ — исходники, база, доки одним файлом.`,
      });
    } catch (e) {
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "АРХИВ НЕ ДОСТУПЕН",
        body: String((e as Error).message || e),
      });
    } finally {
      setSeedBusy(false);
    }
  }, [user, seedBusy, pushToast]);

  // v5.7.1 — пересобрать seed.zip прямо из браузера (фантом исчез —
  // кнопка «⟳» поднимает архив без ssh и ручных команд)
  const buildSeedZip = useCallback(async () => {
    if (!user || seedBusy) return;
    setSeedBusy(true);
    try {
      const res = await fetch("/api/admin/make-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.hint ?? d.error ?? `HTTP ${res.status}`);
      if (typeof d.size === "number" && d.size > 0) setSeedSize(d.size);
      pushToast({
        kind: "info",
        sigil: "⇩",
        title: "АРХИВ СОБРАН",
        body: `seed.zip · ${d.files ? `${d.files} файлов · ` : ""}${(d.size / 1024).toFixed(0)} КБ — готов к скачиванию.`,
      });
      checkSeedZip();
    } catch (e) {
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "АРХИВ НЕ СОБРАЛСЯ",
        body: String((e as Error).message || e),
      });
      setSeedState("error");
    } finally {
      setSeedBusy(false);
    }
  }, [user, seedBusy, pushToast, checkSeedZip]);

  return { seedState, seedSize, seedBusy, downloadSeedZip, buildSeedZip };
}
