"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { SYSTEM_COLOR, type GameSystem } from "@/lib/types";
import { getWatchdogStats, runWatchdogScanNow } from "./OverlayWatchdog";
import { RecKind, TabKey, AdminCharacterRow, AdminLoreRow, AdminLocationRow, AdminFactionRow, AdminData, AnyRow, TABS, Draft, FlagFilter, RESTORE_TABLE_LABELS, FLAG_FILTERS, EditorState, SORTABLE_TABS, draftKey } from "./admin/types";
import { emptyDraft, draftFromRow, buildPayload, tabForRecord, rowsForTab, rowView } from "./admin/drafts";
import { RecordRow } from "./admin/RecordRow";
import { RecordEditor } from "./admin/RecordEditor";
import { useDiagnostics } from "./admin/hooks";


// ─────────────────────────────────────────────────────────────────────────────
// МАСТЕРСКАЯ СОЗИДАТЕЛЯ — панель CRUD для всех записей архива.
// Администратор создаёт героев, второстепенных героев, божеств, секреты,
// лор, локации, фракции, загадки и достижения; правит и удаляет любую запись.
// Правки пишутся в общую базу — их видят ВСЕ стражи (dataRevision).
// Всё, что создано здесь, помечено userModified — merge-seed не трогает это
// при обновлениях архива (правки не сбрасываются).
// ─────────────────────────────────────────────────────────────────────────────

export function AdminSection({ system: userSystem }: { system: GameSystem }) {
  const user = useArchive((s) => s.user);
  const pushToast = useArchive((s) => s.pushToast);
  const bumpDataRevision = useArchive((s) => s.bumpDataRevision);
  const adminEditTarget = useArchive((s) => s.adminEditTarget);
  const setAdminEditTarget = useArchive((s) => s.setAdminEditTarget);

  const [tabSystem, setTabSystem] = useState<GameSystem>(userSystem);
  const [tab, setTab] = useState<TabKey>("heroes");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  /** черновик «как было» на момент открытия — для dirty/сброса */
  const [initialDraft, setInitialDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [media, setMedia] = useState<string[]>([]);
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("all");
  // v5.7 — «ирис в цифрах»: агрегация поглощения по всем стражам
  const [irisStats, setIrisStats] = useState<{
    totals: { records: number; players: number; opens: number; eaten: number };
    rows: { id: string; name: string; kind: string; system: string; opens: number; readers: number; stage: number; cleanWords: number; eaten: number }[];
  } | null>(null);
  // восстановление из бэкапа: превью и применение
  const [restorePreview, setRestorePreview] = useState<{
    report: Record<string, { restored: number; skipped: number }>;
    usersToRebind: number;
    exportedAt: string;
    dump: unknown;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const restoreFileRef = useRef<HTMLInputElement | null>(null);
  const { diag, runDiagnostics } = useDiagnostics(pushToast);

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  /**
   * Открыть редактор. Если в localStorage лежит несохранённый черновик этой
   * записи — вернуть именно его (тост «ЧЕРНОВИК ВОССТАНОВЛЕН»). Копия из ⧉
   * самодостаточна — для неё восстановление пропускаем.
   */
  const openEditorState = useCallback(
    (next: EditorState, skipRestore = false) => {
      // база для «dirty» и ⌫ СБРОС — всегда СВЕЖИЙ досье записи из базы,
      // даже если черновик восстановлен: сброс должен откатывать к оригиналу
      const freshDraft = next.draft;
      if (!skipRestore) {
        const key = draftKey(next, tabSystem);
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const saved = JSON.parse(raw) as Draft;
            if (JSON.stringify(saved) !== JSON.stringify(freshDraft)) {
              next = { ...next, draft: saved };
              pushToast({
                kind: "info",
                sigil: "⌫",
                title: "ЧЕРНОВИК ВОССТАНОВЛЕН",
                body: "Найден несохранённый черновик этой записи — «⌫ СБРОС» вернёт исходный текст.",
              });
            } else {
              localStorage.removeItem(key);
            }
          }
        } catch {
          /* повреждённый черновик — игнорируем */
        }
      }
      setInitialDraft(freshDraft);
      setEditor(next);
    },
    [tabSystem, pushToast],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/records?system=${tabSystem}`,
      );
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setData(d as AdminData);
      setError(null);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }, [user, tabSystem]);

  useEffect(() => {
    void load();
  }, [load]);

  // v5.7 — ирис-статистика (агрегация поглощения по всем стражам):
  // независимый запрос, не блокирует основную загрузку
  useEffect(() => {
    if (!user) return;
    fetch(`/api/admin/iris-stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.ok) setIrisStats({ totals: d.totals, rows: d.rows });
      })
      .catch(() => {});
  }, [user, data]);


  // список изображений для подсказок в поле «путь к изображению»
  useEffect(() => {
    fetch("/api/admin/media")
      .then((r) => r.json())
      .then((d: { images?: string[] }) => setMedia(d.images ?? []))
      .catch(() => {});
  }, []);


  // переход «в мастерскую» из досье: открыть форму нужной записи
  useEffect(() => {
    if (!adminEditTarget || !data) return;
    const { kind, id, system: recSystem } = adminEditTarget;
    if (recSystem !== tabSystem) {
      setTabSystem(recSystem);
      return; // данные перезагрузятся — эффект сработает снова
    }
    const pool: AnyRow[] =
      kind === "character"
        ? data.characters
        : kind === "lore"
          ? data.lore
          : kind === "location"
            ? data.locations
            : data.factions;
    const rec = pool.find((r) => r.id === id);
    setAdminEditTarget(null);
    if (rec) {
      setTab(tabForRecord(kind, rec));
      openEditorState({
        mode: "edit",
        kind,
        id,
        name: rowView(data, kind, rec).name,
        draft: draftFromRow(kind, rec),
      });
      setSaveError(null);
      sfx.select();
    } else {
      pushToast({
        kind: "warn",
        sigil: "✎",
        title: "ЗАПИСЬ НЕ НАЙДЕНА",
        body: "Возможно, она уже удалена из архива.",
      });
    }
  }, [adminEditTarget, data, tabSystem, openEditorState]);

  // сброс подтверждения удаления через 3.5с
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(null), 3500);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const rows = useMemo<AnyRow[]>(() => (data ? rowsForTab(data, tab) : []), [data, tab]);
  const views = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (flagFilter === "all") return true;
        const rr = r as unknown as Record<string, unknown>;
        if (flagFilter === "user") return rr.userModified === true;
        if (flagFilter === "corrupt") return rr.isCorrupted === true;
        if (flagFilter === "theme") return !!rr.themeColor;
        return rr.isLocked === true;
      })
      .map((r) => rowView(data, activeTab.kind, r))
      .filter((v) => {
        if (!q) return true;
        return (
          v.name.toLowerCase().includes(q) || v.subtitle.toLowerCase().includes(q)
        );
      });
  }, [data, rows, search, flagFilter, activeTab.kind]);

  // ── Порядок записей: drag-n-drop (⠿ в строке) ──
  // Перетаскивание доступно только на «чистом» списке: без поиска и фильтра —
  // иначе новый порядок подмножества неоднозначен.
  const canDrag =
    SORTABLE_TABS.has(tab) &&
    !search.trim() &&
    flagFilter === "all" &&
    !loading &&
    !error &&
    views.length > 1;

  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    sfx.blip();
  };

  /** Применить порядок локально: 10, 20, 30… и пересортировать пул вкладки. */
  const applyLocalOrder = (reordered: AnyRow[]): AdminData => {
    if (!data) throw new Error("no data");
    const orderMap = new Map(reordered.map((r, i) => [r.id, (i + 1) * 10]));
    const withOrder = (pool: AnyRow[]) =>
      pool
        .map((r) => {
          const o = orderMap.get(r.id);
          return o === undefined ? r : { ...r, sortOrder: o };
        })
        .sort((a, b) => {
          const oa = (a as unknown as { sortOrder?: number }).sortOrder ?? 0;
          const ob = (b as unknown as { sortOrder?: number }).sortOrder ?? 0;
          if (oa !== ob) return oa - ob;
          const ra = a as unknown as { name?: string; title?: string };
          const rb = b as unknown as { name?: string; title?: string };
          const na = ra.name ?? ra.title ?? "";
          const nb = rb.name ?? rb.title ?? "";
          return na.localeCompare(nb);
        });
    switch (activeTab.kind) {
      case "character":
        return { ...data, characters: withOrder(data.characters) as AdminCharacterRow[] };
      case "lore":
        return { ...data, lore: withOrder(data.lore) as AdminLoreRow[] };
      case "location":
        return { ...data, locations: withOrder(data.locations) as AdminLocationRow[] };
      case "faction":
        return { ...data, factions: withOrder(data.factions) as AdminFactionRow[] };
      default:
        return data;
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setDragId(null);
    if (!over || active.id === over.id || !data || !user) return;
    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const reordered = arrayMove(rows, oldIndex, newIndex);
    const activeName = views.find((v) => v.id === active.id)?.name ?? "запись";

    // оптимистично: список уже в новом порядке
    setData(applyLocalOrder(reordered));
    sfx.select();
    try {
      const res = await fetch("/api/admin/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: activeTab.kind,
          system: tabSystem,
          ids: reordered.map((r) => r.id),
        }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      bumpDataRevision();
      pushToast({
        kind: "info",
        sigil: "⠿",
        title: "ПОРЯДОК ОБНОВЛЁН",
        body: `«${activeName}» теперь на ${newIndex + 1}-м месте. Новый порядок увидят все стражи.`,
      });
    } catch (err) {
      sfx.error();
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "ПОРЯДОК НЕ СОХРАНЁН",
        body: `Архив отказал (${String((err as Error).message ?? err)}) — список перечитается из базы.`,
      });
      void load();
    }
  };

  const dragView = dragId ? views.find((v) => v.id === dragId) : null;

  // ── Сводка архива: счётчики здоровья и аудит длины текстов ──
  const stats = useMemo(() => {
    if (!data) return null;
    const content = [
      ...data.characters,
      ...data.lore,
      ...data.locations,
      ...data.factions,
    ] as unknown as Record<string, unknown>[];
    const themed = [...data.characters, ...data.lore, ...data.locations].filter(
      (r) => !!(r as unknown as Record<string, unknown>).themeColor,
    ).length;
    return {
      total: content.length,
      user: content.filter((r) => r.userModified === true).length,
      themed,
      corrupt: content.filter((r) => r.isCorrupted === true).length,
      locked: content.filter((r) => r.isLocked === true).length,
      rewardedRiddles: data.riddles.filter((q) => q.achievementCode).length,
      images: content.filter((r) => !!r.imageUrl).length,
    };
  }, [data]);

  const lenAudit = useMemo(() => {
    if (!data) return [];
    // id обязателен: key={`${it.kind}-${it.id}`} в рендере — без него все
    // ключи схлопывались в kind-undefined и React ругался на дубликаты
    const items: { kind: RecKind; rec: AnyRow; id: string; name: string; len: number }[] = [];
    for (const c of data.characters)
      items.push({ kind: "character", rec: c, id: c.id, name: c.name, len: c.description.length });
    for (const l of data.lore)
      items.push({ kind: "lore", rec: l, id: l.id, name: l.title, len: l.description.length });
    for (const loc of data.locations)
      items.push({ kind: "location", rec: loc, id: loc.id, name: loc.name, len: loc.description.length });
    return items.sort((a, b) => b.len - a.len).slice(0, 5);
  }, [data]);

  const jumpToRecord = (kind: RecKind, rec: AnyRow) => {
    if (!data) return;
    setTab(tabForRecord(kind, rec));
    setSearch("");
    setFlagFilter("all");
    openEditorState({
      mode: "edit",
      kind,
      id: rec.id,
      name: rowView(data, kind, rec).name,
      draft: draftFromRow(kind, rec),
    });
    setSaveError(null);
    sfx.select();
  };

  const openCreate = () => {
    openEditorState({
      mode: "create",
      kind: activeTab.kind,
      id: null,
      name: "",
      draft: emptyDraft(tab),
    });
    setSaveError(null);
    sfx.select();
  };

  const openEdit = (id: string) => {
    if (!data) return;
    const rec = rows.find((r) => r.id === id);
    if (!rec) return;
    openEditorState({
      mode: "edit",
      kind: activeTab.kind,
      id,
      name: rowView(data, activeTab.kind, rec).name,
      draft: draftFromRow(activeTab.kind, rec),
    });
    setSaveError(null);
    sfx.select();
  };

  // ⌫ сброс: вернуть значения до правок
  const resetDraft = () => {
    if (!editor || !initialDraft) return;
    setEditor((e) => (e ? { ...e, draft: initialDraft } : e));
    sfx.blip();
  };

  const closeEditor = () => {
    setEditor(null);
    setInitialDraft(null);
    setSaveError(null);
    sfx.blip();
  };

  // ── Автосохранение черновика: только когда есть правки; переживает
  // перезагрузку вкладки и случайные закрытия. Возврат к исходнику — стирает.
  const dirty = useMemo(
    () => !!editor && JSON.stringify(editor.draft) !== JSON.stringify(initialDraft),
    [editor, initialDraft],
  );

  useEffect(() => {
    if (!editor) return;
    const key = draftKey(editor, tabSystem);
    const t = setTimeout(() => {
      try {
        if (dirty) localStorage.setItem(key, JSON.stringify(editor.draft));
        else localStorage.removeItem(key);
      } catch {
        /* квота/приватный режим — молча */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [editor, dirty, tabSystem]);

  // защита от закрытия вкладки с несохранённой правкой
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ⧉ дублирование: черновик из записи, имя с суффиксом, код ачивки уникален
  const openClone = (id: string) => {
    if (!data) return;
    const rec = rows.find((r) => r.id === id);
    if (!rec) return;
    const d = draftFromRow(activeTab.kind, rec);
    if (activeTab.kind === "riddle") {
      d.title = `${d.title} (копия)`;
    } else if (activeTab.kind === "achievement") {
      d.code = `${d.code}_COPY`.slice(0, 60);
      d.name = `${d.name} (копия)`;
    } else {
      d.name = `${d.name} (копия)`;
    }
    // копия самодостаточна — прежний несохранённый «новый» черновик убираем
    try {
      localStorage.removeItem(
        draftKey(
          { mode: "create", kind: activeTab.kind, id: null, name: "", draft: d },
          tabSystem,
        ),
      );
    } catch {
      /* ignore */
    }
    openEditorState(
      {
        mode: "create",
        kind: activeTab.kind,
        id: null,
        name: "",
        draft: d,
      },
      true,
    );
    setSaveError(null);
    sfx.select();
  };

  // ⇩ бэкап: полный слепок архива в JSON
  const doBackup = async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/admin/export`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `archive-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      sfx.unlock();
      pushToast({
        kind: "ach",
        sigil: "⇩",
        title: "БЭКАП ГОТОВ",
        body: "Полный слепок архива скачан в JSON. Храните его в надёжном месте.",
      });
    } catch {
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "БЭКАП НЕ УДАЛСЯ",
        body: "Архив недоступен — попробуйте ещё раз.",
      });
      sfx.error();
    }
  };

  // ⇧ восстановление из бэкапа: чтение файла → превью на сервере → модалка
  const doRestoreFile = async (file: File) => {
    setRestoreError(null);
    try {
      const text = await file.text();
      let dump: unknown;
      try {
        dump = JSON.parse(text);
      } catch {
        setRestoreError("Файл не является корректным JSON — выберите бэкап архива");
        sfx.error();
        return;
      }
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", dump }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        const hints: Record<string, string> = {
          FORBIDDEN: "Только Созидатель может восстанавливать архив",
          BAD_DUMP: "Это не бэкап архива — файл создаётся кнопкой «⇩ БЭКАП»",
        };
        setRestoreError(hints[d.error as string] ?? `Архив отказал: ${d.error ?? res.status}`);
        sfx.error();
        return;
      }
      setRestorePreview({
        report: d.report,
        usersToRebind: d.usersToRebind,
        exportedAt: d.exportedAt,
        dump,
      });
      sfx.select();
    } catch {
      setRestoreError("Сеть архива недоступна — попробуйте ещё раз");
      sfx.error();
    }
  };

  const doRestoreApply = async () => {
    if (!restorePreview || !user) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          dump: restorePreview.dump,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setRestoreError(`Архив отказал: ${d.error ?? res.status}`);
        sfx.error();
        return;
      }
      const total = Object.values(d.restored as Record<string, number>).reduce(
        (a: number, b: number) => a + b,
        0,
      );
      setRestorePreview(null);
      await load();
      bumpDataRevision();
      sfx.unlock();
      pushToast({
        kind: "ach",
        sigil: "⇧",
        title: "АРХИВ ВОССТАНОВЛЕН",
        body:
          total > 0
            ? `Возвращено ${total} записей из бэкапа${d.rebound ? `, ${d.rebound} привязок досье` : ""}.`
            : "Бэкап не содержал утраченных записей — архив цел.",
      });
    } catch {
      setRestoreError("Сеть архива недоступна — попробуйте ещё раз");
      sfx.error();
    } finally {
      setRestoring(false);
    }
  };

  const save = async () => {
    if (!user || !editor) return;
    const d = editor.draft;
    if (!d.name.trim()) {
      setSaveError(
        editor.kind === "riddle"
          ? "Имя записи-врат не может быть пустым (напр. «Мартин»)"
          : "Имя записи не может быть пустым",
      );
      sfx.error();
      return;
    }
    if (editor.kind === "achievement" && !d.code.trim()) {
      setSaveError("Код достижения обязателен (латиница, цифры и _) — напр. FIRST_SHARD");
      sfx.error();
      return;
    }
    if (editor.kind === "riddle" && !d.answers.trim()) {
      setSaveError("Укажите хотя бы один верный ответ (через запятую)");
      sfx.error();
      return;
    }
    if (d.description.trim().length < 3) {
      setSaveError(
        editor.kind === "riddle"
          ? "Текст загадки слишком короткий (минимум 3 символа)"
          : "Описание слишком короткое (минимум 3 символа)",
      );
      sfx.error();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editor.mode === "create" ? "create" : "update",
          kind: editor.kind,
          id: editor.id ?? undefined,
          data: buildPayload(editor.kind, d, tabSystem),
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) {
        const hints: Record<string, string> = {
          FORBIDDEN: "Только Созидатель может творить здесь",
          NOT_FOUND: "Запись не найдена — возможно, уже удалена",
          BAD_NAME: "Имя отклонено (1..120 символов)",
          BAD_TITLE: "Название отклонено (1..120 символов)",
          BAD_DESCRIPTION: "Описание отклонено (1..6000 символов)",
          BAD_RIDDLE: "Текст загадки отклонён (1..2000 символов)",
          BAD_RECORDNAME: "Имя записи-врат отклонено (1..120 символов)",
          BAD_ANSWERS: "Укажите хотя бы один верный ответ (через запятую)",
          BAD_CODE: "Код: латиница, цифры и _ (напр. FIRST_SHARD)",
          BAD_ACH_CODE: "Код награды: латиница, цифры и _ (напр. RIDDLE_MASTER)",
          CODE_EXISTS: "Достижение с таким кодом уже существует",
          BAD_THEME_COLOR: "Недопустимый цвет досье",
          BAD_FOLDER: "Недопустимая папка лора",
          BAD_FACTION: "Фракция не найдена",
          FACTION_SYSTEM_MISMATCH: "Фракция принадлежит другому миру",
          EMPTY_DATA: "Нет полей для сохранения",
        };
        setSaveError(hints[resData.error as string] ?? `Архив отказал: ${resData.error}`);
        sfx.error();
        return;
      }
      const rec = resData.record as Record<string, unknown>;
      const recName = String(rec.name ?? rec.title ?? "запись");
      // сохранено — черновик больше не нужен
      try {
        if (editor) localStorage.removeItem(draftKey(editor, tabSystem));
      } catch {
        /* ignore */
      }
      setEditor(null);
      setInitialDraft(null);
      await load();
      bumpDataRevision();
      sfx.unlock();
      pushToast({
        kind: "ach",
        sigil: editor.mode === "create" ? "✦" : "✎",
        title: editor.mode === "create" ? "ЗАПИСЬ СОЗДАНА" : "ЗАПИСЬ ОБНОВЛЕНА",
        body: `${recName}. Правки увидят все стражи архива.`,
      });
    } catch {
      setSaveError("Сеть архива недоступна — попробуйте ещё раз");
      sfx.error();
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (id: string, name: string) => {
    if (!user) return;
    setConfirmDelete(null);
    try {
      const res = await fetch("/api/admin/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          kind: activeTab.kind,
          id,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) {
        pushToast({
          kind: "warn",
          sigil: "⚠",
          title: "АРХИВ ОТКАЗАЛ",
          body: `Не удалось удалить «${name}»: ${resData.error ?? res.status}`,
        });
        sfx.error();
        return;
      }
      if (editor?.id === id) {
        try {
          localStorage.removeItem(draftKey(editor, tabSystem));
        } catch {
          /* ignore */
        }
        setEditor(null);
        setInitialDraft(null);
      }
      await load();
      bumpDataRevision();
      sfx.thud();
      pushToast({
        kind: "warn",
        sigil: "🕯",
        title: "ЗАПИСЬ ПРЕДАНА ОГНЮ",
        body: `«${name}» развеяна из архива навсегда.`,
      });
    } catch {
      pushToast({
        kind: "warn",
        sigil: "⚠",
        title: "СЕТЬ НЕДОСТУПНА",
        body: "Не удалось удалить запись — попробуйте ещё раз.",
      });
    }
  };

  const sysColor = SYSTEM_COLOR[tabSystem];

  return (
    <section className="flex flex-col gap-3 h-full">
      {/* breadcrumb */}
      <div className="panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; МАСТЕРСКАЯ &gt;
        </span>
        <span className="text-[11px] glow-amber tracking-widest">
          ПЕРО_СОЗИДАТЕЛЯ
        </span>
        <span className="flex-1" />
        {/* переключатель мира */}
        <div className="flex gap-1">
          {(["DND", "PF2E"] as GameSystem[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setTabSystem(s);
                setEditor(null);
                sfx.select();
              }}
              className={`chip text-[10px] cursor-pointer transition-all ${
                tabSystem === s ? "" : "opacity-50 hover:opacity-100"
              }`}
              style={
                tabSystem === s
                  ? {
                      color: SYSTEM_COLOR[s],
                      borderColor: `color-mix(in srgb, ${SYSTEM_COLOR[s]} 50%, transparent)`,
                      background: `color-mix(in srgb, ${SYSTEM_COLOR[s]} 12%, var(--panel-2))`,
                    }
                  : undefined
              }
              aria-pressed={tabSystem === s}
            >
              {s === "DND" ? "ЭЛАРИЯ" : "ГОЛАРИОН"}
            </button>
          ))}
        </div>
      </div>

      {/* title */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-amber tracking-wider title-sweep">
          Мастерская Созидателя
        </h2>
        <span className="text-[10px] text-dim">
          {"// творите записи архива без посредников. правки видны всем //"}
        </span>
        <span className="chip chip-ok text-[10px]">
          ЗАПИСЕЙ: {views.length}
        </span>
      </div>

      {/* tabs */}
      <div className="flex gap-1 flex-wrap panel clip-hud-sm p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setSearch("");
              sfx.select();
            }}
            onMouseEnter={() => sfx.hover()}
            data-active={tab === t.key}
            className={`btn-crt clip-hud-sm px-2.5 py-1.5 text-[11px] flex items-center gap-1.5 ${
              tab === t.key ? "btn-amber" : "opacity-70 hover:opacity-100"
            }`}
            title={t.blurb}
          >
            <span className="text-sm leading-none">{t.sigil}</span>
            <span className="tracking-wider">{t.label}</span>
            {data && (
              <span className="text-[9px] text-dim">
                {rowsForTab(data, t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={openCreate}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs"
        >
          + СОЗДАТЬ ЗАПИСЬ
        </button>
        <button
          onClick={() => void doBackup()}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-3 py-2 text-[10px]"
          title="Скачать полный бэкап архива в JSON (страховка от случайной потери)"
        >
          ⇩ БЭКАП
        </button>
        <input
          ref={restoreFileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doRestoreFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => restoreFileRef.current?.click()}
          onMouseEnter={() => sfx.hover()}
          className="btn-crt clip-hud-sm px-3 py-2 text-[10px]"
          title="Восстановить утраченные записи из файла бэкапа (ничего не удаляет и не перезаписывает)"
        >
          ⇧ ВОССТАНОВИТЬ
        </button>
        {restoreError && (
          <span
            className="text-[10px] leading-relaxed max-w-[280px] truncate"
            style={{ color: "var(--red)" }}
            title={restoreError}
          >
            ⚠ {restoreError}
          </span>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="поиск по имени…"
          className="bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)] w-44"
          style={{ clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
          aria-label="Поиск записей"
        />
        <div className="flex gap-1 flex-wrap">
          {FLAG_FILTERS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setFlagFilter(k);
                sfx.hover();
              }}
              className={`chip text-[9px] cursor-pointer transition-all ${
                flagFilter === k ? "chip-ok" : "opacity-50 hover:opacity-100"
              }`}
              aria-pressed={flagFilter === k}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-dim tracking-wider flex-1 min-w-0 truncate">
          {activeTab.blurb}
          {SORTABLE_TABS.has(tab) && !loading && !error && views.length > 1 && (
            <>
              {" · "}
              {canDrag ? (
                <span className="glow-amber">⠿ тяните за ручку — задать порядок</span>
              ) : (
                <span>⠿ порядок — очистите поиск и фильтр</span>
              )}
            </>
          )}
        </span>
      </div>

      {/* editor */}
      {editor && (
        <RecordEditor
          editor={editor}
          draft={editor.draft}
          setDraft={(patch) =>
            setEditor((e) =>
              e ? { ...e, draft: { ...e.draft, ...patch } } : e,
            )
          }
          tabSystem={tabSystem}
          factions={
            data?.factions.map((f) => ({ id: f.id, name: f.name })) ?? []
          }
          media={media}
          requester={user?.login ?? ""}
          achievementCodes={data?.achievements.map((a) => a.code) ?? []}
          saving={saving}
          saveError={saveError}
          dirty={dirty}
          onSave={save}
          onCancel={closeEditor}
          onReset={resetDraft}
        />
      )}

      {/* сводка архива */}
      {data && stats && !editor && (
        <details className="panel clip-hud-sm p-3">
          <summary className="cursor-pointer tracking-widest text-[10px] glow-amber">
            {"// СВОДКА АРХИВА · ЗДОРОВЬЕ И АУДИТ //"}
          </summary>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {([
              ["ЗАПИСЕЙ ВСЕГО", stats.total, ""],
              ["✎ РУКОТВОРНЫХ", stats.user, stats.user > 0 ? "chip-ok" : ""],
              ["◆ ЦВЕТНЫХ ДОСЬЕ", stats.themed, ""],
              ["⚠ ПОРЧА", stats.corrupt, stats.corrupt > 0 ? "chip-err" : ""],
              ["🔒 ПЕЧАТЕЙ", stats.locked, stats.locked > 0 ? "chip-warn" : ""],
              ["🏆→🎯 НАГРАД", stats.rewardedRiddles, "chip-violet"],
            ] as [string, number, string][]).map(([label, value, cls]) => (
              <div
                key={label}
                className="panel-inset px-2.5 py-2 flex flex-col gap-0.5 transition-all hover:border-[var(--amber-dim)] hover:-translate-y-[1px]"
              >
                <span className="text-[9px] text-dim tracking-wider">{label}</span>
                <span className={`font-vt323 text-lg leading-none ${
                  cls === "chip-ok" ? "glow-green" : cls === "chip-err" ? "glow-red" : cls === "chip-warn" ? "glow-amber" : cls === "chip-violet" ? "glow-violet" : "glow-amber"
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          {/* мини-индикаторы здоровья архива */}
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              ["РУКОТВОРНАЯ ДОЛЯ", stats.user, stats.total, "var(--green)"],
              ["ОХВАТ КАРТИНКАМИ", stats.images, stats.total, "var(--amber)"],
              ["ОСКОЛКИ/ПЕЧАТИ — АТМОСФЕРА", stats.corrupt + stats.locked, stats.total, "var(--violet)"],
            ] as [string, number, number, string][]).map(([label, val, total, color]) => {
              const pct = total > 0 ? Math.min(100, Math.round((val / total) * 100)) : 0;
              return (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[9px] text-dim tracking-wider">
                    <span>{label}</span>
                    <span style={{ color }}>{pct}%</span>
                  </div>
                  <div
                    className="h-[4px] panel-inset overflow-hidden"
                    style={{ padding: 0 }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}44, ${color})`,
                        boxShadow: `0 0 8px ${color}66`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <span className="text-[10px] text-dim tracking-widest">
              {"// АУДИТ ДЛИНЫ ТЕКСТОВ — САМЫЕ ДЛИННЫЕ (клик — править) //"}
            </span>
            <div className="mt-1 flex flex-col gap-1">
              {lenAudit.map((it) => (
                <button
                  key={`${it.kind}-${it.id}`}
                  onClick={() => jumpToRecord(it.kind, it.rec)}
                  onMouseEnter={() => sfx.hover()}
                  className="panel-inset px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-all hover:border-[var(--amber-dim)] text-left"
                >
                  <span className="text-[11px] glow-green truncate">{it.name}</span>
                  <span
                    className={`text-[10px] shrink-0 ${
                      it.len > 1500 ? "glow-red" : it.len > 1200 ? "glow-amber" : "text-dim"
                    }`}
                    title={
                      it.len > 1500
                        ? "Слишком длинно — архив рекомендует до 1500 символов"
                        : it.len > 1200
                          ? "Длинновато — подумайте о сокращении"
                          : "Норма"
                    }
                  >
                    {it.len} симв.
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* v5.7 — ирис в цифрах: как стражи скармливают досье ирису.
              Агрегация по ВСЕМ стражам и обоим мирам: сколько открытий,
              сколько слов растворено, у кого какая стадия. */}
          {irisStats && irisStats.totals.records > 0 && (
            <div className="mt-3">
              <span className="text-[10px] text-dim tracking-widest">
                {"// ꙮ ИРИС В ЦИФРАХ · ПОГЛОЩЕНИЕ ПО ВСЕМ СТРАЖАМ //"}
              </span>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  ["ИРИС-ДОСЬЕ", irisStats.totals.records, ""],
                  ["СТРАЖЕЙ КАСАЛОСЬ", irisStats.totals.players, ""],
                  ["ОТКРЫТИЙ ВСЕГО", irisStats.totals.opens, ""],
                  ["СЛОВ СЪЕДЕНО", irisStats.totals.eaten, "iris"],
                ] as [string, number, string][]).map(([label, value, tone]) => (
                  <div
                    key={label}
                    className="panel-inset px-2.5 py-2 flex flex-col gap-0.5 transition-all hover:border-[var(--violet-dim)] hover:-translate-y-[1px]"
                  >
                    <span className="text-[9px] text-dim tracking-wider">{label}</span>
                    <span
                      className={`font-vt323 text-lg leading-none ${
                        tone === "iris" ? "iris-stat-num" : "glow-violet"
                      }`}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              {irisStats.rows.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {irisStats.rows.map((r) => (
                    <div
                      key={r.id}
                      className="panel-inset px-2.5 py-1.5 flex items-center gap-2"
                      title={`Чистых слов в досье: ${r.cleanWords}. Съедено суммарно всеми стражами: ~${r.eaten}. Максимальная стадия самого преданного читателя: ${r.stage}/6.`}
                    >
                      <span className="text-[11px] glow-violet truncate flex-1">
                        {r.name}
                      </span>
                      <span className="text-[9px] text-dim shrink-0">
                        {r.kind === "lore" ? "лор" : r.kind === "location" ? "локация" : "досье"} ·{" "}
                        {r.system === "PF2E" ? "PF2E" : "D&D"}
                      </span>
                      <span className="text-[10px] text-dim shrink-0">
                        {r.opens}✕ · {r.readers}👤
                      </span>
                      {/* мини-бар максимальной стадии: сколько съел самый преданный читатель */}
                      <span className="w-[52px] h-[5px] bg-black/50 border border-[rgba(120,100,160,0.25)] overflow-hidden shrink-0 flex gap-[2px] p-[1px]">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <span
                            key={i}
                            className={`flex-1 ${i <= r.stage ? "iris-stage-cell on" : "iris-stage-cell"}`}
                          />
                        ))}
                      </span>
                      <span className="text-[10px] shrink-0 iris-stat-num">
                        ~{r.eaten} сл.
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {irisStats.totals.opens === 0 && (
                <div className="mt-1 text-[10px] text-dim italic">
                  {"// ирис ждёт: стражи ещё не возвращались к ирис-досье //"}
                </div>
              )}
            </div>
          )}

          {/* v5.7.3 — диагностика архива: пульс сторожа оверлеев.
              Показывает, что защита от «невидимых блокировщиков кликов»
              (баг «архив зависает», v5.7.2) жива и работает. */}
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] text-dim tracking-widest">
                {"// ⌁ ДИАГНОСТИКА АРХИВА · СТОРОЖ ОВЕРЛЕЕВ //"}
              </span>
              <button
                onClick={runDiagnostics}
                onMouseEnter={() => sfx.hover()}
                className="btn-crt clip-hud-sm px-2.5 py-1 text-[10px]"
                title="Внеплановый осмотр: прогнать сторожа невидимых блокировщиков кликов и доложить результат"
              >
                ⌁ ОСМОТРЕТЬ СЕЙЧАС
              </button>
            </div>
            <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                [
                  "ПРИЗРАКОВ ОБЕЗВРЕЖЕНО",
                  diag?.neutralized ?? 0,
                  (diag?.neutralized ?? 0) > 0 ? "err" : "ok",
                  "Сколько невидимых полноэкранных блокировщиков кликов сторож нейтрализовал за жизнь вкладки (после v5.7.2 их появление — редкость; само число больше нуля лишь сообщает, что страховка сработала)",
                ],
                [
                  "ОСМОТРОВ",
                  diag?.scans ?? 0,
                  "",
                  "Сторож сканирует экран каждые 4 секунды: 5 нативных хит-тестов по точкам экрана",
                ],
                [
                  "ПОСЛЕДНИЙ ОСМОТР",
                  diag && diag.lastScanAgoMs >= 0 ? Math.max(0, Math.round(diag.lastScanAgoMs / 1000)) + " с" : "—",
                  "",
                  "Сколько секунд назад сторож проходил по экрану (в скрытой вкладке не сканирует)",
                ],
                [
                  "ЦЕНТР ЭКРАНА",
                  diag ? (diag.centerHijacked ? "ПЕРЕХВАЧЕН" : "ЧИСТ") : "—",
                  diag?.centerHijacked ? "err" : "ok",
                  "Клик-просвет: что стоит на пути клика в центре экрана. «ЧИСТ» — клики свободны",
                ],
              ] as [string, string | number, string, string][]).map(([label, value, tone, hint]) => (
                <div
                  key={label}
                  className="panel-inset px-2.5 py-2 flex flex-col gap-0.5 transition-all hover:border-[var(--green-dim)] hover:-translate-y-[1px]"
                  title={hint}
                >
                  <span className="text-[9px] text-dim tracking-wider">{label}</span>
                  <span
                    className={`font-vt323 text-lg leading-none ${
                      tone === "err" ? "glow-red" : tone === "ok" ? "glow-green" : "glow-amber"
                    }`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 text-[9px] text-dim tracking-wider">
              {`// узлов DOM: ${diag?.domNodes ?? "···"} // сторож спит в скрытой вкладке //`}
            </div>
          </div>
        </details>
      )}

      {/* модалка восстановления из бэкапа */}
      {restorePreview && (
        <div className="panel clip-hud p-4 fade-in" style={{ borderColor: "var(--violet-dim)" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-vt323 text-lg glow-violet tracking-wider">
              ⇧ ВОССТАНОВЛЕНИЕ ИЗ БЭКАПА
            </span>
            <button
              onClick={() => setRestorePreview(null)}
              disabled={restoring}
              className="btn-crt clip-hud-sm px-2 py-0.5 text-[10px]"
              aria-label="Закрыть восстановление"
            >
              ✕
            </button>
          </div>
          <div className="text-[10px] text-dim mb-3 leading-relaxed">
            {restorePreview.exportedAt
              ? `// бэкап от ${new Date(restorePreview.exportedAt).toLocaleString("ru-RU")} //`
              : "// бэкап архива //"}{" "}
            — вернутся только УТРАЧЕННЫЕ записи; существующие не тронутся.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {Object.entries(RESTORE_TABLE_LABELS).map(([key, label]) => {
              const r = restorePreview.report[key] ?? { restored: 0, skipped: 0 };
              return (
                <div key={key} className="panel-inset px-2.5 py-2">
                  <div className="text-[9px] text-dim tracking-wider">{label}</div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`font-vt323 text-lg leading-none ${
                        r.restored > 0 ? "glow-violet" : "text-dim"
                      }`}
                    >
                      +{r.restored}
                    </span>
                    <span className="text-[9px] text-dim">вернётся</span>
                    {r.skipped > 0 && (
                      <span className="text-[9px] text-dim">· {r.skipped} есть</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {restorePreview.usersToRebind > 0 && (
            <div className="text-[10px] glow-amber mb-3">
              👤 Возврат привязок досье стражам: {restorePreview.usersToRebind}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => void doRestoreApply()}
              disabled={restoring}
              className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs disabled:opacity-50"
            >
              {restoring ? "▸ ИЗ ПЕПЛА…" : "⇧ ВОССТАНОВИТЬ"}
            </button>
            <button
              onClick={() => setRestorePreview(null)}
              disabled={restoring}
              className="btn-crt clip-hud-sm px-4 py-2 text-xs"
            >
              ✕ ОТМЕНА
            </button>
          </div>
        </div>
      )}

      {/* loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="panel clip-hud p-3 h-14 animate-pulse"
              style={{ background: "var(--panel-2)" }}
            />
          ))}
        </div>
      )}

      {/* error */}
      {error && !loading && (
        <div className="panel clip-hud p-6 text-center">
          <div className="font-vt323 text-xl glow-red mb-2">
            [ МАСТЕРСКАЯ ЗАПЕРТА ]
          </div>
          <div className="text-dim text-sm">
            {"// не удалось получить данные: "}{error}{" //"}
          </div>
        </div>
      )}

      {/* rows — длинные списки в скролл-области с фирменным скроллбаром.
          ⠿ — перетаскивание порядка: только на чистом списке (без поиска/фильтра) */}
      {!loading && !error && !restorePreview && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={(e) => void handleDragEnd(e)}
          onDragCancel={() => setDragId(null)}
        >
          <SortableContext
            items={views.map((v) => v.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2 content-start pb-2 max-h-[62vh] overflow-y-auto crt-scroll pr-1">
              {views.length === 0 ? (
                <div className="panel clip-hud p-6 text-center">
                  <div className="font-vt323 text-lg glow-amber mb-1">
                    [ СТРАНИЦА ПУСТА ]
                  </div>
                  <div className="text-dim text-xs">
                    {"// записей нет. созидатель может создать первую кнопкой выше. //"}
                  </div>
                </div>
              ) : (
                views.map((v, i) => (
                  <RecordRow
                    key={v.id}
                    v={v}
                    i={i}
                    sysColor={sysColor}
                    sortable={SORTABLE_TABS.has(tab)}
                    canDrag={canDrag}
                    isConfirm={confirmDelete === v.id}
                    onClone={() => openClone(v.id)}
                    onEdit={() => openEdit(v.id)}
                    onDelete={() => {
                      if (confirmDelete === v.id) {
                        void doDelete(v.id, v.name);
                      } else {
                        setConfirmDelete(v.id);
                        sfx.error();
                      }
                    }}
                  />
                ))
              )}
            </div>
          </SortableContext>
          <DragOverlay
            dropAnimation={{
              duration: 180,
              easing: "cubic-bezier(0.2, 0, 0, 1)",
            }}
          >
            {dragView ? (
              <div
                className="panel clip-hud-sm p-2.5 flex items-center gap-3 select-none"
                style={{
                  borderColor: "var(--amber)",
                  background: "var(--panel-2)",
                  boxShadow:
                    "0 14px 36px rgba(0,0,0,0.55), 0 0 26px rgba(var(--amber-rgb),0.28)",
                  transform: "rotate(1.2deg) scale(1.02)",
                  maxWidth: 560,
                }}
              >
                <span
                  className="text-lg shrink-0 w-8 h-8 flex items-center justify-center panel-inset"
                  style={{ color: sysColor }}
                  aria-hidden
                >
                  {dragView.sigil}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] glow-amber truncate">{dragView.name}</div>
                  <div className="text-[9px] text-dim tracking-widest">
                    ⠿ НОВЫЙ ПОРЯДОК В АРХИВЕ
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* подсказка механик */}
      {!editor && (
        <details className="panel clip-hud-sm p-3 text-[11px] text-dim">
          <summary className="cursor-pointer tracking-widest text-[10px] glow-amber">
            {"// ПОДСКАЗКА МЕХАНИК АРХИВА //"}
          </summary>
          <ul className="mt-2 space-y-1 leading-relaxed">
            <li>
              <span className="glow-green">🔒 Печать</span> — запись закрыта
              ритуалом снятия печати (долгое нажатие в досье).
            </li>
            <li>
              <span className="glow-red">⚠ Порча</span> — текст записи искажается
              корруптами; в досье он проявляется рунами и глитчем.
            </li>
            <li>
              <span className="glow-red">⟦ Порча по выделению ⟧</span> — в описании
              выделите фрагмент и нажмите «ПОМЕТИТЬ ПОРЧЕЙ»: нечитаемым станет
              именно он. Внизу — живой предпросмотр.
            </li>
            <li>
              <span className="glow-violet">⟪ Полное искажение ⟫</span> — фрагмент
              растворяется безвозвратно: вместо слов — переливающиеся ирисом
              глифы (бирюза→аметист→роза→золото). Без свечения и без призраков
              смысла — «ПОЛНОЕ ИСКАЖЕНИЕ» в редакторе описания.
            </li>
            <li>
              <span className="glow-amber">◆ Цвет досье</span> — особое оформление
              досье, как фиолетовое у Кали: синее, зелёное, янтарное и другие.
            </li>
            <li>
              <span className="glow-violet">🧩 Осколок памяти</span> — слово
              осколка; соберите все осколки мира, чтобы открыть вкладку «Секреты».
            </li>
            <li>
              <span className="glow-violet">⟁ Сокрытое</span> — скрытый фрагмент
              текста, раскрываемый кнопкой в досье.
            </li>
            <li>
              <span className="glow-violet">🎯 Загадки-врата</span> — привязываются
              к имени записи: досье откроется только после верного ответа.
              Ответы сверяются на сервере — игроки не смогут подсмотреть их
              в коде страницы.
            </li>
            <li>
              <span className="glow-violet">🏆 Награда за загадку</span> — укажите
              код достижения в форме загадки: каждый, кто разгадает её,
              получит эту ачивку автоматически.
            </li>
            <li>
              <span className="glow-amber">⇪ Загрузка с диска</span> — кнопка
              «С ДИСКА» у пути изображения кладёт файл в public/uploads.
              На Vercel диск только для чтения — там используйте ссылку или
              файл в репозитории.
            </li>
            <li>
              <span className="glow-amber">⇩ Бэкап</span> — полный слепок архива
              в JSON. merge-seed защищает от пересева, бэкап спасёт даже от
              случайного удаления.
            </li>
            <li>
              <span className="glow-amber">⇩ Архив проекта</span> — весь проект
              одним файлом seed.zip (исходники + база + доки): для развёртывания
              вручную и страховки. Ссылка на скачивание подписана и живёт 15
              минут; если архив потерялся — кнопка «⟳» пересоберёт его прямо
              из браузера.
            </li>
            <li>
              <span className="glow-amber">⌁ Диагностика</span> (в сводке) —
              пульс сторожа оверлеев: защита от «невидимых блокировщиков
              кликов» (баг «архив зависает», v5.7.2). Кнопка «ОСМОТРЕТЬ
              СЕЙЧАС» прогоняет внеплановый осмотр и докладывает тостом.
            </li>
            <li>
              <span className="glow-amber">⧉ Дублирование</span> — копия записи
              как черновик (у ачивки код получает суффикс _COPY).
            </li>
            <li>
              <span className="glow-amber">🏆 Достижения</span> — попадают в
              реестр профиля; код — латиница (напр. FIRST_SHARD).
            </li>
            <li>
              <span className="glow-amber">Папки лора</span> — запись попадает в
              раздел по папке: общий лор, Пантеон, Второстепенные герои, Секреты.
            </li>
            <li>
              <span className="glow-amber">Путь к изображению</span> — например
              «/heroes/kael.png». Файл должен лежать в public/ (или быть
              абсолютной ссылкой https://…).
            </li>
            <li>
              <span className="glow-green">✓ Защита правок</span> — всё, что
              создано или изменено в Мастерской, не сбрасывается при обновлениях
              архива (merge-seed бережёт ваши записи).
            </li>
            <li>
              <span className="glow-amber">⠿ Порядок записей</span> — тяните
              строку за ручку ⠿: запись встанет на новое место, и все стражи
              увидят список в вашем порядке (герои, лор, локации, фракции).
              При поиске/фильтре перетаскивание выключено.
            </li>
            <li>
              <span className="glow-amber">⌫ Черновики</span> — правки в форме
              хранятся в браузере: перезагрузка вкладки или случайное закрытие
              не страшны — при повторном открытии записи черновик вернётся
              (кнопка ⌫ СБРОС откатит к исходнику). Вкладка с несохранённой
              правкой попросит подтверждение перед закрытием.
            </li>
          </ul>
        </details>
      )}
    </section>
  );
}
