"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/audio";
import { useArchive } from "@/lib/store";

interface PrimeFormProps {
  /** Имя героя — определяет цвет ауры и заголовок */
  heroName: "Реми" | "Бруно";
  /** Путь к арту Prime Form (например, /heroes/remi_prime.png) */
  imageUrl: string;
  onClose: () => void;
}

type Phase = "ritual" | "burst" | "reveal" | "stats";

/**
 * PrimeForm — спецэффект «Истинная Форма» для Реми и Бруно.
 *
 * Фазы:
 *  1. RITUAL  (3с)   — чёрный экран, пульсирующая печать, нарастающий шум.
 *  2. BURST   (1с)   — вспышка света, разбивающая печать, глитч-линии.
 *  3. REVEAL  (10с)  — арт на весь экран + аура + описание истинной формы.
 *  4. STATS   (∞)    — таблица характеристик Prime Form, кнопка «Закрыть».
 *
 * Цвет ауры:
 *  - Реми  → изумрудно-зелёный (druid Circle of Shepherds).
 *  - Бруно → фиолетово-голубой (psychic warrior, puppet master).
 */
export function PrimeForm({ heroName, imageUrl, onClose }: PrimeFormProps) {
  const [phase, setPhase] = useState<Phase>("ritual");
  const { addGaze, pushToast } = useArchive();

  const isRemi = heroName === "Реми";
  const aura = isRemi
    ? { primary: "#4af626", secondary: "#1a5d0a", glow: "rgba(74,246,38,0.55)", name: "ИСТИННАЯ ФОРМА: ПАСТЫРЬ ДРЕВА" }
    : { primary: "#a78bfa", secondary: "#06b6d4", glow: "rgba(167,139,250,0.55)", name: "ИСТИННАЯ ФОРМА: КУКЛОВОД" };

  // Фазы
  useEffect(() => {
    sfx.whisper();
    const t1 = setTimeout(() => {
      sfx.unlock();
      setPhase("burst");
    }, 3000);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== "burst") return;
    const t2 = setTimeout(() => {
      sfx.achievement();
      setPhase("reveal");
      addGaze(8);
      pushToast({
        kind: "ach",
        sigil: isRemi ? "🌿" : "🪆",
        title: `${heroName.toUpperCase()}: PRIME FORM`,
        body: "Истинная форма пробуждена. Взгляд Созидателя усилился.",
      });
    }, 1000);
    return () => clearTimeout(t2);
  }, [phase, heroName, isRemi, addGaze, pushToast]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const t3 = setTimeout(() => setPhase("stats"), 10000);
    return () => clearTimeout(t3);
  }, [phase]);

  // Esc для закрытия (только в фазе stats)
  useEffect(() => {
    if (phase !== "stats") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sfx.blip();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [phase, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9900] flex items-center justify-center"
      style={{ background: "#000" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Prime Form: ${heroName}`}
    >
      {/* ────────── Фаза 1: RITUAL — печать ────────── */}
      {phase === "ritual" && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Пульсирующая печать */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: "min(80vw, 480px)", height: "min(80vw, 480px)" }}
          >
            {/* Внешнее кольцо */}
            <div
              className="absolute inset-0 rounded-full border-2"
              style={{
                borderColor: aura.primary,
                boxShadow: `0 0 40px ${aura.glow}, inset 0 0 40px ${aura.glow}`,
                animation: "primePulse 1.2s ease-in-out infinite",
              }}
            />
            {/* Внутренние кольца */}
            <div
              className="absolute rounded-full border"
              style={{
                inset: "15%",
                borderColor: aura.primary,
                opacity: 0.5,
                animation: "primePulse 1.2s ease-in-out infinite 0.2s",
              }}
            />
            <div
              className="absolute rounded-full border"
              style={{
                inset: "30%",
                borderColor: aura.primary,
                opacity: 0.3,
                animation: "primePulse 1.2s ease-in-out infinite 0.4s",
              }}
            />
            {/* Сигил героя в центре */}
            <div
              className="text-7xl"
              style={{
                color: aura.primary,
                textShadow: `0 0 20px ${aura.glow}`,
                animation: "primePulse 1.2s ease-in-out infinite",
              }}
            >
              {isRemi ? "🌿" : "🪆"}
            </div>
            {/* Глитч-линии */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${20 + Math.random() * 60}%`,
                  height: "1px",
                  background: aura.primary,
                  opacity: 0.4,
                  animation: `primeGlitchLine ${0.4 + Math.random() * 0.4}s steps(2) infinite`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </div>
          {/* Текст снизу */}
          <div
            className="absolute bottom-12 left-0 right-0 text-center"
            style={{ animation: "primeFlicker 0.3s steps(2) infinite" }}
          >
            <div
              className="font-vt323 text-2xl tracking-widest"
              style={{ color: aura.primary, textShadow: `0 0 10px ${aura.glow}` }}
            >
              {"// ПРОБУЖДЕНИЕ ИСТИННОЙ ФОРМЫ //"}
            </div>
            <div className="text-[10px] text-dim tracking-widest mt-2">
              {"// печать слабеет... //"}
            </div>
          </div>
        </div>
      )}

      {/* ────────── Фаза 2: BURST — вспышка ────────── */}
      {phase === "burst" && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `radial-gradient(circle at center, ${aura.primary} 0%, ${aura.secondary} 30%, #000 70%)`,
            animation: "primeBurst 1s ease-out forwards",
          }}
        >
          {/* Разлетающиеся осколки печати */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            const dist = 200 + Math.random() * 300;
            return (
              <div
                key={i}
                className="absolute"
                style={{
                  width: "2px",
                  height: "2px",
                  background: "#fff",
                  boxShadow: `0 0 8px ${aura.primary}`,
                  transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`,
                  animation: `primeShard 1s ease-out forwards`,
                  animationDelay: `${i * 0.01}s`,
                }}
              />
            );
          })}
          {/* Центральная вспышка */}
          <div
            className="font-vt323 text-6xl"
            style={{
              color: "#fff",
              textShadow: `0 0 40px ${aura.primary}, 0 0 80px ${aura.primary}`,
              animation: "primeFlash 0.6s ease-out",
            }}
          >
            {isRemi ? "🐺" : "🪆"}
          </div>
        </div>
      )}

      {/* ────────── Фазы 3 и 4: REVEAL и STATS ────────── */}
      {(phase === "reveal" || phase === "stats") && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-8"
          style={{
            background: `radial-gradient(ellipse at center, ${aura.secondary}22 0%, #000 80%)`,
            animation: "primeRevealIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          {/* Аура-фон вокруг арта */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${aura.glow} 0%, transparent 50%)`,
              animation: "primeAura 4s ease-in-out infinite",
            }}
          />

          {/* CRT scanlines + noise поверх */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
              opacity: 0.5,
            }}
          />

          {/* Арт */}
          <div
            className="relative max-h-[55vh] sm:max-h-[60vh] w-auto"
            style={{
              filter: `drop-shadow(0 0 40px ${aura.glow}) drop-shadow(0 0 80px ${aura.glow})`,
              animation: "primeArtIn 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            <img
              src={imageUrl}
              alt={`${heroName} — Prime Form`}
              className="max-h-[55vh] sm:max-h-[60vh] w-auto object-contain"
              style={{
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
              }}
            />
          </div>

          {/* Заголовок */}
          <div
            className="mt-6 text-center"
            style={{ animation: "primeTextIn 1s ease-out 0.5s both" }}
          >
            <div
              className="font-medieval text-2xl sm:text-4xl tracking-wider"
              style={{
                color: aura.primary,
                textShadow: `0 0 20px ${aura.glow}, 0 0 40px ${aura.glow}`,
              }}
            >
              {heroName.toUpperCase()}
            </div>
            <div
              className="font-vt323 text-lg sm:text-xl tracking-widest mt-1"
              style={{ color: aura.primary, opacity: 0.85 }}
            >
              {aura.name}
            </div>
          </div>

          {/* Фаза STATS — таблица + кнопка закрыть */}
          {phase === "stats" && (
            <div
              className="mt-6 w-full max-w-md panel-inset p-4"
              style={{
                animation: "primeStatsIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                borderColor: aura.primary,
                boxShadow: `0 0 20px ${aura.glow}`,
              }}
            >
              <div
                className="text-[10px] tracking-widest mb-3 text-center"
                style={{ color: aura.primary }}
              >
                {"// ХАРАКТЕРИСТИКИ PRIME FORM //"}
              </div>
              <div className="space-y-1.5 text-[11px] font-mono-crt">
                {isRemi ? (
                  <>
                    <StatRow label="КЛАСС" value="Друид · Круг Пастырей" color={aura.primary} />
                    <StatRow label="ФОРМА" value="Древоликий Вождь" color={aura.primary} />
                    <StatRow label="УРОВЕНЬ" value="20 / 20" color={aura.primary} />
                    <StatRow label="СИЛА" value="14 (+2)" color={aura.primary} />
                    <StatRow label="МУДРОСТЬ" value="22 (+6)" color={aura.primary} />
                    <StatRow label="ПРИРОДНАЯ МАГИЯ" value="9 круг" color={aura.primary} />
                    <StatRow label="ФАМИЛЬЯР" value="Пинки (эмиссар)" color={aura.primary} />
                    <StatRow label="СПОСОБНОСТЬ" value="Древо Жизни · Mass Heal" color={aura.primary} />
                    <StatRow label="УЯЗВИМОСТЬ" value="Кристалл. болезнь (дед)" color="#ff6b6b" />
                  </>
                ) : (
                  <>
                    <StatRow label="КЛАСС" value="Чародей · Телекинетик" color={aura.primary} />
                    <StatRow label="ФОРМА" value="Кукловод Разума" color={aura.primary} />
                    <StatRow label="УРОВЕНЬ" value="20 / 20" color={aura.primary} />
                    <StatRow label="ИНТЕЛЛЕКТ" value="24 (+7)" color={aura.primary} />
                    <StatRow label="ХАРИЗМА" value="20 (+5)" color={aura.primary} />
                    <StatRow label="ПСИ-УРОН" value="12d6" color={aura.primary} />
                    <StatRow label="КУКЛЫ" value="Чинчиро · Динамо" color={aura.primary} />
                    <StatRow label="СПОСОБНОСТЬ" value="Разрыв Печати · Mind Storm" color={aura.primary} />
                    <StatRow label="УЯЗВИМОСТЬ" value="Кали (запечатана)" color="#ff6b6b" />
                  </>
                )}
              </div>

              {/* Кнопка закрытия */}
              <button
                onClick={() => {
                  sfx.blip();
                  onClose();
                }}
                className="btn-crt clip-hud-sm w-full mt-4 py-2 text-xs"
                style={{
                  borderColor: aura.primary,
                  color: aura.primary,
                  background: `${aura.primary}11`,
                }}
              >
                ◂ ЗАКРЫТЬ PRIME FORM
              </button>
              <div className="text-[9px] text-dim mt-2 text-center tracking-wider">
                {"// esc для закрытия //"}
              </div>
            </div>
          )}

          {/* Подсказка во время REVEAL */}
          {phase === "reveal" && (
            <div
              className="absolute bottom-6 left-0 right-0 text-center pointer-events-none"
              style={{ animation: "primeFlicker 0.4s steps(2) infinite" }}
            >
              <span
                className="text-[10px] tracking-widest"
                style={{ color: aura.primary, opacity: 0.6 }}
              >
                {"// ИСТИННАЯ ФОРМА ОТКРЫТА //"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ────────── Анимации ────────── */}
      <style>{`
        @keyframes primePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.7; }
        }
        @keyframes primeFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes primeGlitchLine {
          0% { opacity: 0; transform: translateX(-10px); }
          50% { opacity: 0.6; }
          100% { opacity: 0; transform: translateX(10px); }
        }
        @keyframes primeBurst {
          0% { transform: scale(0.5); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: scale(2); opacity: 1; }
        }
        @keyframes primeShard {
          0% { opacity: 1; transform: translate(0, 0) scale(2); }
          100% { opacity: 0; transform: translate(var(--tx, 0), var(--ty, 0)) scale(0.5); }
        }
        @keyframes primeFlash {
          0% { transform: scale(0.3); opacity: 0; filter: blur(20px); }
          50% { transform: scale(1.2); opacity: 1; filter: blur(0); }
          100% { transform: scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes primeRevealIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes primeArtIn {
          0% { opacity: 0; transform: scale(0.7) translateY(40px); filter: blur(30px) drop-shadow(0 0 60px ${aura.glow}); }
          60% { opacity: 1; filter: blur(0) drop-shadow(0 0 40px ${aura.glow}); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0) drop-shadow(0 0 40px ${aura.glow}) drop-shadow(0 0 80px ${aura.glow}); }
        }
        @keyframes primeTextIn {
          0% { opacity: 0; transform: translateY(20px); letter-spacing: 0.5em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0.05em; }
        }
        @keyframes primeStatsIn {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes primeAura {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-dim tracking-wider shrink-0">{label}</span>
      <span className="truncate text-right" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
