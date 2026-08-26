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
import { KonamiModal } from "@/components/crt/KonamiModal";
import { AchievementWatcher } from "@/components/crt/AchievementWatcher";
import { AchievementToaster } from "@/components/crt/AchievementToaster";
import { SecretBanner } from "@/components/crt/SecretBanner";
import { CommandPalette } from "@/components/crt/CommandPalette";
import { KeyboardShortcuts } from "@/components/crt/KeyboardShortcuts";
import { KeyboardShortcutsHandler } from "@/components/crt/KeyboardShortcutsHandler";
import { DemonicInvasion } from "@/components/crt/DemonicInvasion";
import {
  CharactersSection,
  LoreSection,
  LoreGodsSection,
  LoreNpcsSection,
  LoreSecretsSection,
  LocationsSection,
} from "@/components/sections/Sections";
import { FactionsSection } from "@/components/sections/FactionsSection";
import { AchievementsSection } from "@/components/sections/AchievementsSection";

function SecretsSection({ system }: { system: "DND" | "PF2E" }) {
  return <LoreSecretsSection system={system} />;
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
      return <SecretsSection system={system} />;
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
  const section = useArchive((s) => s.section);

  // Загружаем totalShardWords из API
  useEffect(() => {
    if (!user) return;
    fetch(`/api/stats?system=${user.system}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.totalShardWords) setTotalShardWords(d.totalShardWords);
      })
      .catch(() => {});
  }, [user, setTotalShardWords]);

  // ambient gaze drift
  useEffect(() => {
    if (!booted || !user) return;
    const id = setInterval(() => {
      if (Math.random() < 0.12) {
        useArchive.getState().addGaze(1);
      }
    }, 12000);
    return () => clearInterval(id);
  }, [booted, user]);

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

      <GazeController />
      <KonamiHandler />
      <KonamiModal />
      <CommandPalette />
      <KeyboardShortcuts />
      <KeyboardShortcutsHandler />
      <DemonicInvasion />
      <AchievementWatcher />

      <AchievementToaster />
      <SecretBanner />

      {!booted && <BootSequence />}

      {booted && (
        <>
          <div className="shrink-0 z-40">
            <TitleBar />
          </div>

          <div className="flex-1 flex flex-col md:flex-row gap-2 min-h-0">
            <Sidebar />
            <main className="flex-1 min-w-0 panel clip-hud p-3 sm:p-4 overflow-y-auto crt-scroll fade-in relative">
              <div key={section} className="section-enter relative" style={{ zIndex: 1 }}>
                <Viewport system={system} />
              </div>
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
