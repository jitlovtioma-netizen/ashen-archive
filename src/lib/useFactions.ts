"use client";

import { useEffect, useState } from "react";
import type { Faction, GameSystem } from "@/lib/types";

export function useFactions(system: GameSystem) {
  const [data, setData] = useState<Faction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/factions?system=${system}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((d: Faction[]) => {
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
  }, [system]);

  return { data, loading, error };
}
