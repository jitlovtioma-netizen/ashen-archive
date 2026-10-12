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
// ПОРЧА ПО ВЫДЕЛЕНИЮ (Мастерская): фрагмент текста, обёрнутый в метки
// ⟦ … ⟧, искажается ЦЕЛИКОМ — именно помеченные слова становятся
// нечитаемыми, остальной текст остаётся чистым. Метки ставятся кнопкой
// «ПОМЕТИТЬ ПОРЧЕЙ» в редакторе описания (выделите текст и нажмите).
//
// ПОЛНОЕ ИСКАЖЕНИЕ (⟪ … ⟫): как порча по выделению, но абсолютнее —
// фрагмент растворяется в переливающихся глифах без следов смысла.
// Порча «сопротивляется» чтению и иногда показывает призрак слова;
// полное искажение НИКОГДА не раскрывает себя — только ирис, только
// перелив. Не светится (порча светится) — переливается.
//
// Особые режимы:
//   zalgoAware — слова, содержащие zalgo-диакритику (текст, «расплавленный»
//                ещё при записи в архив), всегда считаются искажёнными.
//   protect    — слова, которые искажение не смеет тронуть (якоря смысла).
//   live=false — статичные глифы без мутации (для превью в карточках).
//   accent     — кастомный цвет порчи под тему досье (blue/green/amber…).
//   irisSpread — v5.6 «ирис поглощает»: доля ЧИСТЫХ слов, которые ирис
//                растворяет даже без меток — поглощение расползается за
//                пределы ⟪…⟫ с каждым повторным открытием досье.
// ============================================================================

const GLYPHS = "█▓▒░▚▞▐▌◢◣◤◥▀▄╳╱╲";
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
// Глифы полного искажения — «жидкий» набор: многоглазая ꙮ, фазы луны,
// круги и звёзды. Ирис не выдаёт ни одной буквы.
const OBLIVION_GLYPHS = "ꙮ◐◑◒◓◌◍☾✶✳▚▞▛▜╳⨂⨀";
const ZALGO_RE = /[\u0300-\u036F]/;
// глобальные версии: срезаем ВСЕ метки/блоки, а не только первую
const ZALGO_RE_G = /[\u0300-\u036F]/g;
const NOISE_RE_G = /[█▓▒░▚▞▐▌◢◣◤◥▀▄╳╱╲]/g;
const OBLIVION_NOISE_RE_G = /[ꙮ◐◑◒◓◌◍☾✶✳▚▞▛▜╳⨂⨀]/g;

// ── Метки порчи по выделению ────────────────────────────────────────────────
export const CORRUPT_OPEN = "⟦";
export const CORRUPT_CLOSE = "⟧";

// ── Метки полного искажения по выделению ────────────────────────────────────
export const OBLIVION_OPEN = "⟪";
export const OBLIVION_CLOSE = "⟫";

/** В тексте есть вручную помеченные порчей фрагменты. */
export function hasCorruptMarks(text: string): boolean {
  return text.includes(CORRUPT_OPEN) || text.includes(CORRUPT_CLOSE);
}

// v5.7 — стадии поглощения 0..6: доля ЧИСТЫХ слов, которую ирис съел к
// этому открытию (opens-1). 0..4 — «поглощение», 5..6 — «ирис не
// отпускает» (тает даже заголовок). Единая таблица для досье и карточки.
export const IRIS_SPREAD_BY_STAGE = [0, 0.1, 0.22, 0.38, 0.55, 0.68, 0.78] as const;
export const IRIS_MAX_STAGE = IRIS_SPREAD_BY_STAGE.length - 1;

/** В тексте есть фрагменты полного искажения. */
export function hasOblivionMarks(text: string): boolean {
  return text.includes(OBLIVION_OPEN) || text.includes(OBLIVION_CLOSE);
}

/** В тексте есть любые метки искажения (порча или полное искажение). */
export function hasAnyMarks(text: string): boolean {
  return hasCorruptMarks(text) || hasOblivionMarks(text);
}

/** Убирает метки порчи (для превью «как читается текст»). */
export function stripCorruptMarks(text: string): string {
  return text.split(CORRUPT_OPEN).join("").split(CORRUPT_CLOSE).join("");
}

/** Убирает метки полного искажения. */
export function stripOblivionMarks(text: string): string {
  return text.split(OBLIVION_OPEN).join("").split(OBLIVION_CLOSE).join("");
}

/** Убирает ВСЕ метки искажения (порчу и полное искажение). */
export function stripAllMarks(text: string): string {
  return stripOblivionMarks(stripCorruptMarks(text));
}

/** Разбор текста на прогоны: обычный, «порченый» (в ⟦…⟧) и
 *  «растворённый» (в ⟪…⟫ — полное искажение). */
type RunKind = "plain" | "corrupt" | "oblivion";
type Run = { text: string; kind: RunKind };

const MARK_PAIRS: Array<{ open: string; close: string; kind: RunKind }> = [
  { open: CORRUPT_OPEN, close: CORRUPT_CLOSE, kind: "corrupt" },
  { open: OBLIVION_OPEN, close: OBLIVION_CLOSE, kind: "oblivion" },
];

function parseRuns(text: string): Run[] {
  const runs: Run[] = [];
  let plain = "";
  let i = 0;
  while (i < text.length) {
    // ближайшая открывающая метка из всех видов
    let best: { at: number; mark: (typeof MARK_PAIRS)[number] } | null = null;
    for (const m of MARK_PAIRS) {
      const at = text.indexOf(m.open, i);
      if (at !== -1 && (best === null || at < best.at)) best = { at, mark: m };
    }
    if (!best) {
      plain += text.slice(i);
      break;
    }
    plain += text.slice(i, best.at);
    const c = text.indexOf(best.mark.close, best.at + 1);
    const end = c === -1 ? text.length : c;
    if (plain) {
      runs.push({ text: plain, kind: "plain" });
      plain = "";
    }
    // незакрытая метка — весь остаток считается помеченным
    runs.push({ text: text.slice(best.at + 1, end), kind: best.mark.kind });
    i = c === -1 ? text.length : c + 1;
  }
  if (plain) runs.push({ text: plain, kind: "plain" });
  return runs;
}

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

function toOblivionGlyphs(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    // ирис перемешивает свой набор — без единого знакомого символа
    out += OBLIVION_GLYPHS[Math.floor(Math.random() * OBLIVION_GLYPHS.length)];
  }
  return out;
}

/** Оттенок (hue, 0..360) акцентного цвета темы досье — для сдвига
 *  палитры ириса: перелив начинается с акцентного тона. Ахроматические
 *  цвета (белый/серый) возвращают базу (166° — бирюза). */
function accentHue(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 166;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 166;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return h;
}

// Хвостаю пунктуацию оставляем читаемой — структура фразы должна
// проступать сквозь искажение (читаются запятые, но не слова).
function splitPunct(w: string): { core: string; tail: string } {
  const m = w.match(/^(.*?)([.,!?;:…»]+)$/);
  if (!m) return { core: w, tail: "" };
  return { core: m[1], tail: m[2] };
}

type Piece =
  | { t: "space"; s: string }
  | { t: "word"; w: string }
  | { t: "corrupt"; core: string; tail: string; glyphs: string; ghost?: boolean }
  | { t: "oblivion"; core: string; tail: string; glyphs: string; full: string };

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
  irisSpread = 0,
): Line[] {
  const lines: Line[] = [[]];
  const pushLine = () => lines.push([]);

  for (const run of parseRuns(text)) {
    const chunks = run.text.split("\n");
    chunks.forEach((chunk, ci) => {
      if (ci > 0) pushLine();
      for (const token of chunk.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          lines[lines.length - 1].push({ t: "space", s: token });
          continue;
        }
        // в zalgo-режиме срезаем диакритику и блочный шум (включая ирис
        // полного искажения) — остаётся чистое слово (для глифов той же
        // длины и для скринридеров)
        const stripped = zalgoAware
          ? token
              .replace(ZALGO_RE_G, "")
              .replace(NOISE_RE_G, "")
              .replace(OBLIVION_NOISE_RE_G, "")
          : token;
        if (!stripped) {
          lines[lines.length - 1].push({ t: "space", s: token });
          continue;
        }
        const { core, tail } = splitPunct(stripped);
        if (!core) {
          lines[lines.length - 1].push({ t: "word", w: token });
          continue;
        }
        const isZalgo = zalgoAware && ZALGO_RE.test(token);
        const isProtected =
          run.kind === "plain" && (protect.has(core) || protect.has(token));
        // Помеченный вручную фрагмент (⟦…⟧ / ⟪…⟫) портится ВСЕГДА — это воля
        // Созидателя. «Расплавленные» (zalgo) слова портятся с шансом
        // zalgoChance, остальные — с шансом ratio.
        const doCorrupt =
          run.kind !== "plain" ||
          (!isProtected &&
            (isZalgo ? Math.random() < zalgoChance : Math.random() < ratio));
        // v5.6 — ирис ПОГЛОЩАЕТ: чистые слова тоже могут раствориться в
        // переливающихся глифах (без меток!). Поглощение не трогает
        // уже испорченные (не двойной эффект) и защищённые слова.
        const doSwallow =
          !doCorrupt &&
          irisSpread > 0 &&
          run.kind === "plain" &&
          !isProtected &&
          Math.random() < irisSpread;
        if (doSwallow) {
          const full = core + tail;
          lines[lines.length - 1].push({
            t: "oblivion",
            core,
            tail,
            glyphs: toOblivionGlyphs(core.length),
            full: toOblivionGlyphs(full.length),
          });
        } else if (doCorrupt) {
          if (run.kind === "oblivion") {
            // ПОЛНОЕ искажение: даже хвост-пунктуация растворяется —
            // от фразы остаётся только ритм пробелов.
            const full = core + tail;
            lines[lines.length - 1].push({
              t: "oblivion",
              core,
              tail,
              glyphs: toOblivionGlyphs(core.length),
              full: toOblivionGlyphs(full.length),
            });
          } else {
            lines[lines.length - 1].push({
              t: "corrupt",
              core,
              tail,
              glyphs: toGlyphs(core.length),
            });
          }
        } else {
          lines[lines.length - 1].push({ t: "word", w: core + tail });
        }
      }
    });
  }
  return lines;
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
  /** кастомный акцентный цвет порчи (тема досье: синяя, зелёная и т.д.) */
  accent?: string;
  /** v5.5 — палитра ириса (полное искажение): spectrum/emerald/blood/gold/…;
   *  null/"" — авто: спектр подстраивается под accent досье */
  irisPalette?: string | null;
  /** v5.6 — «ирис поглощает»: доля чистых слов, растворяемых ирисом
   *  без меток (0..1). Растёт со стадией поглощения досье. */
  irisSpread?: number;
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
  accent,
  irisPalette,
  irisSpread = 0,
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
  const buildKey = `${text}\u0001${ratio}\u0001${zalgoAware}\u0001${zalgoChance}\u0001${protectKey}\u0001${irisSpread}`;
  const [prevKey, setPrevKey] = useState(buildKey);
  const [lines, setLines] = useState<Line[]>(() =>
    buildLines(text, ratio, zalgoAware, new Set(protect), zalgoChance, irisSpread),
  );
  if (buildKey !== prevKey) {
    setPrevKey(buildKey);
    setLines(buildLines(text, ratio, zalgoAware, new Set(protect), zalgoChance, irisSpread));
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
      // координаты искажённых слов [line, piece] — порча И полное искажение
      const cand: Array<[number, number]> = [];
      const ghostCand: Array<[number, number]> = [];
      cur.forEach((line, li) =>
        line.forEach((p, pi) => {
          if (p.t === "corrupt" || p.t === "oblivion") cand.push([li, pi]);
          // призраки смысла — только у порчи: полное искажение никогда
          // не раскрывает себя
          if (p.t === "corrupt") ghostCand.push([li, pi]);
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
        } else if (p.t === "oblivion") {
          next[li][pi] = {
            ...p,
            glyphs: toOblivionGlyphs(p.core.length),
            full: toOblivionGlyphs(p.core.length + p.tail.length),
          };
        }
      }

      // «призрак смысла»: настоящее слово проступает на ~1.2с и растворяется
      if (!ghostRef.current && ghostCand.length > 0 && Math.random() < 0.09) {
        const [li, pi] = ghostCand[Math.floor(Math.random() * ghostCand.length)];
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

  // кастомная тема досье: акцентный цвет через CSS-переменную --acc;
  // ирис сдвигает палитру перелива под акцент (--iris-shift)
  const rootStyle = accent
    ? ({
        "--acc": accent,
        "--iris-shift": `${accentHue(accent) - 166}deg`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      className="corrupt-root"
      data-variant={accent ? "custom" : variant}
      data-iris={irisPalette || undefined}
      style={rootStyle}
    >
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
                if (p.t === "oblivion") {
                  return (
                    <span
                      key={pi}
                      className="oblivion-word"
                      title="Фрагмент растворён безвозвратно — смысл утрачен"
                    >
                      {/* переливающиеся глифы: фильтр наведения живёт на
                          внешнем span, анимации — на внутреннем (не
                          перебивают друг друга) */}
                      <span
                        aria-hidden="true"
                        className="oblivion-glyphs"
                        // органический сдвиг фазы перелива: каждое слово
                        // ириса течёт в своём ритме
                        style={{
                          animationDelay: `${-(pi * 0.37 + li * 0.61)}s`,
                        }}
                      >
                        {p.full}
                      </span>
                      {/* доступность: скринридер читает исходное слово */}
                      <span className="sr-only">{p.core}</span>
                    </span>
                  );
                }
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
