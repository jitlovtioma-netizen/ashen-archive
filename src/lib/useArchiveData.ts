"use client";

import { useEffect, useState } from "react";
import { useArchive } from "@/lib/store";
import type { ArchiveType, GameSystem } from "@/lib/types";

export function useArchiveData<T>(type: ArchiveType, system: GameSystem) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ревизия данных: после правки досье (владелец/админ) все секции
  // перезагружают список — правки становятся видны без перезагрузки страницы
  const dataRevision = useArchive((s) => s.dataRevision);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/archive?type=${type}&system=${system}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((d: T[]) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.name === "AbortError") return;
        setError(String(e.message || e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [type, system, dataRevision]);

  return { data, loading, error };
}
