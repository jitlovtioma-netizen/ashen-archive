"use client";

import { useEffect } from "react";
import { useArchive } from "@/lib/store";
import { CRTOverlays } from "@/components/crt/CRTOverlays";
import { BootSequence } from "@/components/crt/BootSequence";
import { LoginForm } from "@/components/crt/LoginForm";
import { TitleBar } from "@/components/crt/TitleBar";
import { Sidebar } from "@/components/crt/Sidebar";
import { StatusBar } from "@/components/crt/StatusBar";
import { GazeController } from "@/components/crt/GazeController";
import { KonamiHandler } from "@/components/crt/KonamiHandler";
import { WitchingWatcher } from "@/components/crt/WitchingWatcher";
import { AchievementToaster } from "@/components/crt/AchievementToaster";
import { WitchingBanner } from "@/components/crt/WitchingBanner";
import { SecretBanner } from "@/components/crt/SecretBanner";
import {
  CharactersSection,
  LoreSection,
  LoreGodsSection,
  LoreNpcsSection,
  LocationsSection,
} from "@/components/sections/Sections";
import { FactionsSection } from "@/components/sections/FactionsSection";
import { AchievementsSection } from "@/components/sections/AchievementsSection";

function SecretsSection() {
  return (
    <section className="flex flex-col gap-3 h-full">
      <div className="panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; СОКРЫТОЕ &gt;
        </span>
        <span className="text-[11px] glow-violet tracking-widest">
          СЕКРЕТЫ
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-violet tracking-wider">
          Секреты
        </h2>
      </div>
      <div className="panel clip-hud brackets p-8 text-center">
        <div className="text-4xl glow-violet mb-3 pulse-slow">🔓</div>
        <div className="font-vt323 text-xl glow-violet mb-2">
          [ СОКРЫТОЕ ОЖИДАЕТ ]
        </div>
        <div className="text-dim text-sm">
          {"// вы собрали все осколки памяти. но тайны ещё не раскрыты. //"}
        </div>
        <div className="text-dim text-xs mt-4">
          {"// содержимое появится в будущих обновлениях архива //"}
        </div>
      </div>
    </section>
  );
}

function Viewport({ system }: { system: "DND" | "PF2E" }) {
  const section = useArchive((s) => s.section);
  switch (section) {
    case "characters":
      return <CharactersSection system={system} />;
    case "factions":
      return <FactionsSection system={system} />;
    case "lore":
      return <LoreSection system={system} />;
    case "lore_gods":
      return <LoreGodsSection system={system} />;
    case "lore_npcs":
      return <LoreNpcsSection system={system} />;
    case "locations":
      return <LocationsSection system={system} />;
    case "secrets":
      return <SecretsSection />;
    case "achievements":
      return <AchievementsSection system={system} />;
    default:
      return <CharactersSection system={system} />;
  }
}

export default function Home() {
  const booted = useArchive((s) => s.booted);
  const user = useArchive((s) => s.user);
  const hydrated = useArchive((s) => s._hasHydrated);
  const setTotalShardWords = useArchive((s) => s.setTotalShardWords);

  // Загружаем totalShardWords из API (для вкладки «Секреты»)
  useEffect(() => {
    if (!user) return;
    fetch(`/api/stats?system=${user.system}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.totalShardWords) setTotalShardWords(d.totalShardWords);
      })
      .catch(() => {});
  }, [user, setTotalShardWords]);

  // ambient gaze drift while reading
  useEffect(() => {
    if (!booted || !user) return;
    const id = setInterval(() => {
      if (Math.random() < 0.12) {
        useArchive.getState().addGaze(1);
      }
    }, 12000);
    return () => clearInterval(id);
  }, [booted, user]);

  // clear gaze body classes on logout
  useEffect(() => {
    if (!user) {
      document.body.classList.remove(
        "gaze-low",
        "gaze-med",
        "gaze-high",
        "gaze-extreme",
        "witching"
      );
    }
  }, [user]);

  // Avoid hydration flash: render nothing until store hydrated
  if (!hydrated) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <CRTOverlays />
        <div className="font-vt323 text-2xl glow-green hint-caret">
          ИНИЦИАЛИЗАЦИЯ
        </div>
      </div>
    );
  }

  // Not authenticated → login gate
  if (!user) {
    return (
      <div className="min-h-dvh">
        <CRTOverlays />
        <LoginForm />
      </div>
    );
  }

  const system = user.system;

  return (
    <div className="h-dvh flex flex-col gap-2 p-2 max-w-[1400px] mx-auto overflow-hidden">
      <CRTOverlays />

      {/* controllers (no UI) */}
      <GazeController />
      <KonamiHandler />
      <WitchingWatcher />

      {/* overlays with UI */}
      <AchievementToaster />
      <WitchingBanner />
      <SecretBanner />

      {!booted && <BootSequence />}

      {booted && (
        <>
          <div className="shrink-0 z-40">
            <TitleBar />
          </div>

          <div className="flex-1 flex flex-col md:flex-row gap-2 min-h-0">
            <Sidebar />
            <main className="flex-1 min-w-0 panel clip-hud p-3 sm:p-4 overflow-y-auto crt-scroll fade-in">
              <Viewport system={system} />
            </main>
          </div>

          <StatusBar system={system} />

          <div className="text-center text-[10px] text-dim tracking-[0.3em] py-0.5 shrink-0">
            {`// АРХИВ ПЕПЕЛЬНОЙ ДЛАНИ — ${system === "DND" ? "ЭЛАРИЯ" : "ГОЛАРИОН"} — НЕ ДОВЕРЯЙ СВЕТУ //`}
          </div>
        </>
      )}
    </div>
  );
}
