"use client";

import { ArchiveSection } from "@/components/crt/ArchiveSection";
import type { CardRecord } from "@/components/crt/RecordCard";
import type {
  Character,
  Lore,
  Location,
  GameSystem,
} from "@/lib/types";

interface SectionProps {
  system: GameSystem;
}

const loreNormalize = (r: Lore) => ({
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
  imageUrl: (r as Record<string, unknown>).imageUrl as string | null ?? null,
  status: ((r as Record<string, unknown>).status as "ALIVE" | "DEAD" | "MISSING") ?? "ALIVE",
  friendship: (r as Record<string, unknown>).friendship as number | null ?? null,
});

export function CharactersSection({ system }: SectionProps) {
  return (
    <ArchiveSection<Character>
      type="characters"
      system={system}
      title="Архив Героев"
      code="ЗАПРОС_АРХИВ_ГЕРОЕВ"
      columns={1}
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

export function LoreSection({ system }: SectionProps) {
  return (
    <ArchiveSection<Lore>
      type="lore"
      system={system}
      title="База Лора"
      code="ЗАПРОС_БАЗА_ЛОРА"
      columns={1}
      blurb={`// история мира: катастрофы, эпохи, ресурсы //`}
      filter={(r) => !(r as Record<string, unknown>).folder}
      normalize={loreNormalize}
    />
  );
}

export function LoreGodsSection({ system }: SectionProps) {
  return (
    <ArchiveSection<Lore>
      type="lore"
      system={system}
      title="Божества"
      code="ЗАПРОС_ПАНТЕОН"
      columns={1}
      blurb={`// двенадцать божеств Эларии, что черпают силу из веры //`}
      filter={(r) => (r as Record<string, unknown>).folder === "PANTHEON"}
      normalize={loreNormalize}
    />
  );
}

export function LoreNpcsSection({ system }: SectionProps) {
  return (
    <ArchiveSection<Lore>
      type="lore"
      system={system}
      title="Второстепенные герои"
      code="ЗАПРОС_ВТОРОСТЕПЕННЫЕ"
      columns={1}
      blurb={`// значимые NPC, встреченные партией в странствиях //`}
      filter={(r) => (r as Record<string, unknown>).folder === "SECONDARY_HEROES"}
      revealAtMaxGaze="Отражение"
      normalize={loreNormalize}
    />
  );
}

export function LoreSecretsSection({ system }: SectionProps) {
  return (
    <ArchiveSection<Lore>
      type="lore"
      system={system}
      title="Секреты"
      code="СОКРЫТОЕ"
      columns={1}
      blurb={`// тайны, открытые тем, кто собрал все осколки памяти //`}
      filter={(r) => (r as Record<string, unknown>).folder === "SECRETS"}
      normalize={loreNormalize}
    />
  );
}

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
