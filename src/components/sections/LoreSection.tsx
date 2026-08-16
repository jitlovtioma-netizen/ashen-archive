"use client";

import { useState } from "react";
import { useArchiveData } from "@/lib/useArchiveData";
import { RecordCard, type CardRecord } from "@/components/crt/RecordCard";
import { Sigil } from "@/components/crt/Sigil";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import type { Lore, GameSystem } from "@/lib/types";

interface LoreSectionProps {
  system: GameSystem;
}

function loreToCard(r: Lore): CardRecord {
  return {
    id: r.id,
    name: r.title,
    subtitle: r.category,
    system: r.system,
    description: r.description,
    sigil: r.sigil,
    isLocked: r.isLocked,
    isCorrupted: r.isCorrupted,
    secretFragment: r.secretFragment,
    shardWord: r.shardWord,
    mapX: r.mapX,
    mapY: r.mapY,
    imageUrl: r.imageUrl ?? null,
    status: (r.status as "ALIVE" | "DEAD" | "MISSING") ?? "ALIVE",
  };
}

interface FolderDef {
  key: string;
  label: string;
  code: string;
  sigil: string;
  blurb: string;
}

const FOLDERS: FolderDef[] = [
  {
    key: "PANTHEON",
    label: "Пантеон",
    code: "ПАНТЕОН",
    sigil: "✦",
    blurb: "// двенадцать божеств Эларии, что черпают силу из веры //",
  },
  {
    key: "SECONDARY_HEROES",
    label: "Второстепенные герои",
    code: "ВТОРОСТЕПЕННЫЕ_ГЕРОИ",
    sigil: "🎭",
    blurb: "// значимые NPC, встреченные партией в странствиях //",
  },
];

export function LoreSection({ system }: LoreSectionProps) {
  const { data, loading, error } = useArchiveData<Lore>("lore", system);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const shards = useArchive((s) => s.shards);

  const records = data ?? [];
  const plain = records.filter((r) => !r.folder);
  const pantheon = records
    .filter((r) => r.folder === "PANTHEON")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const secondary = records
    .filter((r) => r.folder === "SECONDARY_HEROES")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const folderData: Record<string, Lore[]> = {
    PANTHEON: pantheon,
    SECONDARY_HEROES: secondary,
  };

  const toggleFolder = (key: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    sfx.select();
  };

  const totalInFolders = pantheon.length + secondary.length;

  return (
    <section className="flex flex-col gap-3 h-full">
      {/* breadcrumb */}
      <div className="panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; СЕКТОР_{system} &gt;
        </span>
        <span className="text-[11px] glow-green tracking-widest">
          ЗАПРОС_БАЗА_ЛОРА
        </span>
        <span className="flex-1" />
        <span className="chip chip-ok text-[10px]">
          ЗАПИСЕЙ: {records.length}
        </span>
      </div>

      {/* title */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-green-strong tracking-wider">
          База Лора
        </h2>
        <span className="text-[10px] text-dim">
          {"// история мира: боги, катастрофы, эпохи, значимые личности //"}
        </span>
      </div>

      {/* loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="panel clip-hud p-4 h-20 animate-pulse"
              style={{ background: "var(--panel-2)" }}
            />
          ))}
        </div>
      )}

      {/* error */}
      {error && !loading && (
        <div className="panel clip-hud p-6 text-center">
          <div className="font-vt323 text-xl glow-red mb-2">
            [ ОШИБКА ПОДКЛЮЧЕНИЯ ]
          </div>
          <div className="text-dim text-sm">
            {"// не удалось получить данные лора: "}{error}{" //"}
          </div>
        </div>
      )}

      {/* folders */}
      {!loading && !error && FOLDERS.length > 0 && totalInFolders > 0 && (
        <div className="space-y-2">
          {FOLDERS.map((folder) => {
            const items = folderData[folder.key] ?? [];
            if (items.length === 0) return null;
            const isOpen = openFolders.has(folder.key);
            const collectedInFolder = items.filter((n) =>
              n.shardWord ? shards.includes(n.shardWord) : false
            ).length;
            return (
              <div
                key={folder.key}
                className={`panel clip-hud brackets transition-all ${
                  isOpen ? "border-[var(--green-dim)]" : ""
                }`}
              >
                <button
                  onClick={() => toggleFolder(folder.key)}
                  onMouseEnter={() => sfx.hover()}
                  className="w-full flex items-center gap-3 p-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span
                    className="text-xs glow-green transition-transform"
                    style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                  >
                    ▶
                  </span>
                  <Sigil glyph={folder.sigil} size={40} spin={false} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medieval text-base glow-green leading-tight truncate">
                      {folder.label}
                    </h3>
                    <div className="text-[10px] text-dim tracking-wider mt-0.5">
                      {folder.code} · ЗАПИСЕЙ: {items.length}
                      {collectedInFolder > 0 && (
                        <span className="glow-green ml-2">
                          🧩 {collectedInFolder}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="chip chip-ok text-[10px] shrink-0">
                    {isOpen ? "ОТКРЫТО" : "ПАПКА"}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 fade-in">
                    <div className="divider-glow mb-3" />
                    <p className="text-[12px] text-[var(--text)] leading-relaxed mb-3 italic">
                      {folder.blurb}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {items.map((item) => (
                        <RecordCard
                          key={item.id}
                          record={loreToCard(item)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* plain records (no folder) */}
      {!loading && !error && plain.length > 0 && (
        <>
          <div className="divider-glow my-1" />
          <div className="text-[10px] text-dim tracking-widest px-1">
            {"// ОБЩИЙ ЛОР //"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start pb-2">
            {plain.map((r) => (
              <RecordCard key={r.id} record={loreToCard(r)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
