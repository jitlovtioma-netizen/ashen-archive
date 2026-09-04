"use client";

import { useArchive } from "@/lib/store";
import { sfx, setAmbientEnabled } from "@/lib/audio";
import { SYSTEM_WORLD, SYSTEM_SHORT, SYSTEM_COLOR } from "@/lib/types";

export function TitleBar() {
  const soundOn = useArchive((s) => s.soundOn);
  const toggleSound = useArchive((s) => s.toggleSound);
  const gaze = useArchive((s) => s.gaze);
  const witching = useArchive((s) => s.witching);
  const user = useArchive((s) => s.user);
  const logout = useArchive((s) => s.logout);

  const onToggleSound = () => {
    toggleSound();
    setAmbientEnabled(!soundOn);
    sfx.blip();
  };

  const onLogout = () => {
    sfx.thud();
    logout();
  };

  const system = user?.system ?? "DND";
  const sysColor = SYSTEM_COLOR[system];
  const gazeColor =
    gaze >= 90 ? "glow-red" : gaze >= 60 ? "glow-amber" : "glow-green";

  return (
    <header className="panel clip-hud-sm flex items-center gap-2 sm:gap-3 px-3 py-2 select-none">
      <div className="flex items-center gap-1.5">
        <span className="led led-red" />
        <span className="led led-amber" />
        <span className="led led-green" />
      </div>

      <div className="flex-1 text-center min-w-0">
        <h1 className="font-medieval glow-green-strong text-sm sm:text-xl tracking-[0.15em] truncate">
          АРХИВ ПЕПЕЛЬНОЙ ДЛАНИ
          <span
            className="hidden sm:inline font-mono-crt text-xs ml-2"
            style={{ color: sysColor }}
          >
            {" // "}{SYSTEM_SHORT[system]}{" v4.1"}
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px]">
        <span
          className="chip shrink-0 font-medieval tracking-[0.2em]"
          style={{
            color: sysColor,
            borderColor: `color-mix(in srgb, ${sysColor} 50%, transparent)`,
            background: `color-mix(in srgb, ${sysColor} 12%, var(--panel-2))`,
            textShadow: `0 0 8px ${sysColor}`,
          }}
          title={`Текущий мир: ${SYSTEM_WORLD[system]}`}
        >
          {SYSTEM_WORLD[system]}
        </span>
        {witching && (
          <span className="chip chip-violet hidden sm:inline-flex">
            🌙 ЧАС ВЕДЬМЫ
          </span>
        )}
        <span
          className="chip hidden md:inline-flex"
          style={{ color: sysColor, borderColor: `color-mix(in srgb, ${sysColor} 40%, transparent)` }}
          title={SYSTEM_WORLD[system]}
        >
          {user?.displayName ?? "СТРАЖ"}
        </span>
        <button
          onClick={onToggleSound}
          className="btn-crt clip-hud-sm px-2 py-1"
          aria-label="Звук"
        >
          ЗВУК:{soundOn ? "ВКЛ" : "ВЫКЛ"}
        </button>
        <span className={`chip ${gaze >= 90 ? "chip-err" : gaze >= 60 ? "chip-warn" : "chip-ok"}`}>
          СОЗИДАТЕЛЬ <span className={gazeColor}>{gaze}%</span>
        </span>
        <button
          onClick={onLogout}
          className="btn-crt btn-red clip-hud-sm px-2 py-1"
          aria-label="Выйти"
          title="Выйти из архива"
        >
          ВЫХОД
        </button>
      </div>
    </header>
  );
}
