"use client";

import { useEffect } from "react";
import { useArchive, flushProgressSave, hydrateProgressFromServer } from "@/lib/store";
import { initPresence, disconnectPresence } from "@/lib/presence";
import { CRTOverlays } from "@/components/crt/CRTOverlays";
import { BootSequence } from "@/components/crt/BootSequence";
import { LoginForm } from "@/components/crt/LoginForm";
import { TitleBar } from "@/components/crt/TitleBar";
import { Sidebar } from "@/components/crt/Sidebar";
import { StatusBar } from "@/components/crt/StatusBar";
import { GazeController } from "@/components/crt/GazeController";
import { GazeWhispers } from "@/components/crt/GazeWhispers";
import { IrisWhispers } from "@/components/crt/IrisWhispers";
import { KonamiHandler } from "@/components/crt/KonamiHandler";
import { KonamiModal } from "@/components/crt/KonamiModal";
import { AchievementWatcher } from "@/components/crt/AchievementWatcher";
import { AchievementToaster } from "@/components/crt/AchievementToaster";
import { SecretBanner } from "@/components/crt/SecretBanner";
import { CommandPalette } from "@/components/crt/CommandPalette";
import { KeyboardShortcuts } from "@/components/crt/KeyboardShortcuts";
import { KeyboardShortcutsHandler } from "@/components/crt/KeyboardShortcutsHandler";
import { AdminBroadcastOverlay } from "@/components/crt/AdminBroadcastOverlay";
import {
  CharactersSection,
  LoreSection,
  LoreGodsSection,
  LoreNpcsSection,
  LoreSecretsSection,
  LocationsSection,
} from "@/components/sections/Sections";
import { FactionsSection } from "@/components/sections/FactionsSection";
import { ProfileSection } from "@/components/crt/ProfileSection";
import { AdminSection } from "@/components/crt/AdminSection";

function SecretsSection({ system }: { system: "DND" | "PF2E" }) {
  return <LoreSecretsSection system={system} />;
}

function Viewport({ system }: { system: "DND" | "PF2E" }) {
  const section = useArchive((s) => s.section);
  switch (section) {
    case "profile":
      return <ProfileSection system={system} />;
    case "admin":
      return <AdminSection system={system} />;
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

  useEffect(() => {
    if (!user) return;
    fetch(`/api/stats?system=${user.system}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.totalShardWords) setTotalShardWords(d.totalShardWords);
      })
      .catch(() => {});
  }, [user, setTotalShardWords]);

  // ─── Онлайн-присутствие: подключаемся к presence-сокету ───
  useEffect(() => {
    if (!user) {
      disconnectPresence();
      return;
    }
    initPresence(user.login, user.system);
    return () => {
      // при смене пользователя/выходе сокет переинициализируется в след. рендере
    };
  }, [user?.login, user?.system, user]);

  // ─── Обновляем роль/привязку из БД (всегда при монтировании:
  //     админ мог изменить привязку, а сессия могла устареть) ───
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`/api/auth/me?login=${encodeURIComponent(user.login)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.ok && d.user) {
          useArchive.getState().patchUser({
            role: d.user.role,
            characterId: d.user.characterId,
          });
        }
      })
      .catch(() => {});
    // восстановление прогресса после перезагрузки страницы
    void hydrateProgressFromServer(user.login, user.system);
    return () => {
      cancelled = true;
    };
  }, [user?.login, user?.system]);

  // ─── Сохраняем прогресс при закрытии вкладки ───
  useEffect(() => {
    const onLeave = () => flushProgressSave();
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onLeave);
    };
  }, []);

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
      <GazeWhispers />
      {/* v5.5: ирис-шёпот — отвечает, когда открывают досье с ⟪…⟫ */}
      <IrisWhispers />
      <KonamiHandler />
      <KonamiModal />
      <CommandPalette />
      <KeyboardShortcuts />
      <KeyboardShortcutsHandler />
      <AchievementWatcher />

      <AchievementToaster />
      <SecretBanner />
      <AdminBroadcastOverlay />

      {!booted && <BootSequence />}

      {booted && (
        <>
          <div className="shrink-0 z-40">
            <TitleBar />
          </div>

          <div className="flex-1 flex flex-col md:flex-row gap-2 min-h-0">
            <Sidebar />
            <main className="flex-1 min-w-0 panel clip-hud p-3 sm:p-4 overflow-y-auto crt-scroll fade-in relative">
              <div key={section} className="section-enter relative">
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
