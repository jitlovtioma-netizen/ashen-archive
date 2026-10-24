"use client";

/** «Проникнуть в память» (досье Кали): Бруно отказывается — пока что. */
export function MemoryProbeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9700] flex items-center justify-center p-4"
      style={{ background: "rgba(2, 0, 2, 0.9)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Проникновение в память"
    >
      <div
        className="panel clip-hud brackets w-full max-w-md p-8 text-center fade-in"
        style={{
          borderColor: "var(--violet-dim)",
          boxShadow: "0 0 40px rgba(var(--violet-rgb), 0.3)",
          animation: "modalIn 0.3s ease-out forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-4 pulse-slow">🧠</div>
        <div className="font-medieval text-lg glow-violet tracking-wider mb-3 glitch" data-text="ОТКАЗАНО">
          ОТКАЗАНО
        </div>
        <div className="text-[14px] text-[var(--text)] leading-relaxed mb-6">
          Бруно отказался от этого действия...
          <br />
          <span className="text-dim italic">Пока что.</span>
        </div>
        <button onClick={onClose} className="btn-crt clip-hud-sm px-6 py-2 text-xs">
          ◂ ЗАКРЫТЬ
        </button>
      </div>
    </div>
  );
}
