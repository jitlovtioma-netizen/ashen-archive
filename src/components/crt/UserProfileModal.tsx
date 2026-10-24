"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useArchive } from "@/lib/store";
import { usePresence } from "@/lib/presence";
import { kickUser } from "@/lib/presence";
import { sfx } from "@/lib/audio";
import type {
  Achievement,
  Character,
  ProgressData,
  UserSummary,
} from "@/lib/types";
import { Sigil } from "@/components/crt/Sigil";

// Полное досье другого стража — доступно только администратору.
export function UserProfileModal({
  target,
  requester,
  onClose,
}: {
  target: UserSummary;
  requester: string;
  onClose: () => void;
}) {
  const pushToast = useArchive((s) => s.pushToast);
  const online = usePresence((s) => s.online);

  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [achCatalog, setAchCatalog] = useState<Achievement[] | null>(null);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [loading, setLoading] = useState(true);

  const isOnline = online.some((o) => o.login === target.login);
  const isAdmin = target.role === "ADMIN";
  const color =
    target.system === "DND" ? "var(--world-dnd)" : "var(--cyan)";

  useEffect(() => {
    sfx.whisper();
    fetch(
      `/api/progress?login=${encodeURIComponent(target.login)}&system=${target.system}`,
    )
      .then((r) => r.json())
      .then((d) => setProgress(d.progress ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/achievements")
      .then((r) => r.json())
      .then((d) => setAchCatalog(d ?? []))
      .catch(() => {});
    fetch(`/api/archive?type=characters&system=${target.system}`)
      .then((r) => r.json())
      .then((d) => setCharacters(d ?? []))
      .catch(() => {});
  }, [target, requester]);

  const character = characters?.find((c) => c.id === target.characterId) ?? null;
  const achList = (achCatalog ?? []).filter(
    (a) => !a.system || a.system === target.system,
  );
  const unlocked = progress?.achievements ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9600] flex items-center justify-center p-4 backdrop-in"
      style={{ background: "rgba(2, 0, 2, 0.88)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Досье стража ${target.displayName}`}
    >
      <div
        className="panel clip-hud brackets w-full max-w-3xl max-h-[88vh] overflow-y-auto crt-scroll modal-anim-in relative"
        style={{
          borderColor: isAdmin ? "var(--amber-dim)" : "var(--line)",
          boxShadow: isAdmin
            ? "0 0 50px rgba(var(--amber-rgb),0.18)"
            : "0 0 40px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* шапка */}
        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 border-b border-[var(--line)]" style={{ background: "var(--panel)" }}>
          <span className="text-[10px] text-dim tracking-widest">
            {"// ПРОТОКОЛ_ДОСЬЕ_СТРАЖА //"}
          </span>
          <span className="flex-1" />
          <button
            onClick={onClose}
            className="btn-crt clip-hud-sm px-3 py-1 text-[10px]"
            aria-label="Закрыть досье"
          >
            ✕ ЗАКРЫТЬ
          </button>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-4">
          {/* идентификация */}
          <div className="flex items-start gap-4 flex-wrap">
            <div
              className="panel-inset p-3 shrink-0"
              style={{
                borderColor: isAdmin ? "var(--amber-dim)" : undefined,
              }}
            >
              <Sigil glyph={isAdmin ? "⚡" : "🛡"} size={64} spin={isAdmin} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medieval text-xl break-words">
                {target.displayName}
              </div>
              <div className="text-[11px] text-dim tracking-wider mt-0.5">
                логин: <span className="glow-green">{target.login}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="chip text-[10px]" style={{ color, borderColor: color }}>
                  {target.system === "DND" ? "D&D 5e · ЭЛАРИЯ" : "PF2E · ГОЛАРИОН"}
                </span>
                {isAdmin && (
                  <span className="chip chip-warn text-[10px]">⚡ АДМИНИСТРАТОР</span>
                )}
                <span className={`chip text-[10px] ${isOnline ? "chip-ok" : ""}`}>
                  {isOnline ? (
                    <>
                      <span className="online-dot inline-block mr-1 align-middle" />
                      В СЕТИ
                    </>
                  ) : (
                    <>
                      <span className="offline-dot inline-block mr-1 align-middle" />
                      НЕ В СЕТИ
                    </>
                  )}
                </span>
              </div>
            </div>
            {isOnline && (
              <button
                onClick={() => {
                  kickUser(target.login);
                  pushToast({
                    kind: "warn",
                    title: "РИТУАЛ ИЗГНАНИЯ",
                    body: `${target.displayName} изгнан из архива.`,
                  });
                  sfx.thud();
                  onClose();
                }}
                className="btn-crt btn-red clip-hud-sm px-4 py-2 text-xs shrink-0"
                title="Отключить стража от архива"
              >
                ⏻ ИЗГНАТЬ
              </button>
            )}
          </div>

          {/* персонаж */}
          <div>
            <div className="text-[10px] text-dim tracking-widest mb-1.5">
              {"// ПЕРСОНАЖ_АРХИВА //"}
            </div>
            {character ? (
              <div className="panel-inset p-3 flex items-center gap-3 flex-wrap">
                {character.imageUrl && (
                  <img
                    src={character.imageUrl}
                    alt={character.name}
                    className="w-12 h-12 object-cover clip-hud-sm"
                    style={{ filter: "saturate(0.85) contrast(1.05)" }}
                  />
                )}
                <div>
                  <div className="font-medieval text-sm glow-amber">
                    {character.sigil} {character.name}
                  </div>
                  <div className="text-[10px] text-dim">
                    {character.title} · {character.race}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-dim italic">
                {"// персонаж не привязан //"}
              </div>
            )}
          </div>

          {/* прогресс */}
          <div>
            <div className="text-[10px] text-dim tracking-widest mb-1.5">
              {"// ПРОГРЕСС_СТРАЖА //"}
            </div>
            {loading ? (
              <div className="panel-inset p-4 animate-pulse text-dim text-xs">
                {"// загрузка данных… //"}
              </div>
            ) : progress ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MiniStat label="ОСКОЛКИ" value={progress.shards.length} color="green" />
                  <MiniStat label="ПЕЧАТИ" value={progress.unlockedIds.length} color="green" />
                  <MiniStat label="ЗАГАДКИ" value={progress.solvedRiddles.length} color="violet" />
                  <MiniStat label="ДОСТИЖЕНИЯ" value={`${progress.achievements.length}/${achList.length}`} color="amber" />
                </div>
                {progress.updatedAt && (
                  <div className="text-[9px] text-dim tracking-wider">
                    {"// прогресс обновлён: "}
                    {new Date(progress.updatedAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" //"}
                  </div>
                )}
              </div>
            ) : (
              <div className="panel-inset p-3 text-[11px] text-dim italic">
                {"// страж ещё не оставил следов в архиве //"}
              </div>
            )}
          </div>

          {/* достижения стража */}
          <div>
            <div className="text-[10px] text-dim tracking-widest mb-1.5">
              {"// ДОСТИЖЕНИЯ_СТРАЖА //"}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {achList.map((a) => {
                const on = unlocked.includes(a.code);
                return (
                  <div
                    key={a.id}
                    className={`panel-inset p-2 flex items-center gap-2 ${on ? "" : "opacity-50 grayscale"}`}
                  >
                    <Sigil glyph={a.sigil} size={28} spin={on} corrupted={!on} />
                    <div className="min-w-0">
                      <div className="text-[10px] text-dim tracking-wider truncate">
                        {a.code}
                      </div>
                      <div className={`text-[11px] truncate ${on ? "glow-amber" : "text-dim"}`}>
                        {on ? a.name : "// сокрыто //"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* осколки стража */}
          {progress && progress.shards.length > 0 && (
            <div>
              <div className="text-[10px] text-dim tracking-widest mb-1.5">
                {"// КОЛЛЕКЦИЯ_ОСКОЛКОВ //"}
              </div>
              <div className="flex flex-wrap gap-1">
                {progress.shards.map((w, i) => (
                  <span key={i} className="chip chip-ok text-[10px]">🧩 {w}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "amber" | "green" | "violet";
}) {
  const cls =
    color === "amber"
      ? "glow-amber"
      : color === "violet"
        ? "glow-violet"
        : "glow-green";
  return (
    <div className="panel-inset p-2 text-center">
      <div className={`font-vt323 text-xl ${cls}`}>{value}</div>
      <div className="text-[9px] text-dim tracking-widest">{label}</div>
    </div>
  );
}
