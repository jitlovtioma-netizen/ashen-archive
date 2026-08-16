"use client";

import { useState } from "react";
import { useFactions } from "@/lib/useFactions";
import { RecordCard } from "@/components/crt/RecordCard";
import { Sigil } from "@/components/crt/Sigil";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import type { Character, GameSystem } from "@/lib/types";

interface FactionSectionProps {
  system: GameSystem;
}

function npcToCard(r: Character) {
  return {
    id: r.id,
    name: r.name,
    subtitle: `${r.category} · ${r.race} · ${r.title}`,
    system: r.system,
    description: r.description,
    sigil: r.sigil,
    isLocked: r.isLocked,
    isCorrupted: r.isCorrupted,
    secretFragment: r.secretFragment,
    shardWord: r.shardWord,
    mapX: r.mapX,
    mapY: r.mapY,
    imageUrl: r.imageUrl,
    status: r.status as "ALIVE" | "DEAD" | "MISSING",
  };
}

export function FactionsSection({ system }: FactionSectionProps) {
  const { data, loading, error } = useFactions(system);
  const [open, setOpen] = useState<string | null>(null);
  const shards = useArchive((s) => s.shards);

  const toggle = (id: string) => {
    setOpen((cur) => (cur === id ? null : id));
    sfx.select();
  };

  return (
    <section className="flex flex-col gap-3 h-full">
      <div className="panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; СЕКТОР_{system} &gt;
        </span>
        <span className="text-[11px] glow-amber tracking-widest">
          РЕЕСТР_ФРАКЦИЙ
        </span>
        <span className="flex-1" />
        <span className="chip chip-ok text-[10px]">
          ФРАКЦИЙ: {data?.length ?? "···"}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-amber tracking-wider">
          Фракции
        </h2>
        <span className="text-[10px] text-dim">
          {"// организации и государства. раскройте папку, чтобы увидеть значимых персонажей //"}
        </span>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="panel clip-hud p-3 h-14 animate-pulse"
              style={{ background: "var(--panel-2)" }}
            />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="panel clip-hud p-6 text-center">
          <div className="font-vt323 text-xl glow-red mb-2">
            [ ОШИБКА ПОДКЛЮЧЕНИЯ ]
          </div>
          <div className="text-dim text-sm">
            {"// не удалось получить данные фракций: "}{error}{" //"}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-2 pb-2">
          {data?.map((f) => {
            const isOpen = open === f.id;
            const npcCount = f.npcs.length;
            const collectedInFaction = f.npcs.filter((n) =>
              n.shardWord ? shards.includes(n.shardWord) : false
            ).length;
            return (
              <div
                key={f.id}
                className={`panel clip-hud brackets transition-all ${
                  isOpen ? "border-[var(--amber-dim)]" : ""
                }`}
              >
                {/* folder header */}
                <button
                  onClick={() => toggle(f.id)}
                  onMouseEnter={() => sfx.hover()}
                  className="w-full flex items-center gap-3 p-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span
                    className="text-xs glow-amber transition-transform"
                    style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                  >
                    ▶
                  </span>
                  <Sigil glyph={f.sigil} size={40} spin={false} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medieval text-base glow-amber leading-tight truncate">
                      {f.name}
                    </h3>
                    <div className="text-[10px] text-dim tracking-wider mt-0.5">
                      {f.system === "DND" ? "D&D 5e" : "PF2e"} · NPC: {npcCount}
                      {collectedInFaction > 0 && (
                        <span className="glow-green ml-2">
                          🧩 {collectedInFaction}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="chip chip-warn text-[10px] shrink-0"
                    style={{ borderColor: "var(--amber-dim)" }}
                  >
                    {isOpen ? "ОТКРЫТО" : "ПАПКА"}
                  </span>
                </button>

                {/* expanded body */}
                {isOpen && (
                  <div className="px-3 pb-3 fade-in">
                    <div className="divider-glow mb-3" />
                    <p className="text-[12px] text-[var(--text)] leading-relaxed mb-3 italic">
                      {f.description}
                    </p>
                    {npcCount === 0 ? (
                      <div className="panel-inset p-3 text-center text-[11px] text-dim">
                        {"/// значимые персонажи не записаны. данные ожидаются. ///"}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {f.npcs.map((npc) => (
                          <RecordCard
                            key={npc.id}
                            record={npcToCard(npc)}
                            horizontal
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
