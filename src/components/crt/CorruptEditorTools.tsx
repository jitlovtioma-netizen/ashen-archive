"use client";

import { useRef, useState } from "react";
import {
  CorruptedText,
  CORRUPT_OPEN,
  CORRUPT_CLOSE,
  hasCorruptMarks,
  stripCorruptMarks,
} from "./CorruptedText";
import { sfx } from "@/lib/audio";

// ============================================================================
// ТУЛБАР ПОРЧИ — «выделите текст и пометьте его искажением».
// Ставится рядом с textarea описания в Мастерской и в режиме правки досье.
//
//   ⟦ ПОМЕТИТЬ ПОРЧЕЙ ⟧ — оборачивает текущее выделение метками ⟦…⟧;
//                          если выделение уже помечено — снимает метки.
//   ✕ СНЯТЬ ВСЮ ПОРЧУ   — убирает все метки из текста.
//
// Под тулбаром — живой предпросмотр: помеченные фрагменты рисуются
// глифами порчи так же, как их увидят стражи в досье.
// ============================================================================

interface CorruptToolbarProps {
  /** ссылка на textarea, в которой работает выделение */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  /** акцентный цвет превью (тема досье) */
  accent?: string;
  /** компактный режим (для правки досье) */
  compact?: boolean;
}

export function CorruptToolbar({
  textareaRef,
  value,
  onChange,
  accent,
  compact = false,
}: CorruptToolbarProps) {
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashHint = (text: string) => {
    setHint(text);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2600);
  };

  const toggleSelection = () => {
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
    if (before.endsWith(CORRUPT_OPEN) && after.startsWith(CORRUPT_CLOSE)) {
      onChange(before.slice(0, -1) + sel + after.slice(1));
      sfx.blip();
      return;
    }
    onChange(before + CORRUPT_OPEN + sel + CORRUPT_CLOSE + after);
    sfx.whisper();
  };

  const clearAll = () => {
    if (!hasCorruptMarks(value)) {
      flashHint("в тексте нет порчи");
      return;
    }
    onChange(stripCorruptMarks(value));
    sfx.blip();
  };

  const marksCount = (value.match(new RegExp(CORRUPT_OPEN, "g")) ?? []).length;

  return (
    <div className="space-y-2">
      {/* кнопки */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={toggleSelection}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px]"
          style={{
            borderColor: "rgba(255,64,64,0.45)",
            color: "#ff7a7a",
            background: "rgba(255,36,36,0.07)",
          }}
          title="Выделите текст в описании и нажмите — он станет нечитаемым. Повторное нажатие снимет порчу."
        >
          ⟦ ПОМЕТИТЬ ПОРЧЕЙ ⟧
        </button>
        <button
          type="button"
          onClick={clearAll}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px] opacity-80"
          title="Убрать все метки порчи из текста"
        >
          ✕ СНЯТЬ ВСЮ ПОРЧУ
        </button>
        <span className="text-[9px] text-dim tracking-wider">
          {marksCount > 0
            ? `// фрагментов порчи: ${marksCount} //`
            : "// выделите текст — он станет искажённым //"}
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
      {hasCorruptMarks(value) && (
        <div
          className="panel-inset p-2.5 fade-in"
          style={{ borderColor: "rgba(255,64,64,0.28)" }}
        >
          <div className="text-[9px] text-dim tracking-widest mb-1.5">
            {"// ПРЕДПРОСМОТР: ТАК ЭТО УВИДЯТ СТРАЖИ //"}
          </div>
          <CorruptedText
            text={value}
            ratio={0}
            live
            accent={accent}
            paragraphClassName={`leading-relaxed ${
              compact ? "text-[12px]" : "text-[13px]"
            } text-[var(--text)] mb-1.5 last:mb-0`}
          />
        </div>
      )}
    </div>
  );
}
