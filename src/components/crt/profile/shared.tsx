"use client";

import type { GameSystem } from "@/lib/types";

export const SYS_COLOR: Record<GameSystem, string> = {
  DND: "var(--red)",
  PF2E: "var(--cyan)",
};
export const SYS_LABEL: Record<GameSystem, string> = {
  DND: "D&D 5e · ЭЛАРИЯ",
  PF2E: "PF2E · ГОЛАРИОН",
};

// режимы сортировки реестра стражей
export const SORT_MODES = [
  { id: "ONLINE", label: "ПО СЕТИ" },
  { id: "PROGRESS", label: "ПО ПРОГРЕССУ" },
  { id: "DAYS", label: "ПО СТАЖУ" },
] as const;
export type SortMode = (typeof SORT_MODES)[number]["id"];

// ─── мини-стат ──────────────────────────────────────────────────────────

// ─── форматирование времени для карточек стражей ───────────────────────

// «дней в архиве»: полных суток с момента регистрации стража
export function daysInArchive(createdAt: string): number {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

// римские цифры для номеров сессий — атмосфера старой хроники

// дата в русском формате ДД.ММ.ГГГГ
export function formatDateRu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// «был в сети»: только что / N мин назад / N ч назад / вчера / DD.MM.YYYY
export function formatLastSeen(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} ч назад`;
  if (h < 48) return "вчера";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// «в архиве»: сколько времени страж уже онлайн
export function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "меньше минуты";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  return `${h} ч ${min % 60} мин`;
}

export function Stat({
  label,
  value,
  color,
  valueColor,
  bar,
}: {
  label: string;
  value: string;
  color: "amber" | "green" | "violet";
  valueColor?: string;
  /** v5.6 — мини-бар под значением: pct (0..100) + стиль заливки */
  bar?: { pct: number; kind: "amber" | "green" | "iris" };
}) {
  const cls =
    color === "amber"
      ? "glow-amber"
      : color === "violet"
        ? "glow-violet"
        : "glow-green";
  return (
    <div className="panel-inset p-2 text-center">
      <div className={`font-vt323 text-2xl ${cls}`} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <div className="text-[9px] text-dim tracking-widest mt-0.5">{label}</div>
      {bar && (
        <div
          className="stat-mini-bar mt-1.5"
          role="img"
          aria-label={`Прогресс: ${bar.pct}%`}
        >
          <span
            className={bar.kind === "iris" ? "iris-bar-fill" : undefined}
            style={{
              width: `${bar.pct}%`,
              ...(bar.kind === "iris"
                ? null
                : {
                    background:
                      bar.kind === "amber" ? "var(--amber)" : "var(--green)",
                    boxShadow: `0 0 6px ${bar.kind === "amber" ? "var(--amber-dim)" : "rgba(var(--green-rgb),.4)"}`,
                  }),
            }}
          />
        </div>
      )}
    </div>
  );
}
