"use client";

interface HoloPortraitProps {
  src: string;
  corrupted?: boolean;
  sealed?: boolean;
  status?: "ALIVE" | "DEAD" | "MISSING";
  size?: number;
  fallbackGlyph?: string;
}

// Голографический портрет в эстетике CRT-терминала:
// - рамка с угловыми скобками
// - вращающаяся клетка
// - сканлайн
// - фильтр sepia+hue-rotate для "голограммы"
// - бейдж статуса (ЖИВ/МЁРТВ/ПРОПАЛ)
export function HoloPortrait({
  src,
  corrupted = false,
  sealed = false,
  status = "ALIVE",
  size = 88,
  fallbackGlyph,
}: HoloPortraitProps) {
  const dead = status === "DEAD";
  const missing = status === "MISSING";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label="Голографический портрет"
    >
      {/* static concentric rings (lightweight) */}
      <div
        className="absolute rounded-full border"
        style={{
          inset: size * 0.08,
          borderColor: dead
            ? "rgba(255,36,36,0.3)"
            : "rgba(74,246,38,0.3)",
        }}
      />
      <div
        className="absolute rounded-full border"
        style={{
          inset: size * 0.2,
          borderColor: dead
            ? "rgba(255,36,36,0.18)"
            : "rgba(74,246,38,0.18)",
        }}
      />

      {/* corner brackets */}
      <span
        className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2"
        style={{
          borderColor: dead ? "var(--red)" : "var(--green)",
        }}
      />
      <span
        className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2"
        style={{ borderColor: dead ? "var(--red)" : "var(--green)" }}
      />
      <span
        className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2"
        style={{ borderColor: dead ? "var(--red)" : "var(--green)" }}
      />
      <span
        className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2"
        style={{ borderColor: dead ? "var(--red)" : "var(--green)" }}
      />

      {/* the portrait image — minimal filters for performance */}
      <img
        src={src}
        alt="Портрет"
        loading="lazy"
        className="relative z-10 rounded-full object-cover"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          opacity: sealed ? 0.35 : dead ? 0.6 : 1,
        }}
        onError={(e) => {
          // hide broken image → show fallback glyph
          (e.currentTarget as HTMLImageElement).style.display = "none";
          const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = "flex";
        }}
      />
      {/* fallback glyph (hidden, shown if image errors) */}
      <span
        className="sigil-holo absolute z-10"
        style={{
          display: "none",
          fontSize: size * 0.4,
          color: dead ? "var(--red)" : "var(--green)",
        }}
      >
        {fallbackGlyph ?? "✦"}
      </span>

      {/* scan line (disabled for performance — too many concurrent animations) */}
      {false && <span className="holo-scan" style={{ opacity: 0.35 }} />}

      {/* status badge */}
      {dead && (
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 chip chip-err text-[8px] px-1 py-0 whitespace-nowrap"
          style={{ letterSpacing: "0.1em" }}
        >
          💀 МЁРТВ
        </span>
      )}
      {missing && (
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 chip chip-warn text-[8px] px-1 py-0 whitespace-nowrap"
          style={{ letterSpacing: "0.1em" }}
        >
          ? ПРОПАЛ
        </span>
      )}
    </div>
  );
}
