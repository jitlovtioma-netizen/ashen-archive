"use client";

import { CorruptToolbar } from "../CorruptEditorTools";
import { useEffect, useRef, useState } from "react";
import { SYSTEM_LABEL, type GameSystem } from "@/lib/types";
import { DOSSIER_THEMES, DOSSIER_THEME_KEYS, IRIS_PALETTES, IRIS_PALETTE_KEYS } from "@/lib/themes";
import { RecKind, SIGIL_PRESETS, Draft } from "./types";
import { Field, TextInput } from "./fields";

export interface RecordEditorProps {
  editor: {
    mode: "create" | "edit";
    kind: RecKind;
    id: string | null;
    name: string;
    draft: Draft;
  };
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  tabSystem: GameSystem;
  factions: { id: string; name: string }[];
  media: string[];
  /** логин администратора — для загрузки файлов */
  requester: string;
  /** коды существующих достижений — подсказка в поле награды загадки */
  achievementCodes: string[];
  saving: boolean;
  saveError: string | null;
  /** черновик отличается от исходника — показать «ИЗМЕНЕНО» и ⌫ */
  dirty: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** вернуть значения до правок */
  onReset: () => void;
}

export const KIND_LABEL: Record<RecKind, string> = {
  character: "досье",
  lore: "лор",
  location: "локация",
  faction: "фракция",
  riddle: "загадка-врата",
  achievement: "достижение",
};

export function RecordEditor({
  editor,
  draft,
  setDraft,
  tabSystem,
  factions,
  media,
  requester,
  achievementCodes,
  saving,
  saveError,
  dirty,
  onSave,
  onCancel,
  onReset,
}: RecordEditorProps) {
  const kind = editor.kind;
  const isCharacter = kind === "character";
  const isLore = kind === "lore";
  const isLocation = kind === "location";
  const isFaction = kind === "faction";
  const isRiddle = kind === "riddle";
  const isAchievement = kind === "achievement";
  const hasDossierTheme = isCharacter || isLore || isLocation;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  // загрузка файла с диска → public/uploads
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // textarea описания — нужна тулбару порчи для работы с выделением
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  // Ctrl+Enter — сохранить (в любом поле формы)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  const doUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("requester", requester);
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !d.ok || !d.url) {
        const hints: Record<string, string> = {
          TOO_BIG: "Файл больше 4 МБ — сожмите изображение",
          BAD_TYPE: "Поддерживаются PNG, JPEG, WebP и GIF",
          READONLY_FS:
            "Диск хостинга недоступен для записи — используйте ссылку https://… или положите файл в public/ репозитория",
          FORBIDDEN: "Только Созидатель может загружать файлы",
          FS_ERROR: "Не удалось записать файл — проверьте права на public/uploads",
        };
        setUploadError(hints[d.error ?? ""] ?? `Загрузка не удалась: ${d.error ?? res.status}`);
        return;
      }
      setDraft({ imageUrl: d.url });
    } catch {
      setUploadError("Сеть архива недоступна — попробуйте ещё раз");
    } finally {
      setUploading(false);
    }
  };

  // сброс флага загрузки картинки при смене пути — паттерн
  // «adjust-state-during-render» (без эффекта, без лишнего рендера)
  const [prevImage, setPrevImage] = useState(draft.imageUrl);
  if (prevImage !== draft.imageUrl) {
    setPrevImage(draft.imageUrl);
    setImgOk(true);
  }

  const nameLabel = isCharacter
    ? "ИМЯ ГЕРОЯ"
    : isLocation
      ? "НАЗВАНИЕ МЕСТА"
      : isFaction
        ? "НАЗВАНИЕ ФРАКЦИИ"
        : isRiddle
          ? "ИМЯ ЗАПИСИ-ВРАТ"
          : isAchievement
            ? "НАЗВАНИЕ ДОСТИЖЕНИЯ"
            : "НАЗВАНИЕ ЗАПИСИ";

  const namePlaceholder = isCharacter
    ? "напр. Каэль"
    : isRiddle
      ? "имя записи, к которой привязана загадка (напр. Мартин)"
      : isAchievement
        ? "напр. Первая печать"
        : "напр. Хроники Пепла";

  const descLabel = isRiddle
    ? "Текст загадки"
    : isAchievement
      ? "Описание достижения"
      : "Описание";
  const descMax = isRiddle ? 2000 : 6000;
  // мягкая рекомендация архива: досье длиннее 1500 символов читаются тяжело
  const descSoftMax = 1500;

  const showStatus = isCharacter || isLore;
  const showFriendship = isLore && draft.folder === "SECONDARY_HEROES";
  const showOrder = isCharacter || isLore || isLocation || isFaction;

  return (
    <div
      className="panel clip-hud brackets p-3 sm:p-4 space-y-3 fade-in"
      style={{
        borderColor: "var(--amber-dim)",
        boxShadow: "0 0 30px rgba(var(--amber-rgb),0.12)",
      }}
    >
      {/* header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip chip-warn text-[10px]">
          {editor.mode === "create" ? "✦ ТВОРЕНИЕ" : "✎ ПРАВКА"}
        </span>
        <span className="text-[10px] text-dim tracking-wider">
          {editor.mode === "create"
            ? `// новая запись · ${KIND_LABEL[kind]} · ${SYSTEM_LABEL[tabSystem]} //`
            : `// ${editor.name} · ${KIND_LABEL[kind]} · ${SYSTEM_LABEL[tabSystem]} //`}
        </span>
        <span className="flex-1" />
        <button
          onClick={onCancel}
          disabled={saving}
          className="btn-crt clip-hud-sm px-2 py-0.5 text-[11px]"
          aria-label="Закрыть форму"
        >
          ✕
        </button>
      </div>

      {/* main fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={nameLabel}>
          <TextInput
            value={draft.name}
            onChange={(v) => setDraft({ name: v })}
            maxLength={120}
            placeholder={namePlaceholder}
          />
        </Field>

        {isAchievement && (
          <Field label="КОД (ЛАТИНИЦА + _)">
            <TextInput
              value={draft.code}
              onChange={(v) =>
                setDraft({ code: v.replace(/[^A-Za-z0-9_]/g, "").toUpperCase() })
              }
              maxLength={60}
              placeholder="напр. FIRST_SHARD"
            />
          </Field>
        )}

        {isRiddle && (
          <>
            <Field label="ЗАГОЛОВОК ВРАТ">
              <TextInput
                value={draft.title}
                onChange={(v) => setDraft({ title: v })}
                maxLength={120}
                placeholder="напр. МАРТИН (как в вратах)"
              />
            </Field>
            <Field label="ПОДЗАГОЛОВОК">
              <TextInput
                value={draft.subtitle}
                onChange={(v) => setDraft({ subtitle: v })}
                maxLength={120}
                placeholder="напр. // теневой покровитель //"
              />
            </Field>
          </>
        )}

        {(isRiddle || isAchievement) && (
          <Field label="МИР">
            <select
              value={draft.scopeSystem}
              onChange={(e) => setDraft({ scopeSystem: e.target.value })}
              className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)]"
            >
              <option value="">☾ Любой мир</option>
              <option value="DND">Элария (D&D)</option>
              <option value="PF2E">Голарион (PF2e)</option>
            </select>
          </Field>
        )}

        {isCharacter && (
          <>
            <Field label="ЭПИТЕТ (TITLE)">
              <TextInput
                value={draft.title}
                onChange={(v) => setDraft({ title: v })}
                maxLength={120}
                placeholder="напр. Странник Пепла"
              />
            </Field>
            <Field label="КЛАСС / РОЛЬ">
              <TextInput
                value={draft.category}
                onChange={(v) => setDraft({ category: v })}
                maxLength={120}
                placeholder="напр. Паладин"
              />
            </Field>
            <Field label="РАСА">
              <TextInput
                value={draft.race}
                onChange={(v) => setDraft({ race: v })}
                maxLength={120}
                placeholder="напр. Полуэльф"
              />
            </Field>
            <Field label="ТИП ЗАПИСИ">
              <div className="flex gap-1.5 flex-wrap">
                {(
                  [
                    ["HERO", "⚔ ГЕРОЙ"],
                    ["NPC", "🎭 NPC ФРАКЦИИ"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ kind: k })}
                    className={`chip text-[10px] cursor-pointer transition-all ${
                      draft.kind === k
                        ? "chip-warn"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    aria-pressed={draft.kind === k}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            {draft.kind === "NPC" && (
              <Field label="ФРАКЦИЯ">
                <select
                  value={draft.factionId}
                  onChange={(e) => setDraft({ factionId: e.target.value })}
                  className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)]"
                >
                  <option value="">— без фракции —</option>
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}

        {isLore && (
          <>
            <Field label="КАТЕГОРИЯ">
              <TextInput
                value={draft.category}
                onChange={(v) => setDraft({ category: v })}
                maxLength={120}
                placeholder="напр. Эпоха, Событие, Божество"
              />
            </Field>
            <Field label="ПАПКА (РАЗДЕЛ АРХИВА)">
              <select
                value={draft.folder}
                onChange={(e) => setDraft({ folder: e.target.value })}
                className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)]"
              >
                <option value="">Общий лор</option>
                <option value="PANTHEON">Божества (Пантеон)</option>
                <option value="SECONDARY_HEROES">Второстепенные герои</option>
                <option value="SECRETS">Секреты (за осколки)</option>
              </select>
            </Field>
          </>
        )}

        {isLocation && (
          <Field label="ТИП МЕСТА">
            <TextInput
              value={draft.category}
              onChange={(v) => setDraft({ category: v })}
              maxLength={120}
              placeholder="напр. Город, Руины, Портал"
            />
          </Field>
        )}

        {isRiddle && (
          <>
            <Field label="ВЕРНЫЕ ОТВЕТЫ (ЧЕРЕЗ ЗАПЯТУЮ)">
              <TextInput
                value={draft.answers}
                onChange={(v) => setDraft({ answers: v })}
                maxLength={600}
                placeholder="напр. тьма, темнота, мрак"
              />
            </Field>
            <Field label="ПОДСКАЗКА ВНИЗУ ВРАТ">
              <TextInput
                value={draft.hint}
                onChange={(v) => setDraft({ hint: v })}
                maxLength={300}
                placeholder="напр. // назови то, что умирает последним //"
              />
            </Field>
            <Field label="🏆 НАГРАДА-ДОСТИЖЕНИЕ ЗА РАЗГАДКУ">
              <div>
                <TextInput
                  value={draft.achievementCode}
                  onChange={(v) =>
                    setDraft({
                      achievementCode: v.replace(/[^A-Za-z0-9_]/g, "").toUpperCase(),
                    })
                  }
                  maxLength={60}
                  placeholder="напр. RIDDLE_MASTER (пусто — без награды)"
                  list="admin-ach-codes"
                />
                <datalist id="admin-ach-codes">
                  {achievementCodes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {draft.achievementCode &&
                  !achievementCodes.includes(draft.achievementCode) && (
                    <div className="text-[9px] mt-1 glow-amber">
                      {"// достижения с таким кодом пока нет — создайте его во вкладке 🏆 ДОСТИЖЕНИЯ, иначе награды не будет //"}
                    </div>
                  )}
                {!draft.achievementCode && (
                  <div className="text-[9px] text-dim mt-1">
                    {"// решивший получит достижение с этим кодом //"}
                  </div>
                )}
              </div>
            </Field>
          </>
        )}

        {/* sigil */}
        <Field label="СИГИЛА (ЭМОДЗИ)">
          <div className="flex items-center gap-1.5 flex-wrap">
            <TextInput
              value={draft.sigil}
              onChange={(v) => setDraft({ sigil: v })}
              maxLength={8}
              className="w-16 text-center text-base"
            />
            {SIGIL_PRESETS.slice(0, 12).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft({ sigil: s })}
                className={`w-7 h-7 flex items-center justify-center panel-inset text-sm cursor-pointer transition-all hover:border-[var(--amber-dim)] ${
                  draft.sigil === s ? "border-[var(--amber-dim)] glow-amber" : ""
                }`}
                aria-label={`Сигила ${s}`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        {/* dossier theme color */}
        {hasDossierTheme && (
          <Field label="ЦВЕТ ДОСЬЕ (КАК ФИОЛЕТОВОЕ У КАЛИ)">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setDraft({ themeColor: "" })}
                className={`chip text-[10px] cursor-pointer transition-all ${
                  !draft.themeColor ? "chip-ok" : "opacity-60 hover:opacity-100"
                }`}
                aria-pressed={!draft.themeColor}
                title="Стандартное оформление архива"
              >
                ✓ СТАНДАРТ
              </button>
              {DOSSIER_THEME_KEYS.map((k) => {
                const t = DOSSIER_THEMES[k];
                const active = draft.themeColor === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ themeColor: k })}
                    className={`w-7 h-7 flex items-center justify-center cursor-pointer transition-all border ${
                      active ? "scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{
                      background: t.btnBg,
                      borderColor: active ? t.accent : t.border,
                      boxShadow: active ? `0 0 10px ${t.accentDim}` : undefined,
                      clipPath:
                        "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)",
                    }}
                    aria-label={`Цвет досье: ${t.label}`}
                    title={t.label}
                  >
                    <span style={{ color: t.accent, textShadow: `0 0 6px ${t.accentDim}` }}>
                      ◆
                    </span>
                  </button>
                );
              })}
              <span className="text-[9px] text-dim ml-1">
                {draft.themeColor
                  ? DOSSIER_THEMES[draft.themeColor]?.label
                  : "стандартное зелёное"}
              </span>
            </div>
          </Field>
        )}

        {/* v5.5 — палитра ириса для полного искажения (⟪…⟫) */}
        {hasDossierTheme && (
          <Field label="ПАЛИТРА ИРИСА (ПОЛНОЕ ИСКАЖЕНИЕ ⟪…⟫)">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setDraft({ irisColor: "" })}
                className={`chip text-[10px] cursor-pointer transition-all ${
                  !draft.irisColor ? "chip-ok" : "opacity-60 hover:opacity-100"
                }`}
                aria-pressed={!draft.irisColor}
                title="Авто: спектр ириса подстраивается под цвет досье (v5.4.1)"
              >
                ✓ АВТО
              </button>
              {IRIS_PALETTE_KEYS.map((k) => {
                const pal = IRIS_PALETTES[k];
                const active = draft.irisColor === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ irisColor: k })}
                    className={`w-9 h-6 flex items-center justify-center cursor-pointer transition-all border ${
                      active ? "scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{
                      background: pal.swatch,
                      borderColor: active
                        ? "rgba(216, 160, 255, 0.9)"
                        : "rgba(216, 160, 255, 0.25)",
                      boxShadow: active
                        ? "0 0 10px rgba(196, 165, 255, 0.45)"
                        : undefined,
                      clipPath:
                        "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)",
                    }}
                    aria-label={`Палитра ириса: ${pal.label}`}
                    title={`${pal.label} — ${pal.hint}`}
                  >
                    <span
                      className="text-[10px] font-bold"
                      style={{
                        color: "#fff",
                        textShadow: "0 0 4px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.6)",
                      }}
                    >
                      ꙮ
                    </span>
                  </button>
                );
              })}
              <span className="text-[9px] text-dim ml-1">
                {draft.irisColor
                  ? IRIS_PALETTES[draft.irisColor]?.label
                  : "авто — под цвет досье"}
              </span>
            </div>
          </Field>
        )}

        {/* image path */}
        {!isRiddle && !isAchievement && (
        <Field label="ПУТЬ К ИЗОБРАЖЕНИЮ">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <input
                value={draft.imageUrl}
                onChange={(e) => setDraft({ imageUrl: e.target.value })}
                list="admin-media-list"
                maxLength={500}
                placeholder="/heroes/example.png или https://…"
                className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)]"
                style={{ clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
              />
              <datalist id="admin-media-list">
                {media.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[9px] text-dim">
                  {"// файл в public/ или ссылка https://… //"}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void doUpload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="btn-crt clip-hud-sm px-2 py-0.5 text-[9px] disabled:opacity-50"
                  title="Загрузить картинку с диска — файл ляжет в public/uploads"
                >
                  {uploading ? "⏳ КАНАЛ…" : "⇪ С ДИСКА"}
                </button>
              </div>
              {uploadError && (
                <div className="text-[9px] mt-1 leading-relaxed" style={{ color: "var(--red)" }}>
                  ⚠ {uploadError}
                </div>
              )}
            </div>
            {draft.imageUrl.trim() && imgOk && (
              <div
                className="shrink-0 w-20 h-20 panel-inset flex items-center justify-center overflow-hidden"
                style={{ borderColor: "var(--amber-dim)" }}
              >
                <img
                  src={draft.imageUrl.trim()}
                  alt="Предпросмотр"
                  className="max-w-full max-h-full object-contain"
                  onError={() => setImgOk(false)}
                />
              </div>
            )}
            {draft.imageUrl.trim() && !imgOk && (
              <div className="shrink-0 w-20 h-20 panel-inset flex items-center justify-center text-[9px] text-dim text-center leading-tight p-1">
                файл не найден
              </div>
            )}
          </div>
        </Field>
        )}

        {/* status */}
        {showStatus && (
          <Field label="СТАТУС">
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
                  onClick={() => setDraft({ status: s })}
                  className={`chip text-[10px] cursor-pointer transition-all ${
                    draft.status === s ? "chip-warn" : "opacity-60 hover:opacity-100"
                  }`}
                  aria-pressed={draft.status === s}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* friendship */}
        {showFriendship && (
          <Field label="ДРУЖБА (0 = СКРЫТЬ)">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={10}
                disabled={draft.friendship === "-1"}
                value={draft.friendship && draft.friendship !== "-1" ? parseInt(draft.friendship, 10) : 0}
                onChange={(e) => setDraft({ friendship: e.target.value === "0" ? "" : e.target.value })}
                className="flex-1 accent-[var(--amber)] disabled:opacity-30"
                aria-label="Шкала дружбы"
              />
              <span className="text-[11px] glow-amber w-8 text-center">
                {draft.friendship === "-1" ? "???" : draft.friendship ? `${draft.friendship}/10` : "—"}
              </span>
              <button
                type="button"
                className="btn-crt px-2 py-0.5 text-[10px]"
                data-active={draft.friendship === "-1"}
                onClick={() => setDraft({ friendship: draft.friendship === "-1" ? "" : "-1" })}
                title="Отношения неизвестны — вместо шкалы показывается «???»"
              >
                НЕИЗВЕСТНО
              </button>
            </div>
          </Field>
        )}

        {/* sortOrder */}
        {showOrder && (
          <Field label="ПОРЯДОК СОРТИРОВКИ">
            <TextInput
              value={draft.sortOrder}
              onChange={(v) => setDraft({ sortOrder: v.replace(/[^\d-]/g, "") })}
              maxLength={5}
              placeholder="0"
            />
            <span className="text-[9px] text-dim mt-1 block">
              {"// меньше — выше; проще тянуть за ⠿ в списке //"}
            </span>
          </Field>
        )}
      </div>

      {/* description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-dim tracking-widest">
            {`// ${descLabel.toUpperCase()} //`}
          </span>
          <span
            className={`text-[9px] ${
              draft.description.length > descMax - 100
                ? "glow-red"
                : !isRiddle && !isAchievement && draft.description.length > descSoftMax
                  ? "glow-amber"
                  : "text-dim"
            }`}
            title={
              !isRiddle && !isAchievement && draft.description.length > descSoftMax
                ? "Архив рекомендует до 1500 символов — длинные досье читаются тяжело"
                : undefined
            }
          >
            {draft.description.length}/{descMax}
            {!isRiddle && !isAchievement && draft.description.length > descSoftMax
              ? " · длинновато"
              : ""}
          </span>
        </div>
        <textarea
          ref={descRef}
          value={draft.description}
          onChange={(e) => setDraft({ description: e.target.value })}
          maxLength={descMax}
          rows={7}
          spellCheck={false}
          className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-2 text-[13px] leading-relaxed text-[var(--text)] transition-colors crt-scroll resize-y min-h-[140px]"
          placeholder={
            isRiddle
              ? "Строки загадки. Пустая строка — новая строка в вратах…"
              : "Текст записи. Пустая строка — новый абзац…"
          }
        />
        {/* порча по выделению: только для текстов записей архива */}
        {!isRiddle && !isAchievement && (
          <div className="mt-2">
            <CorruptToolbar
              textareaRef={descRef}
              value={draft.description}
              onChange={(v) => setDraft({ description: v })}
              accent={
                draft.themeColor
                  ? DOSSIER_THEMES[draft.themeColor]?.accent
                  : undefined
              }
              irisPalette={draft.irisColor || undefined}
            />
          </div>
        )}
      </div>

      {/* mechanics */}
      {!isRiddle && !isAchievement && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="🧩 ОСКОЛОК ПАМЯТИ (СЛОВО)">
          <TextInput
            value={draft.shardWord}
            onChange={(v) => setDraft({ shardWord: v })}
            maxLength={60}
            placeholder="напр. надежда (пусто — нет осколка)"
          />
        </Field>
        <Field label="ФЛАГИ ЗАПИСИ">
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setDraft({ isLocked: !draft.isLocked })}
              className={`chip text-[10px] cursor-pointer transition-all ${
                draft.isLocked ? "chip-warn" : "opacity-60 hover:opacity-100"
              }`}
              aria-pressed={draft.isLocked}
              title="Запись опечатана — игрокам нужен ритуал"
            >
              🔒 {draft.isLocked ? "ПЕЧАТЬ ВКЛ" : "ПЕЧАТЬ ВЫКЛ"}
            </button>
            <button
              type="button"
              onClick={() => setDraft({ isCorrupted: !draft.isCorrupted })}
              className={`chip text-[10px] cursor-pointer transition-all ${
                draft.isCorrupted ? "chip-err" : "opacity-60 hover:opacity-100"
              }`}
              aria-pressed={draft.isCorrupted}
              title="Текст записи искажается корруптами"
            >
              ⚠ {draft.isCorrupted ? "ПОРЧА ВКЛ" : "ПОРЧА ВЫКЛ"}
            </button>
          </div>
        </Field>
      </div>
      )}

      {/* secret fragment */}
      {!isRiddle && (
      <div>
        <span className="text-[10px] text-dim tracking-widest mb-1 block">
          {"// ⟁ СОКРЫТОЕ (СКРЫТЫЙ ФРАГМЕНТ) //"}
        </span>
        <textarea
          value={draft.secretFragment}
          onChange={(e) => setDraft({ secretFragment: e.target.value })}
          maxLength={2000}
          rows={2}
          spellCheck={false}
          className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--violet-dim)] outline-none px-2.5 py-2 text-[12px] leading-relaxed text-[var(--text)] crt-scroll resize-y"
          placeholder="Тайна, которую игроки раскроют кнопкой в досье (пусто — нет тайны)…"
          style={{ borderColor: draft.secretFragment ? "var(--violet-dim)" : undefined }}
        />
      </div>
      )}

      {/* advanced */}
      {!isRiddle && !isAchievement && (
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-dim tracking-widest hover:text-[var(--amber)] transition-colors"
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? "▾" : "▸"} СЛУЖЕБНЫЕ ПОЛЯ (КАРТА)
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 mt-2 fade-in">
            <Field label="MAP_X">
              <TextInput
                value={draft.mapX}
                onChange={(v) => setDraft({ mapX: v.replace(/[^\d-]/g, "") })}
                maxLength={6}
                placeholder="0"
              />
            </Field>
            <Field label="MAP_Y">
              <TextInput
                value={draft.mapY}
                onChange={(v) => setDraft({ mapY: v.replace(/[^\d-]/g, "") })}
                maxLength={6}
                placeholder="0"
              />
            </Field>
          </div>
        )}
      </div>
      )}

      {/* ошибка — над панелью действий */}
      {saveError && (
        <div className="text-[11px] leading-relaxed" style={{ color: "var(--red)" }}>
          ⚠ {saveError}
        </div>
      )}
      {/* sticky-панель действий — всегда под рукой в длинной форме */}
      <div className="sticky bottom-2 z-20 -mx-1.5 px-1.5 py-1">
        <div
          className="panel clip-hud-sm p-2 flex items-center gap-2 flex-wrap"
          style={{
            borderColor: dirty ? "var(--amber-dim)" : "var(--line)",
            background:
              "color-mix(in srgb, var(--panel-1) 88%, transparent)",
            backdropFilter: "blur(6px)",
            boxShadow: dirty
              ? "0 6px 24px rgba(0,0,0,0.45), 0 0 18px rgba(var(--amber-rgb),0.10)"
              : "0 6px 24px rgba(0,0,0,0.45)",
          }}
        >
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-default"
          >
            {saving
              ? "▸ ЗАПИСЬ В АРХИВ…"
              : editor.mode === "create"
                ? "💾 ВОПЛОТИТЬ ЗАПИСЬ"
                : "💾 СОХРАНИТЬ ПРАВКИ"}
          </button>
          {dirty && !saving && (
            <span
              className="chip chip-warn dirty-pulse text-[9px]"
              title="Черновик отличается от сохранённой записи — автосохранён в браузере"
            >
              ● ИЗМЕНЕНО
            </span>
          )}
          <button
            onClick={onCancel}
            disabled={saving}
            className="btn-crt clip-hud-sm px-4 py-2 text-xs"
          >
            ✕ ОТМЕНА
          </button>
          {dirty && (
            <button
              onClick={onReset}
              disabled={saving}
              className="btn-crt clip-hud-sm px-3 py-2 text-[10px]"
              title="Вернуть значения, которые были при открытии формы"
            >
              ⌫ СБРОС
            </button>
          )}
          <span className="text-[9px] text-dim tracking-wider">
            {"// правки увидят все стражи · Ctrl+Enter — сохранить · черновик хранится в браузере //"}
          </span>
        </div>
      </div>
    </div>
  );
}
