"use client";

import { useRef, useState } from "react";
import {
  CorruptedText,
  CORRUPT_OPEN,
  CORRUPT_CLOSE,
  OBLIVION_OPEN,
  OBLIVION_CLOSE,
  hasAnyMarks,
  hasCorruptMarks,
  hasOblivionMarks,
  stripAllMarks,
} from "./CorruptedText";
import { sfx } from "@/lib/audio";

// ============================================================================
// ТУЛБАР ИСКАЖЕНИЙ — «выделите текст и пометьте его».
// Ставится рядом с textarea описания в Мастерской и в режиме правки досье.
//
//   ⟦ ПОМЕТИТЬ ПОРЧЕЙ ⟧     — оборачивает выделение в ⟦…⟧: слова станут
//                              нечитаемыми глифами с багровым свечением;
//                              иногда сквозь помехи проступает призрак слова.
//   ⟪ ПОЛНОЕ ИСКАЖЕНИЕ ⟫    — оборачивает выделение в ⟪…⟫: фрагмент
//                              растворяется БЕЗВОЗВРАТНО. Не светится —
//                              переливается ирисом (бирюза→аметист→роза→
//                              золото). Никаких призраков: смысл утрачен.
//   ✕ СНЯТЬ ВСЕ МЕТКИ       — убирает обе разновидности меток из текста.
//
// Под тулбаром — живой предпросмотр: помеченные фрагменты рисуются
// так же, как их увидят стражи в досье.
// ============================================================================

interface CorruptToolbarProps {
  /** ссылка на textarea, в которой работает выделение */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  /** акцентный цвет превью (тема досье) */
  accent?: string;
  /** v5.5 — палитра ириса для превью (ключ из IRIS_PALETTES) */
  irisPalette?: string | null;
  /** компактный режим (для правки досье) */
  compact?: boolean;
}

export function CorruptToolbar({
  textareaRef,
  value,
  onChange,
  accent,
  irisPalette,
  compact = false,
}: CorruptToolbarProps) {
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashHint = (text: string) => {
    setHint(text);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2600);
  };

  /** Оборачивает/разворачивает выделение в метки заданного вида (toggle). */
  const wrapSelection = (open: string, close: string, sfxOn: () => void) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    if (e - s < 1) {
      flashHint("сначала выделите фрагмент текста");
      sfx.error();
      return;
    }
    const before = value.slice(0, s);
    const sel = value.slice(s, e);
    const after = value.slice(e);
    // выделение уже обёрнуто в метки — снимаем их (toggle)
    if (before.endsWith(open) && after.startsWith(close)) {
      onChange(before.slice(0, -open.length) + sel + after.slice(close.length));
      sfx.blip();
      return;
    }
    onChange(before + open + sel + close + after);
    sfxOn();
  };

  const toggleCorrupt = () =>
    wrapSelection(CORRUPT_OPEN, CORRUPT_CLOSE, () => sfx.whisper());

  const toggleOblivion = () =>
    wrapSelection(OBLIVION_OPEN, OBLIVION_CLOSE, () => sfx.whisper());

  const clearAll = () => {
    if (!hasAnyMarks(value)) {
      flashHint("в тексте нет искажений");
      return;
    }
    onChange(stripAllMarks(value));
    sfx.blip();
  };

  const corruptCount = (value.split(CORRUPT_OPEN).length - 1);
  const oblivionCount = (value.split(OBLIVION_OPEN).length - 1);

  return (
    <div className="space-y-2">
      {/* кнопки */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={toggleCorrupt}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px]"
          style={{
            borderColor: "rgba(255,64,64,0.45)",
            color: "#ff7a7a",
            background: "rgba(255,36,36,0.07)",
          }}
          title="Выделите текст в описании и нажмите — он станет нечитаемым, но будет дышать красным и иногда показывать призрак слова. Повторное нажатие снимет порчу."
        >
          ⟦ ПОМЕТИТЬ ПОРЧЕЙ ⟧
        </button>
        <button
          type="button"
          onClick={toggleOblivion}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px]"
          style={{
            borderColor: "rgba(196,165,255,0.4)",
            color: "#c9a8ff",
            background: "rgba(150,100,255,0.06)",
          }}
          title="Выделите текст и нажмите — он растворится БЕЗВОЗВРАТНО: переливающиеся глифы вместо слов, без свечения и без призраков смысла. Полное искажение. Повторное нажатие вернёт текст."
        >
          ⟪ ПОЛНОЕ ИСКАЖЕНИЕ ⟫
        </button>
        <button
          type="button"
          onClick={clearAll}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px] opacity-80"
          title="Убрать все метки искажений (порчу и полное искажение) из текста"
        >
          ✕ СНЯТЬ ВСЕ МЕТКИ
        </button>
        <span className="text-[9px] text-dim tracking-wider">
          {corruptCount > 0 || oblivionCount > 0
            ? `// порча: ${corruptCount} · ирис: ${oblivionCount} //`
            : "// выделите текст: ⟦ порча ⟧ или ⟪ ирис ⟫ //"}
        </span>
        {hint && (
          <span
            className="text-[9px] glow-amber tracking-wider fade-in"
            role="status"
          >
            {hint}
          </span>
        )}
      </div>

      {/* живой предпросмотр */}
      {hasAnyMarks(value) && (
        <div
          className="panel-inset p-2.5 fade-in"
          style={{
            borderColor: hasOblivionMarks(value)
              ? "rgba(196,165,255,0.28)"
              : "rgba(255,64,64,0.28)",
          }}
        >
          <div className="text-[9px] text-dim tracking-widest mb-1.5">
            {"// ПРЕДПРОСМОТР: ТАК ЭТО УВИДЯТ СТРАЖИ //"}
          </div>
          <CorruptedText
            text={value}
            ratio={0}
            live
            accent={accent}
            irisPalette={irisPalette ?? undefined}
            paragraphClassName={`leading-relaxed ${
              compact ? "text-[12px]" : "text-[13px]"
            } text-[var(--text)] mb-1.5 last:mb-0`}
          />
          {hasOblivionMarks(value) && !hasCorruptMarks(value) && (
            <div className="oblivion-word text-[9px] tracking-widest mt-1.5">
              {"// СМЫСЛ УТРАЧЕН БЕЗВОЗВРАТНО — ИРИС НЕ ВОЗВРАЩАЕТ ДОЛГОВ //"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
