"use client";

import { useEffect, useState } from "react";
import { useArchive } from "@/lib/store";
import type { GameSystem, Stats } from "@/lib/types";

export function StatusBar({ system }: { system: GameSystem }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [clock, setClock] = useState("--:--:--");
  const gaze = useArchive((s) => s.gaze);
  const witching = useArchive((s) => s.witching);
  const user = useArchive((s) => s.user);

  useEffect(() => {
    fetch(`/api/stats?system=${system}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [system]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => n.toString().padStart(2, "0");
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const gazeColor =
    gaze >= 90 ? "glow-red" : gaze >= 60 ? "glow-amber" : "glow-green";

  return (
    <footer
      className="panel clip-hud-sm flex items-center gap-2 sm:gap-3 px-3 py-1.5 text-[10px] sm:text-[11px] tracking-wider overflow-x-auto crt-scroll shrink-0"
      role="contentinfo"
    >
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="led led-green" />
        <span className="glow-green">В СЕТИ</span>
      </span>
      <Sep />
      <span className="text-dim shrink-0 hidden sm:inline">
        {system === "DND" ? "ЭЛАРИЯ" : "ГОЛАРИОН"}
      </span>
      <Sep className="hidden sm:inline" />
      <span className="text-dim shrink-0">
        ЗАПИСЕЙ: <span className="glow-green">{stats?.totalRecords ?? "···"}</span>
      </span>
      <Sep />
      <span className="text-dim shrink-0">
        ФРАКЦИЙ:{" "}
        <span className="glow-amber">{stats?.breakdown.factions ?? "···"}</span>
      </span>
      <Sep className="hidden sm:inline" />
      <span className="text-dim shrink-0">
        ОПЕЧАТАНО:{" "}
        <span className="glow-amber">{stats?.sealedRecords ?? "···"}</span>
      </span>
      <Sep className="hidden md:inline" />
      <span className="text-dim shrink-0 hidden md:inline">
        ИСКАЖЕНО:{" "}
        <span className="glow-red">{stats?.corruptedRecords ?? "···"}</span>
      </span>
      {witching && (
        <>
          <Sep />
          <span className="glow-violet shrink-0">🌙 ЧАС ВЕДЬМЫ</span>
        </>
      )}
      <span className="flex-1" />
      <div className="tip-wrap shrink-0">
        <button
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "?", bubbles: true })
            );
          }}
          className="status-btn flex items-center gap-1 text-[10px] text-dim hover:text-[var(--green)] transition-colors cursor-pointer"
          aria-label="Открыть справку по клавишам"
        >
          <span className="cmdk-hint">?</span>
          <span className="hidden lg:inline">СПРАВКА</span>
        </button>
        <span className="tip-bubble">
          Справка по клавишам <kbd>?</kbd>
        </span>
      </div>
      <Sep />
      <div className="tip-wrap shrink-0">
        <button
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true })
            );
          }}
          className="status-btn flex items-center gap-1 text-[10px] text-dim hover:text-[var(--green)] transition-colors cursor-pointer"
          aria-label="Открыть быстрый поиск"
        >
          <span className="cmdk-hint">⌘K</span>
          <span className="hidden sm:inline">ПОИСК</span>
        </button>
        <span className="tip-bubble">
          Быстрый поиск <kbd>⌘K</kbd>
        </span>
      </div>
      <Sep />
      <span className="text-dim shrink-0">
        СОЗИДАТЕЛЬ: <span className={gazeColor}>{Math.round(gaze)}%</span>
      </span>
      <Sep className="hidden sm:inline" />
      <span className="text-dim shrink-0 hidden sm:inline truncate max-w-[120px]">
        {user?.login ?? "страж_07"}
      </span>
      <Sep />
      <span className="glow-green shrink-0 font-vt323 text-sm status-clock">
        <span className="status-tick">▸</span>{clock}
      </span>
    </footer>
  );
}

function Sep({ className = "" }: { className?: string }) {
  return <span className={`text-dim opacity-40 ${className}`}>|</span>;
}
