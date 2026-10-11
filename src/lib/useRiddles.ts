"use client";

// ============================================================================
// ЗАГАДКИ-ВРАТА — клиентский кэш публичных загадок (без ответов).
// Загружается один раз на страницу (модульный кэш + дедупликация запроса),
// все карточки читают общий кэш. Инвалидируется по dataRevision — после
// правок в Мастерской загадки перезагружаются.
// ============================================================================

import { useEffect, useState } from "react";
import { useArchive } from "@/lib/store";
import type { RiddlePublic } from "@/lib/types";

let cache: RiddlePublic[] | null = null;
let cacheRevision = -1;
let inflight: Promise<RiddlePublic[]> | null = null;

/** Сетевой запрос с дедупликацией: параллельные подписчики ждут один промис. */
function requestRiddles(): Promise<RiddlePublic[]> {
  if (!inflight) {
    inflight = fetch("/api/riddles")
      .then((r) => (r.ok ? (r.json() as Promise<RiddlePublic[]>) : []))
      .catch(() => [] as RiddlePublic[])
      .finally(() => {
        // отпускаем промис чуть позже — волна монтирования карточек
        // успевает подсесть на один и тот же запрос
        setTimeout(() => {
          inflight = null;
        }, 50);
      });
  }
  return inflight;
}

/** Свежие загадки: из кэша, если он актуален для этой ревизии, иначе сеть. */
function fetchRiddles(revision: number): Promise<RiddlePublic[]> {
  if (cache && cacheRevision === revision) return Promise.resolve(cache);
  return requestRiddles();
}

/** Публичные загадки архива (список без ответов). */
export function useRiddles(): RiddlePublic[] {
  const [riddles, setRiddles] = useState<RiddlePublic[]>(() => cache ?? []);
  const dataRevision = useArchive((s) => s.dataRevision);

  useEffect(() => {
    let cancelled = false;
    void fetchRiddles(dataRevision).then((list) => {
      if (cancelled) return;
      cache = list;
      cacheRevision = dataRevision;
      setRiddles(list);
    });
    return () => {
      cancelled = true;
    };
  }, [dataRevision]);

  return riddles;
}

/** Загадка для записи по имени (мир должен совпадать, либо мир загадки — любой). */
export function findRiddleFor(
  riddles: RiddlePublic[],
  recordName: string,
  system?: string,
): RiddlePublic | undefined {
  return riddles.find(
    (r) => r.recordName === recordName && (!r.system || !system || r.system === system),
  );
}
