"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/audio";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; label: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "НАВИГАЦИЯ",
    shortcuts: [
      { keys: ["1", "—", "7"], label: "Перейти в секцию (1=Герои, 2=Фракции...)" },
      { keys: ["↑", "↓"], label: "Навигация в списках / Command Palette" },
      { keys: ["Enter"], label: "Выбрать элемент" },
      { keys: ["Esc"], label: "Закрыть модалку / оверлей" },
    ],
  },
  {
    title: "ПОИСК",
    shortcuts: [
      { keys: ["⌘", "K"], label: "Открыть Command Palette (быстрый поиск)" },
      { keys: ["Ctrl", "K"], label: "То же на Windows/Linux" },
    ],
  },
  {
    title: "АРХИВ",
    shortcuts: [
      { keys: ["?"], label: "Показать эту справку" },
      { keys: ["M"], label: "Свернуть/развернуть мини-карту" },
      { keys: ["W"], label: "Переключить мир (DND ↔ PF2E) без logout" },
      { keys: ["G"], label: "Сбросить прогрессию Взгляда (gaze)" },
    ],
  },
  {
    title: "СЕКРЕТНОЕ",
    shortcuts: [
      {
        keys: ["↑", "↑", "↓", "↓", "←", "→", "←", "→", "B", "A"],
        label: "Код Конами — открывает скрытую силу в досье Мартина",
      },
    ],
  },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Игнорируем, если фокус в текстовом поле
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // ? (Shift+/ на US, или обычный ? )
      if (e.key === "?" || (e.shiftKey && e.code === "Slash")) {
        e.preventDefault();
        setOpen((o) => !o);
        sfx.beep();
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Блокировка скролла при открытии
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="cmdk-overlay"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Справка по горячим клавишам"
    >
      <div
        className="cmdk-panel panel clip-hud"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="px-3 py-2 border-b border-[var(--line)] flex items-center gap-2">
          <span className="text-[10px] text-dim tracking-widest">
            {"// СПРАВКА_Горячие_Клавиши //"}
          </span>
          <span className="flex-1" />
          <span className="cmdk-hint">ESC</span>
        </div>

        {/* Группы шорткатов */}
        <div className="overflow-y-auto crt-scroll p-3 max-h-[60vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {GROUPS.map((g) => (
              <div key={g.title} className="panel-inset clip-hud-sm p-3">
                <div className="text-[10px] glow-green tracking-widest mb-2 border-b border-[var(--line)] pb-1">
                  {g.title}
                </div>
                <ul className="flex flex-col gap-2">
                  {g.shortcuts.map((sc, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-2 text-[11px]"
                    >
                      <span className="text-dim flex-1 leading-tight">
                        {sc.label}
                      </span>
                      <span className="flex items-center gap-0.5 shrink-0 flex-wrap justify-end">
                        {sc.keys.map((k, j) => (
                          <kbd
                            key={j}
                            className="cmdk-hint text-[10px]"
                            style={{ minWidth: "20px", textAlign: "center" }}
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Подсказка снизу */}
          <div className="mt-3 text-center text-[10px] text-dim tracking-wider type-cursor">
            {"// нажми ESC или кликни вне окна, чтобы закрыть //"}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
