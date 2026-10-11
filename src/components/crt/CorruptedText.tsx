"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// ЖИВЫЕ КОРРУПТЫ — «запечатанный» текст архива.
//
// Слова, тронутые искажением, растворяются в глифах. Часть из них — блоки
// помех (как развалившийся сигнал), часть — древние руны (то, что проступает
// ИЗ-ПОД текста). Глифы не стоят на месте: каждые ~0.6с несколько слов
// перетекают в новые символы. А изредка сквозь помехи на миг проступает
// НАСТОЯЩЕЕ слово — «призрак смысла» — и тут же растворяется обратно.
//
// Особые режимы:
//   zalgoAware — слова, содержащие zalgo-диакритику (текст, «расплавленный»
//                ещё при записи в архив), всегда считаются искажёнными.
//   protect    — слова, которые искажение не смеет тронуть (якоря смысла).
//   live=false — статичные глифы без мутации (для превью в карточках).
// ============================================================================

const GLYPHS = "█▓▒░▚▞▐▌◢◣◤◥▀▄╳╱╲";
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
const ZALGO_RE = /[\u0300-\u036F]/;
// глобальные версии: срезаем ВСЕ метки/блоки, а не только первую
const ZALGO_RE_G = /[\u0300-\u036F]/g;
const NOISE_RE_G = /[█▓▒░▚▞▐▌◢◣◤◥▀▄╳╱╲]/g;

function randomGlyph(): string {
  // 65% — помехи сигнала, 35% — руническая примесь
  const src = Math.random() < 0.65 ? GLYPHS : RUNES;
  return src[Math.floor(Math.random() * src.length)];
}

function toGlyphs(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += randomGlyph();
  return out;
}

// Хвостую пунктуацию оставляем читаемой — структура фразы должна
// проступать сквозь искажение (читаются запятые, но не слова).
function splitPunct(w: string): { core: string; tail: string } {
  const m = w.match(/^(.*?)([.,!?;:…»]+)$/);
  if (!m) return { core: w, tail: "" };
  return { core: m[1], tail: m[2] };
}

type Piece =
  | { t: "space"; s: string }
  | { t: "word"; w: string }
  | { t: "corrupt"; core: string; tail: string; glyphs: string; ghost?: boolean };

type Line = Piece[];

// Якоря смысла в досье Кали: шесть грехов-слов, которые искажение
// не смеет тронуть — только они остаются читаемыми в расплавленном тексте.
export const KALI_ANCHORS = [
  "Лицимерие",
  "Двуличность",
  "Враг",
  "Никчёмность",
  "Смерть",
  "Боль",
];

function buildLines(
  text: string,
  ratio: number,
  zalgoAware: boolean,
  protect: Set<string>,
  zalgoChance = 1,
): Line[] {
  return text.split("\n").map((lineText) => {
    const line: Line = [];
    for (const token of lineText.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        line.push({ t: "space", s: token });
        continue;
      }
      // в zalgo-режиме срезаем диакритику и блочный шум — остаётся
      // чистое слово (для глифов той же длины и для скринридеров)
      const stripped = zalgoAware
        ? token.replace(ZALGO_RE_G, "").replace(NOISE_RE_G, "")
        : token;
      if (!stripped) {
        line.push({ t: "space", s: token });
        continue;
      }
      const { core, tail } = splitPunct(stripped);
      if (!core) {
        line.push({ t: "word", w: token });
        continue;
      }
      const isZalgo = zalgoAware && ZALGO_RE.test(token);
      const isProtected = protect.has(core) || protect.has(token);
      // «расплавленные» (zalgo) слова портятся с шансом zalgoChance —
      // остальные проступают читаемыми: сквозь помехи видна структура
      const doCorrupt =
        !isProtected &&
        (isZalgo
          ? Math.random() < zalgoChance
          : Math.random() < ratio);
      line.push(
        doCorrupt
          ? { t: "corrupt", core, tail, glyphs: toGlyphs(core.length) }
          : { t: "word", w: core + tail },
      );
    }
    return line;
  });
}

export interface CorruptedTextProps {
  text: string;
  /** доля слов, тронутых искажением (0..1), по умолчанию 0.42 */
  ratio?: number;
  /** слова с zalgo-метками всегда искажаются (текст «расплавлен» при записи) */
  zalgoAware?: boolean;
  /** шанс порчи «расплавленного» слова (0..1, по умолчанию 1 = все) */
  zalgoChance?: number;
  /** слова-якоря, которые искажение не смеет тронуть */
  protect?: string[];
  /** цветовая тема: красная (обычные искажения) или фиолетовая (проклятые) */
  variant?: "red" | "violet";
  /** живая мутация глифов (для досье); false — статичные (для карточек) */
  live?: boolean;
  /** маленькая строка «СИНХРОНИЗАЦИЯ… NN%» над текстом */
  syncLine?: boolean;
  /** класс каждого абзаца */
  paragraphClassName?: string;
}

export function CorruptedText({
  text,
  ratio = 0.42,
  zalgoAware = false,
  zalgoChance = 1,
  protect = [],
  variant = "red",
  live = true,
  syncLine = false,
  paragraphClassName = "",
}: CorruptedTextProps) {
  // Текст мог измениться (владелец отредактировал досье) — перестраиваем
  // узор порчи под новые данные. Каноничный паттерн «adjust state during
  // render»: сравниваем ключ входов, при смене пересобираем прямо в рендере
  // (без эффекта — нет каскадных ререндеров). Ключ вместо массива защищает
  // от ререндеров с новым идентификатором массива protect.
  const protectKey = protect.join("\u0000");
  const buildKey = `${text}\u0001${ratio}\u0001${zalgoAware}\u0001${zalgoChance}\u0001${protectKey}`;
  const [prevKey, setPrevKey] = useState(buildKey);
  const [lines, setLines] = useState<Line[]>(() =>
    buildLines(text, ratio, zalgoAware, new Set(protect), zalgoChance),
  );
  if (buildKey !== prevKey) {
    setPrevKey(buildKey);
    setLines(buildLines(text, ratio, zalgoAware, new Set(protect), zalgoChance));
  }
  const linesRef = useRef(lines);
  const ghostRef = useRef(false);
  const [syncPct, setSyncPct] = useState(47);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  // Живой дрейф глифов + «призраки смысла».
  useEffect(() => {
    if (!live) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // доступность: без вечного движения
    }

    const TICK = 620;
    const id = setInterval(() => {
      if (document.hidden) return;

      const cur = linesRef.current;
      // координаты искажённых слов [line, piece]
      const cand: Array<[number, number]> = [];
      cur.forEach((line, li) =>
        line.forEach((p, pi) => {
          if (p.t === "corrupt") cand.push([li, pi]);
        }),
      );
      if (!cand.length) return;

      const next = cur.map((line) => line.slice());
      const touch = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < touch; k++) {
        const [li, pi] = cand[Math.floor(Math.random() * cand.length)];
        const p = next[li][pi];
        if (p.t === "corrupt") {
          next[li][pi] = { ...p, glyphs: toGlyphs(p.core.length) };
        }
      }

      // «призрак смысла»: настоящее слово проступает на ~1.2с и растворяется
      if (!ghostRef.current && Math.random() < 0.09) {
        const [li, pi] = cand[Math.floor(Math.random() * cand.length)];
        const p = next[li][pi];
        if (p.t === "corrupt") {
          ghostRef.current = true;
          next[li][pi] = { ...p, ghost: true };
          setTimeout(() => {
            ghostRef.current = false;
            setLines((prev) =>
              prev.map((line) =>
                line.map((q) =>
                  q.t === "corrupt" && q.ghost
                    ? { ...q, ghost: false, glyphs: toGlyphs(q.core.length) }
                    : q,
                ),
              ),
            );
          }, 1200);
        }
      }

      setLines(next);
    }, TICK);

    return () => clearInterval(id);
  }, [live]);

  // Строка синхронизации: процент дрожит, но никогда не достигает 100.
  useEffect(() => {
    if (!syncLine || !live) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      setSyncPct(31 + Math.floor(Math.random() * 38)); // 31..68
    }, 900);
    return () => clearInterval(id);
  }, [syncLine, live]);

  const wordClass =
    variant === "violet" ? "corrupt-word corrupt-word--violet" : "corrupt-word";

  return (
    <div className="corrupt-root" data-variant={variant}>
      {syncLine && (
        <div className="corrupt-sync" aria-hidden="true">
          <span className="corrupt-sync-bar">
            <span style={{ width: `${syncPct}%` }} />
          </span>
          <span className="corrupt-sync-label">
            {"// СИНХРОНИЗАЦИЯ ПАМЯТИ… "}
            <span className="corrupt-sync-pct">{syncPct}%</span>
            {" // ПОТЕРИ ДАННЫХ //"}
          </span>
        </div>
      )}
      {lines.map((line, li) => (
        <p key={li} className={paragraphClassName || undefined}>
          {line.length === 0
            ? "\u00A0"
            : line.map((p, pi) => {
                if (p.t === "space") return p.s;
                if (p.t === "word") return p.w;
                return (
                  <span
                    key={pi}
                    className={
                      p.ghost ? `${wordClass} corrupt-ghost` : wordClass
                    }
                    title="Фрагмент повреждён — архив не может восстановить смысл"
                  >
                    {/* доступность: скринридер читает исходное слово */}
                    <span aria-hidden="true">{p.ghost ? p.core : p.glyphs}</span>
                    <span className="sr-only">{p.core}</span>
                    {p.tail}
                  </span>
                );
              })}
        </p>
      ))}
    </div>
  );
}
