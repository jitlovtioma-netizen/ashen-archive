"use client";

import { useArchive, type Section } from "@/lib/store";
import { sfx } from "@/lib/audio";

interface NavItem {
  key: Section;
  label: string;
  code: string;
  sigil: string;
}

const NAV: NavItem[] = [
  { key: "characters", label: "Герои", code: "АРХИВ_ГЕРОЕВ", sigil: "⚔" },
  { key: "factions", label: "Фракции", code: "РЕЕСТР_ФРАКЦИЙ", sigil: "🜲" },
  { key: "lore", label: "Лор", code: "БАЗА_ЛОРА", sigil: "📖" },
  { key: "lore_gods", label: "Божества", code: "ЛОР_ПАНТЕОН", sigil: "✦" },
  { key: "lore_npcs", label: "Второстеп. герои", code: "ЛОР_НПС", sigil: "🎭" },
  { key: "locations", label: "Локации", code: "РЕЕСТР_МЕСТ", sigil: "🗺" },
  { key: "achievements", label: "Достижения", code: "ДОСТИЖЕНИЯ", sigil: "🏆" },
];

export function Sidebar() {
  const section = useArchive((s) => s.section);
  const setSection = useArchive((s) => s.setSection);
  const shards = useArchive((s) => s.shards);
  const gaze = useArchive((s) => s.gaze);
  const user = useArchive((s) => s.user);
  const totalShardWords = useArchive((s) => s.totalShardWords);

  const onNav = (k: Section) => {
    if (k === section) return;
    setSection(k);
    sfx.select();
  };

  const gazePct = Math.round(gaze);
  const gazeColor =
    gaze >= 90 ? "var(--red)" : gaze >= 60 ? "var(--amber)" : "var(--green)";

  // Вкладка «Секреты» появляется только когда собраны ВСЕ осколки памяти
  const allShardsCollected =
    totalShardWords > 0 && shards.length >= totalShardWords;

  const fullNav = allShardsCollected
    ? [
        ...NAV,
        {
          key: "secrets" as Section,
          label: "Секреты",
          code: "СОКРЫТОЕ",
          sigil: "🔓",
        },
      ]
    : NAV;

  return (
    <nav
      className="panel clip-hud-sm flex md:flex-col gap-1 p-2 md:w-60 md:min-w-[15rem] shrink-0 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto md:min-h-0 crt-scroll"
      aria-label="Архивный индекс"
    >
      <div className="hidden md:block text-[10px] text-dim tracking-widest px-2 py-1 border-b border-[var(--line)] mb-1">
        {"// АРХИВНЫЙ_ИНДЕКС"}
      </div>

      {fullNav.map((item) => (
        <button
          key={item.key}
          data-active={section === item.key}
          onClick={() => onNav(item.key)}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-3 py-2 text-left flex items-center gap-2 shrink-0 md:w-full"
        >
          <span className="text-base leading-none">{item.sigil}</span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[10px] text-dim tracking-wider hidden md:inline">
              {item.code}
            </span>
            <span className="text-xs tracking-wider">{item.label}</span>
          </span>
        </button>
      ))}

      <div className="hidden md:flex flex-col gap-2 mt-auto pt-3 border-t border-[var(--line)]">
        <div className="text-[10px] text-dim tracking-widest px-1">
          {"// ОСКОЛКИ_ПАМЯТИ ["}{shards.length}{"]"}
        </div>
        <div className="panel-inset p-2 min-h-[60px] max-h-32 overflow-y-auto crt-scroll">
          {shards.length === 0 ? (
            <div className="text-[10px] text-dim italic">
              {"// коллекция пуста. ищите 🧩 в записях."}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {shards.map((w, i) => (
                <span
                  key={i}
                  className="chip chip-ok text-[10px]"
                  title={`Осколок памяти: ${w}`}
                >
                  🧩 {w}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-1">
          <div className="flex justify-between text-[10px] text-dim tracking-widest mb-1">
            <span>ВЗГЛЯД БОГА</span>
            <span style={{ color: gazeColor }}>{gazePct}%</span>
          </div>
          <div className="panel-inset h-2 overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${gazePct}%`,
                background: `linear-gradient(90deg, ${gazeColor}33, ${gazeColor})`,
                boxShadow: `0 0 8px ${gazeColor}`,
              }}
            />
          </div>
          <div className="text-[9px] text-dim mt-1 leading-tight">
            {gaze >= 90
              ? "// ОН ВИДИТ ТЕБЯ"
              : gaze >= 60
                ? "// взгляд становится острым"
                : gaze >= 30
                  ? "// он замечает тебя"
                  : "// бог дремлет"}
          </div>
        </div>

        {user && (
          <div className="panel-inset p-2 mt-1">
            <div className="text-[9px] text-dim tracking-widest mb-0.5">
              {"// СТРАЖ"}
            </div>
            <div className="text-[11px] glow-green truncate">{user.displayName}</div>
            <div
              className="text-[9px] tracking-wider"
              style={{ color: user.system === "DND" ? "var(--red)" : "var(--cyan)" }}
            >
              {user.system === "DND" ? "D&D 5e · Элария" : "PF2e · Голарион"}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
