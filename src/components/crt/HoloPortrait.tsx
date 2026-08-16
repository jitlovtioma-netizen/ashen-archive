"use client";

interface HoloPortraitProps {
  src: string;
  corrupted?: boolean;
  sealed?: boolean;
  status?: "ALIVE" | "DEAD" | "MISSING";
  size?: number;
  fallbackGlyph?: string;
  full?: boolean; // прямоугольная голограмма на весь контейнер
}

// Голографический портрет в эстетике CRT-терминала:
// - прямоугольная рамка с угловыми скобками
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
  full = false,
}: HoloPortraitProps) {
  const dead = status === "DEAD";
  const missing = status === "MISSING";
  const accentColor = dead ? "var(--red)" : corrupted ? "var(--red)" : "var(--green)";

  // В режиме full — занимаем весь контейнер родителя
  const containerStyle = full
    ? { width: "100%", height: "100%", minHeight: "300px" }
    : { width: size, height: size };

  const imgStyle = full
    ? {
        width: "100%",
        height: "100%",
        objectFit: "cover" as const,
        opacity: sealed ? 0.2 : dead ? 0.5 : 0.85,
        filter: dead
          ? "grayscale(0.8) brightness(0.6) contrast(1.2)"
          : corrupted
            ? "sepia(0.4) hue-rotate(280deg) saturate(1.3) brightness(0.8)"
            : "sepia(0.3) hue-rotate(70deg) saturate(1.4) brightness(0.9)",
      }
    : {
        width: size * 0.7,
        height: size * 0.7,
        objectFit: "cover" as const,
        opacity: sealed ? 0.2 : dead ? 0.5 : 0.85,
        filter: dead
          ? "grayscale(0.8) brightness(0.6) contrast(1.2)"
          : corrupted
            ? "sepia(0.4) hue-rotate(280deg) saturate(1.3) brightness(0.8)"
            : "sepia(0.3) hue-rotate(70deg) saturate(1.4) brightness(0.9)",
      };

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden ${full ? "w-full h-full" : ""}`}
      style={containerStyle}
      aria-label="Голографический портрет"
    >
      {/* corner brackets — крупнее в full режиме */}
      <span
        className={`absolute top-0 left-0 border-t-2 border-l-2 z-20 ${full ? "w-4 h-4" : "w-2.5 h-2.5"}`}
        style={{ borderColor: accentColor }}
      />
      <span
        className={`absolute top-0 right-0 border-t-2 border-r-2 z-20 ${full ? "w-4 h-4" : "w-2.5 h-2.5"}`}
        style={{ borderColor: accentColor }}
      />
      <span
        className={`absolute bottom-0 left-0 border-b-2 border-l-2 z-20 ${full ? "w-4 h-4" : "w-2.5 h-2.5"}`}
        style={{ borderColor: accentColor }}
      />
      <span
        className={`absolute bottom-0 right-0 border-b-2 border-r-2 z-20 ${full ? "w-4 h-4" : "w-2.5 h-2.5"}`}
        style={{ borderColor: accentColor }}
      />

      {/* hologram grid overlay */}
      <div
        className="absolute inset-0 z-15 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${accentColor}22 1px, transparent 1px), linear-gradient(90deg, ${accentColor}22 1px, transparent 1px)`,
          backgroundSize: full ? "20px 20px" : "10px 10px",
          opacity: 0.3,
        }}
      />

      {/* the portrait image — full rectangular */}
      <img
        src={src}
        alt="Портрет"
        loading="lazy"
        className="relative z-10 object-cover"
        style={imgStyle}
        onError={(e) => {
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
          fontSize: full ? "4rem" : size * 0.4,
          color: accentColor,
        }}
      >
        {fallbackGlyph ?? "✦"}
      </span>

      {/* scan line — двигается сверху вниз */}
      <span
        className="holo-scan absolute left-0 right-0 z-20"
        style={{
          height: "2px",
          background: `linear-gradient(90deg, transparent, ${accentColor}88, transparent)`,
          opacity: 0.5,
        }}
      />

      {/* glow border */}
      <div
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          boxShadow: `inset 0 0 ${full ? "40px" : "15px"} ${accentColor}33`,
        }}
      />

      {/* status badge */}
      {dead && (
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 chip chip-err text-[8px] px-1 py-0 whitespace-nowrap z-30"
          style={{ letterSpacing: "0.1em" }}
        >
          💀 МЁРТВ
        </span>
      )}
      {missing && (
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 chip chip-warn text-[8px] px-1 py-0 whitespace-nowrap z-30"
          style={{ letterSpacing: "0.1em" }}
        >
          ? ПРОПАЛ
        </span>
      )}
    </div>
  );
}
