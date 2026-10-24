"use client";

import { useSortable } from "@dnd-kit/sortable";
import { sfx } from "@/lib/audio";
import { RowView } from "./drafts";

// ── Строка списка записей (sortable) ────────────────────────────────────────

export function RecordRow({
  v,
  i,
  sysColor,
  sortable,
  canDrag,
  isConfirm,
  onClone,
  onEdit,
  onDelete,
}: {
  v: RowView;
  i: number;
  sysColor: string;
  /** вкладка поддерживает порядок (герои/лор/локации/фракции) */
  sortable: boolean;
  /** перетаскивание доступно прямо сейчас (без поиска/фильтра) */
  canDrag: boolean;
  isConfirm: boolean;
  onClone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: v.id,
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      className={`panel clip-hud-sm p-2.5 flex items-center gap-3 card-stagger transition-all hover:border-[var(--amber-dim)] ${
        isDragging ? "opacity-30 border-dashed" : ""
      }`}
      style={
        {
          "--card-i": Math.min(i, 14),
          borderColor: isDragging ? "var(--amber-dim)" : undefined,
        } as React.CSSProperties
      }
    >
      {/* ⠿ ручка порядка — перетащите, чтобы менять порядок в архиве */}
      {sortable ? (
        canDrag ? (
          <button
            {...attributes}
            {...listeners}
            className={`text-[13px] leading-none w-5 shrink-0 flex items-center justify-center text-dim hover:text-[var(--amber)] cursor-grab active:cursor-grabbing transition-all focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--amber)] ${
              isDragging ? "drag-handle-active" : ""
            }`}
            style={{ touchAction: "none" }}
            aria-label={`Изменить порядок: ${v.name}`}
            title="Перетащите — запись встанет на новое место в архиве у всех стражей"
          >
            ⠿
          </button>
        ) : (
          <span
            className="text-[13px] leading-none w-5 shrink-0 flex items-center justify-center text-dim opacity-30"
            title="Перетаскивание доступно на полном списке — очистите поиск и фильтры"
            aria-hidden
          >
            ⠿
          </span>
        )
      ) : null}
      <span
        className="text-lg shrink-0 w-8 h-8 flex items-center justify-center panel-inset"
        style={{ color: sysColor }}
        aria-hidden
      >
        {v.sigil}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] glow-green truncate max-w-[240px] sm:max-w-xs">
            {v.name}
          </span>
          {v.chips.map((c, ci) => (
            <span
              key={ci}
              className={`chip text-[9px] ${c.cls ?? ""}`}
              title={c.title}
            >
              {c.text}
            </span>
          ))}
        </div>
        {v.subtitle && (
          <div className="text-[10px] text-dim tracking-wider truncate">
            {v.subtitle}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onClone}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px]"
          style={{
            borderColor: "var(--violet-dim)",
            color: "var(--violet)",
            background: "rgba(167, 139, 250, 0.08)",
          }}
          aria-label={`Дублировать ${v.name}`}
          title="Дублировать запись (черновик-копия)"
        >
          ⧉
        </button>
        <button
          onClick={onEdit}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px]"
          style={{
            borderColor: "var(--amber-dim)",
            color: "var(--amber)",
            background: "rgba(232, 161, 58, 0.08)",
          }}
          aria-label={`Редактировать ${v.name}`}
        >
          ✎
        </button>
        <button
          onClick={onDelete}
          onMouseEnter={() => sfx.hover()}
          className={`btn-crt clip-hud-sm px-2.5 py-1 text-[10px] ${
            isConfirm ? "btn-red glow-red" : ""
          }`}
          aria-label={`Удалить ${v.name}`}
        >
          {isConfirm ? "СЖЕЧЬ?" : "✕"}
        </button>
      </div>
    </div>
  );
}

