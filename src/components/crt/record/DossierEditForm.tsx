"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { CorruptToolbar } from "../CorruptEditorTools";

export interface DossierDraft {
  description: string;
  title: string;
  status: "ALIVE" | "DEAD" | "MISSING";
}

interface DossierEditFormProps {
  draft: DossierDraft;
  setDraft: Dispatch<SetStateAction<DossierDraft>>;
  saving: boolean;
  saveError: string | null;
  descRef: RefObject<HTMLTextAreaElement | null>;
  accent?: string;
  onSave: () => void;
  onCancel: () => void;
}

/** «Режим записи»: владелец досье (или Созидатель) правит эпитет, статус и текст. */
export function DossierEditForm({
  draft,
  setDraft,
  saving,
  saveError,
  descRef,
  accent,
  onSave,
  onCancel,
}: DossierEditFormProps) {
  return (
    <div
      className="panel-inset p-3 space-y-3 fade-in"
      style={{ borderColor: "var(--amber-dim)", boxShadow: "inset 0 0 18px rgba(var(--amber-rgb),0.07)" }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip chip-warn text-[10px]">✎ РЕЖИМ ЗАПИСИ</span>
        <span className="text-[9px] text-dim tracking-wider">
          {"// перо в ваших руках. правки увидят все стражи архива //"}
        </span>
      </div>

      <div>
        <label
          htmlFor="dossier-title-edit"
          className="text-[10px] text-dim tracking-widest mb-1 block"
        >
          {"// ЭПИТЕТ //"}
        </label>
        <input
          id="dossier-title-edit"
          value={draft.title}
          onChange={(e) =>
            setDraft((d) => ({ ...d, title: e.target.value }))
          }
          maxLength={120}
          placeholder="напр. Капитан гарнизона"
          className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[13px] text-[var(--text)] transition-colors"
          style={{
            clipPath:
              "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
          }}
        />
      </div>

      <div>
        <div className="text-[10px] text-dim tracking-widest mb-1">
          {"// СТАТУС //"}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(
            [
              ["ALIVE", "✓ ЖИВ"],
              ["DEAD", "💀 ПАЛ"],
              ["MISSING", "? ПРОПАЛ"],
            ] as const
          ).map(([s, label]) => (
            <button
              key={s}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, status: s }))}
              className={`chip text-[10px] transition-all cursor-pointer ${
                draft.status === s
                  ? "chip-warn"
                  : "opacity-60 hover:opacity-100"
              }`}
              aria-pressed={draft.status === s}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="dossier-desc-edit"
            className="text-[10px] text-dim tracking-widest"
          >
            {"// ОПИСАНИЕ //"}
          </label>
          <span
            className={`text-[9px] ${
              draft.description.length > 5900 ? "glow-red" : "text-dim"
            }`}
          >
            {draft.description.length}/6000
          </span>
        </div>
        <textarea
          id="dossier-desc-edit"
          ref={descRef}
          value={draft.description}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
          maxLength={6000}
          rows={12}
          spellCheck={false}
          className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-2 text-[13px] leading-relaxed text-[var(--text)] transition-colors crt-scroll resize-y min-h-[220px]"
          placeholder="Впишите историю героя… Пустая строка — новый абзац."
        />
      </div>

      {/* порча по выделению: пометьте фрагменты — они станут нечитаемыми */}
      <CorruptToolbar
        textareaRef={descRef}
        value={draft.description}
        onChange={(v) =>
          setDraft((d) => ({ ...d, description: v }))
        }
        accent={accent}
        compact
      />

      {saveError && (
        <div
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--red)" }}
        >
          ⚠ {saveError}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onSave}
          disabled={saving}
          className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-default"
        >
          {saving ? "▸ ЗАПИСЬ В АРХИВ…" : "💾 СОХРАНИТЬ ДОСЬЕ"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="btn-crt clip-hud-sm px-4 py-2 text-xs"
        >
          ✕ ОТМЕНА
        </button>
      </div>
    </div>
  );
}
