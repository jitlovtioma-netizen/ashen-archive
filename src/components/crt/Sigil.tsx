"use client";

interface SigilProps {
  glyph: string;
  corrupted?: boolean;
  size?: number;
  spin?: boolean;
}

export function Sigil({ glyph, corrupted, size = 64, spin = true }: SigilProps) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* rotating wireframe cage */}
      {spin && (
        <div
          className="absolute inset-0 sigil-spin"
          style={{
            transformStyle: "preserve-3d",
            perspective: 200,
          }}
        >
          <div
            className="absolute inset-2 border"
            style={{
              borderColor: corrupted ? "rgba(255,36,36,0.4)" : "rgba(74,246,38,0.4)",
              transform: "rotateX(60deg)",
            }}
          />
          <div
            className="absolute inset-2 border"
            style={{
              borderColor: corrupted ? "rgba(255,36,36,0.3)" : "rgba(74,246,38,0.3)",
              transform: "rotateY(60deg)",
            }}
          />
        </div>
      )}
      {/* concentric rings */}
      <div
        className="absolute rounded-full border"
        style={{
          inset: size * 0.1,
          borderColor: corrupted ? "rgba(255,36,36,0.25)" : "rgba(74,246,38,0.25)",
        }}
      />
      <div
        className="absolute rounded-full border"
        style={{
          inset: size * 0.22,
          borderColor: corrupted ? "rgba(255,36,36,0.18)" : "rgba(74,246,38,0.18)",
        }}
      />
      {/* corner brackets */}
      <span className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: corrupted ? "var(--red)" : "var(--green)" }} />
      <span className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: corrupted ? "var(--red)" : "var(--green)" }} />
      <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l" style={{ borderColor: corrupted ? "var(--red)" : "var(--green)" }} />
      <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r" style={{ borderColor: corrupted ? "var(--red)" : "var(--green)" }} />
      {/* the glyph */}
      <span
        className={`sigil-holo relative z-10 ${corrupted ? "corrupted" : ""}`}
        style={{ fontSize: size * 0.42, lineHeight: 1 }}
      >
        {glyph}
      </span>
      {/* floating motes */}
      <span className="absolute w-1 h-1 rounded-full float-mote" style={{ top: "20%", left: "15%", background: corrupted ? "var(--red)" : "var(--green)", opacity: 0.5 }} />
      <span className="absolute w-0.5 h-0.5 rounded-full float-mote" style={{ top: "70%", right: "20%", background: corrupted ? "var(--red)" : "var(--green)", opacity: 0.4, animationDelay: "1s" }} />
      {/* scan line */}
      <span className="holo-scan" style={{ opacity: 0.4 }} />
    </div>
  );
}
