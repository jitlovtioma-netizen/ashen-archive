"use client";

import { ArchiveSection } from "@/components/crt/ArchiveSection";
import type { CardRecord } from "@/components/crt/RecordCard";
import { LoreSection } from "./LoreSection";
import type {
  Character,
  Location,
  Chronicle,
  GameSystem,
} from "@/lib/types";

const dangerLabel = (d: number) => "▲".repeat(d) + "△".repeat(5 - d);

interface SectionProps {
  system: GameSystem;
}

export function CharactersSection({ system }: SectionProps) {
  return (
    <ArchiveSection<Character>
      type="characters"
      system={system}
      title="Архив Героев"
      code="ЗАПРОС_АРХИВ_ГЕРОЕВ"
      blurb={`// действующие лица партии в ${system === "DND" ? "Эларии" : "Голарионе"} //`}
      normalize={(r) => ({
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
      })}
    />
  );
}

export { LoreSection } from "./LoreSection";

export function LocationsSection({ system }: SectionProps) {
  return (
    <ArchiveSection<Location>
      type="locations"
      system={system}
      title="Реестр Локаций"
      code="ЗАПРОС_РЕЕСТР_МЕСТ"
      blurb={`// места, где ступала партия //`}
      normalize={(r) => ({
        id: r.id,
        name: r.name,
        subtitle: r.type,
        system: r.system,
        description: r.description,
        sigil: r.sigil,
        isLocked: r.isLocked,
        isCorrupted: r.isCorrupted,
        secretFragment: r.secretFragment,
        shardWord: r.shardWord,
        mapX: r.mapX,
        mapY: r.mapY,
      })}
    />
  );
}

export function ChroniclesSection({ system }: SectionProps) {
  return (
    <ArchiveSection<Chronicle>
      type="chronicles"
      system={system}
      title="Хроники Партий"
      code="ЗАПРОС_ХРОНИКИ_ПАРТИЙ"
      blurb={`// летопись сессий партии //`}
      normalize={(r) => ({
        id: r.id,
        name: r.title,
        subtitle: `СЕССИЯ ${String(r.sessionNumber).padStart(2, "0")} · ${r.date} · ${r.system}`,
        system: r.system,
        description: r.summary,
        sigil: r.sigil,
        isLocked: r.isLocked,
        isCorrupted: r.isCorrupted,
        secretFragment: r.secretFragment,
        shardWord: r.shardWord,
        mapX: r.mapX,
        mapY: r.mapY,
      })}
    />
  );
}
