"use client";

import { useEffect, useState } from "react";
import { useArchive } from "@/lib/store";
import type { Achievement, GameSystem } from "@/lib/types";
import { Sigil } from "@/components/crt/Sigil";

export function AchievementsSection({ system }: { system: GameSystem }) {
  const [data, setData] = useState<Achievement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const unlocked = useArchive((s) => s.achievements);
  const shards = useArchive((s) => s.shards);
  const revealedSecrets = useArchive((s) => s.revealedSecrets);
  const unlockedIds = useArchive((s) => s.unlockedIds);

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((d: Achievement[]) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const list = data ?? [];

  return (
    <section className="flex flex-col gap-3 h-full">
      <div className="panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; СЕКТОР_{system} &gt;
        </span>
        <span className="text-[11px] glow-amber tracking-widest">
          РЕЕСТР_ДОСТИЖЕНИЙ
        </span>
        <span className="flex-1" />
        <span className="chip chip-ok text-[10px]">
          ОТКРЫТО: {unlocked.length} / {list.length}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-amber tracking-wider">
          Достижения
        </h2>
        <span className="text-[10px] text-dim">
          {"// соберите все, чтобы вызвать финальное откровение //"}
        </span>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="panel clip-hud p-4 h-32 animate-pulse"
              style={{ background: "var(--panel-2)" }}
            />
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start pb-2">
          {list.map((a) => {
            const isUnlocked = unlocked.includes(a.code);
            // Все достижения показываются с именем и описанием (не скрываем)
            const isSecret = false;
            return (
              <div
                key={a.id}
                className={`panel clip-hud brackets p-4 flex gap-3 items-start transition-all ${
                  isUnlocked
                    ? "border-[var(--amber-dim)]"
                    : "opacity-60 grayscale"
                }`}
              >
                <Sigil
                  glyph={a.sigil}
                  size={56}
                  spin={isUnlocked}
                  corrupted={!isUnlocked}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-dim tracking-widest mb-0.5">
                    {a.code}
                  </div>
                  <h3
                    className={`font-medieval text-base leading-tight ${
                      isUnlocked ? "glow-amber" : "text-dim"
                    }`}
                  >
                    {isSecret ? "??? СОКРЫТОЕ ДОСТИЖЕНИЕ" : a.name}
                  </h3>
                  <p className="text-[12px] text-dim mt-1 leading-relaxed">
                    {a.description}
                  </p>
                  {/* Подсказка — видна ВСЕГДА */}
                  {a.secretFragment && (
                    <div className="mt-2 panel-inset p-2 border-l-2 border-[var(--violet)]">
                      <div className="text-[9px] glow-violet tracking-widest mb-0.5">
                        ⟁ ПОДСКАЗКА
                      </div>
                      <div className="text-[11px] italic text-[var(--text)]">
                        {a.secretFragment}
                      </div>
                    </div>
                  )}
                  <div className="mt-2">
                    {isUnlocked ? (
                      <span className="chip chip-warn">✓ ОТКРЫТО</span>
                    ) : (
                      <span className="chip">🔒 ЗАКРЫТО</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* progress summary */}
      <div className="panel clip-hud-sm p-3 mt-2">
        <div className="text-[10px] text-dim tracking-widest mb-2">
          {"// СВОДКА ПРОГРЕССА //"}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Stat label="ДОСТИЖЕНИЯ" value={`${unlocked.length}/${list.length}`} color="amber" />
          <Stat label="ОСКОЛКИ" value={`${shards.length}`} color="green" />
          <Stat
            label="ИЗВЕСТНЫЕ СЕКРЕТЫ"
            value={`${revealedSecrets.length}`}
            color="violet"
          />
          <Stat
            label="СНЯТЫХ ПЕЧЕЙ"
            value={`${unlockedIds.length}`}
            color="green"
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "amber" | "green" | "violet";
}) {
  const cls =
    color === "amber"
      ? "glow-amber"
      : color === "violet"
        ? "glow-violet"
        : "glow-green";
  return (
    <div className="panel-inset p-2">
      <div className={`font-vt323 text-2xl ${cls}`}>{value}</div>
      <div className="text-[9px] text-dim tracking-widest mt-0.5">{label}</div>
    </div>
  );
}
