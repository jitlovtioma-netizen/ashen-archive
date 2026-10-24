"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FriendshipMeter } from "./record/Friendship";
import { ReflectionOverlay } from "./record/ReflectionOverlay";
import { MemoryProbeModal } from "./record/MemoryProbeModal";
import { HoloColumn } from "./record/HoloColumn";
import { DossierEditForm, type DossierDraft } from "./record/DossierEditForm";
import { MartinSecretModal } from "./MartinSecretModal";
import { SinsWheel } from "./SinsWheel";
import { CorruptedText, IRIS_MAX_STAGE, IRIS_SPREAD_BY_STAGE, KALI_ANCHORS, hasAnyMarks, hasOblivionMarks } from "./CorruptedText";
import { dispatchIrisWhisper } from "./IrisWhispers";
import { getDossierTheme, type DossierTheme } from "@/lib/themes";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { SYSTEM_LABEL, SYSTEM_COLOR } from "@/lib/types";
import type { CardRecord } from "./RecordCard";

interface RecordModalProps {
  record: CardRecord;
  onClose: () => void;
}

// Кали: «расплавленный» поток воспоминаний раскладываем на строки по
// якорям-грехам — каждый грех начинает новую строку. Структура досье
// проступает сквозь порчу вместо одной бесконечной строки месива.
function structureKaliText(text: string): string {
  let out = text;
  for (const anchor of KALI_ANCHORS) {
    out = out.split(anchor).join(`\n${anchor}`);
  }
  return out.replace(/\n{3,}/g, "\n\n");
}

export function RecordModal({ record, onClose }: RecordModalProps) {
  const {
    unlockedIds,
    unlockRecord,
    shards,
    addShard,
    revealedSecrets,
    revealRecordSecret,
    addGaze,
    unlockAchievement,
    pushToast,
    solvedRiddles,
    solveRiddle,
    irisReadIds,
    addIrisRead,
    irisOpens,
    openIrisRecord,
  } = useArchive();
  const user = useArchive((s) => s.user);
  const bumpDataRevision = useArchive((s) => s.bumpDataRevision);
  const setSection = useArchive((s) => s.setSection);
  const setAdminEditTarget = useArchive((s) => s.setAdminEditTarget);

  // Админ может отправить любую запись в Мастерскую Созидателя на правку
  const openInWorkshop = () => {
    if (!record.recordType) return;
    sfx.select();
    setAdminEditTarget({
      kind: record.recordType,
      id: record.id,
      system: record.system,
    });
    setSection("admin");
    requestCloseRef.current?.();
  };

  // ── Локальные правки досье (после сохранения владельцем) — накладываются
  // на проп до рефетча секции, чтобы правки были видны мгновенно
  const [localPatch, setLocalPatch] = useState<Partial<CardRecord> | null>(null);
  // ── Режим редактирования досье (владелец персонажа или Созидатель) ──
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<DossierDraft>({
    description: "",
    title: "",
    status: "ALIVE",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // textarea описания в режиме правки — нужна тулбару порчи для выделения
  const descEditRef = useRef<HTMLTextAreaElement | null>(null);

  const baseRecord: CardRecord = localPatch
    ? { ...record, ...localPatch }
    : record;

  // SWAP: Диана → Анаид (toggle) — нужно объявить до isSealed/isCorrupted
  const [swappedToAnaid, setSwappedToAnaid] = useState(false);
  const anaidRecord: CardRecord = {
    ...baseRecord,
    name: "Анаид",
    subtitle: "Зверолюд · Продолжение Дианы",
    description: "▓▒░ Анаид ░▒▓ — девушка-зверолюд, по имени Анаид, хорошо ладит с животными, и очень хорошо может выживать. О ней мало что известно, понятно одно — она продолжение Дианы, и у них синергия, и взаимопонимание. Когда Диана не может — Анаид может. Когда Анаид не знает — Диана знает. Они — две половины одного целого, и вместе они сильнее, чем каждая по отдельности.",
    imageUrl: "/heroes/anaid.png",
    sigil: "🐾",
  };
  const displayRecord = (baseRecord.name === "Диана" && swappedToAnaid) ? anaidRecord : baseRecord;

  // при смене записи (рефетч/другая карточка) — сбрасываем локальные правки
  useEffect(() => {
    setLocalPatch(null);
    setEditMode(false);
  }, [record.id]);

  const isSealed = record.isLocked && !unlockedIds.includes(record.id);
  const isCorrupted = displayRecord.isCorrupted;
  const shardCollected = record.shardWord ? shards.includes(record.shardWord) : false;
  const secretRevealed = revealedSecrets.includes(record.id);

  const [ritualCharge, setRitualCharge] = useState(0);
  const [ritualActive, setRitualActive] = useState(false);
  const [martinSecretShown, setMartinSecretShown] = useState(false);
  const [sinsWheelOpen, setSinsWheelOpen] = useState(false);
  const [memoryProbeOpen, setMemoryProbeOpen] = useState(false);
  // анимация закрытия: сначала проигрываем modalOut, потом умираем
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readRef = useRef(false);
  const ritualRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const konamiSeq = useRef<string[]>([]);
  // requestClose объявлен ниже — держим ссылку для openInWorkshop
  const requestCloseRef = useRef<() => void>(() => {});
  // v5.7.2 — фикс «архив завис»: стабильные ссылки на onClose и имя записи.
  // Раньше эффект монтирования зависел от нестабильных onClose/requestClose
  // (родитель-карточка ре-рендерится на КАЖДОЕ изменение стора — тосты,
  // взгляд, навигация) и в 170мс-окне закрытия убивал таймер onClose.
  // Модалка оставалась смонтированной с завершённой анимацией backdrop-out
  // (opacity:0, pointer-events:auto) — невидимый полноэкранный блокировщик
  // кликов: часы идут, звук играет, нажать ничего нельзя.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const recordNameRef = useRef(record.name);
  recordNameRef.current = record.name;

  // При открытии «Отражения» — открыть достижение REFLECTION
  useEffect(() => {
    if (record.name === "Отражение" && !readRef.current) {
      readRef.current = true;
      const isNew = unlockAchievement("REFLECTION");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🪞",
          title: "ДОСТИЖЕНИЕ: ОТКРЫТЬ ОТРАЖЕНИЕ",
          body: "Взгляд Созидателя достиг 90%. Отражение явилось тебе.",
        });
      }
    }
  }, [record.name, unlockAchievement, pushToast]);

  // Konami-код в досье Мартина — показывает скрытую силу
  useEffect(() => {
    if (record.name !== "Мартин") return;
    const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","KeyB","KeyA"];
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const code = e.code;
      konamiSeq.current.push(code);
      if (konamiSeq.current.length > KONAMI.length) konamiSeq.current.shift();
      if (konamiSeq.current.join(",") === KONAMI.join(",")) {
        konamiSeq.current = [];
        if (!martinSecretShown) {
          setMartinSecretShown(true);
          sfx.achievement();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [record.name, martinSecretShown]);

  useEffect(() => {
    if (!readRef.current && !isSealed) {
      readRef.current = true;
      addGaze(2);
    }
  }, [isSealed, addGaze, record.id]);

  // ── «Взгляд в Бездну»: досье с полным искажением (⟪…⟫), прочитанное
  // не отрываясь ~15 секунд, отвечает взаимностью. Таймер живёт только
  // пока досье открыто: закрыл/сменил — взгляд разорван. ──
  useEffect(() => {
    if (isSealed || !hasOblivionMarks(displayRecord.description)) return;
    const t = setTimeout(() => {
      const isNew = unlockAchievement("IRIS_READER");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "ꙮ",
          title: "ДОСТИЖЕНИЕ: ВЗГЛЯД В БЕЗДНУ",
          body: "Ты смотрел на ирис, пока ирис не посмотрел на тебя.",
        });
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [displayRecord.description, isSealed, record.id, unlockAchievement, pushToast]);

  // ── v5.5 «ИРИС-ШЁПОТ + СОБИРАТЕЛЬ ЗАБВЕНИЯ»: при открытии досье с ⟪…⟫
  // ирис узнаёт читателя (шёпот у краёв экрана), а досье попадает в
  // коллекцию прочитанного ириса. Когда прочитаны ВСЕ ирис-досье мира —
  // коллекционная ачивка IRIS_COLLECTOR. ──
  useEffect(() => {
    if (isSealed || !hasOblivionMarks(displayRecord.description)) return;
    // ирис отвечает немедленно — не через 15 секунд.
    // v5.7: если досье уже на стадии 5+ (до этого открытия его открывали
    // 5+ раз) — ирис не здоровается, а напоминает, кто здесь текст.
    // irisOpens читаем из замыкания БЕЗ deps: на момент монтажа это
    // «прошлое» досье число открытий — именно то, что решает тон встречи.
    const knownOpens = irisOpens[record.id] ?? 0;
    dispatchIrisWhisper({ phase: knownOpens >= 5 ? "devour" : "greet" });
  }, [isSealed, displayRecord.description, record.id]);

  // ── v5.6 «ИРИС ПОГЛОЩАЕТ»: каждый повторный взгляд кормит ирис.
  // Первое открытие бесплатно; со второго чистые слова начинают
  // растворяться — стадия 0..4, доля поглощения растёт нелинейно.
  // v5.7 — стадии 5..6 «ИРИС НЕ ОТПУСКАЕТ»: поглощение выходит за
  // прежний предел, растворяется даже заголовок досье. ──
  const isIrisRecord = hasOblivionMarks(displayRecord.description);
  const irisOpenCount = irisOpens[record.id] ?? 0;
  const irisStage = Math.max(0, Math.min(IRIS_MAX_STAGE, irisOpenCount - 1));
  const irisSpread = isIrisRecord ? IRIS_SPREAD_BY_STAGE[irisStage] : 0;
  const IRIS_STAGE_HINTS = [
    "ирис только смотрит",
    "ирис тянется к словам",
    "ирис забирает фразы",
    "половина досье — уже ирис",
    "досье почти растворено",
    "ирис не отпускает",
    "ирис дочитывает за тебя",
  ] as const;
  const IRIS_STAGE_LABELS = [
    "ПОГЛОЩЕНИЕ",
    "ПОГЛОЩЕНИЕ",
    "ПОГЛОЩЕНИЕ",
    "ПОГЛОЩЕНИЕ",
    "ПОГЛОЩЕНИЕ",
    "ИРИС НЕ ОТПУСКАЕТ",
    "ИРИС НЕ ОТПУСКАЕТ",
  ] as const;
  const irisBeyond = isIrisRecord && irisStage >= 5;
  const openedIrisOnceRef = useRef(false);
  const newlyIrisReadRef = useRef(false);

  useEffect(() => {
    if (isSealed || !hasOblivionMarks(displayRecord.description)) return;
    if (openedIrisOnceRef.current) return;
    openedIrisOnceRef.current = true;
    // считаем открытие — ирис растёт с каждым визитом
    const opens = openIrisRecord(record.id);
    newlyIrisReadRef.current = addIrisRead(record.id);
    if (opens >= 5) {
      const isNew = unlockAchievement("IRIS_DEVOTED");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "ꙮ",
          title: "ДОСТИЖЕНИЕ: ГЛАЗАМИ ИРИСА",
          body: "Ты открывал это досье, пока было что открывать. Ирис учёл каждое твоё возвращение.",
        });
      }
    }
    // v5.7 — восьмое открытие: ирис дочитывает за стража. Это уже не
    // любопытство — это привычка, и ирис её культивирует.
    if (opens >= 8) {
      const isNew = unlockAchievement("IRIS_BOUND");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "ꙮ",
          title: "ДОСТИЖЕНИЕ: ОН НЕ ОТПУСКАЕТ",
          body: "Восьмое открытие. Ирис дочитывает это досье за тебя — ты просто держишь страницу.",
        });
      }
    }
  }, [isSealed, displayRecord.description, record.id, openIrisRecord, addIrisRead, unlockAchievement, pushToast]);

  // проверка коллекции: реестр ирис-досье мира vs прочитанные
  useEffect(() => {
    if (irisReadIds.length === 0) return;
    if (useArchive.getState().achievements.includes("IRIS_COLLECTOR")) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/archive?type=iris&system=${record.system}`);
        if (!r.ok) return;
        const d = (await r.json()) as { total: number; items: { id: string }[] };
        if (cancelled || !d.items?.length) return;
        const allRead = d.items.every((it) => irisReadIds.includes(it.id));
        // v5.6 — прогресс коллекции в тосте: «ирис прочитан X из Y»
        const readCount = d.items.filter((it) => irisReadIds.includes(it.id)).length;
        if (
          newlyIrisReadRef.current &&
          !allRead &&
          d.items.length > 1
        ) {
          newlyIrisReadRef.current = false;
          pushToast({
            kind: "info",
            sigil: "ꙮ",
            title: "ИРИС ПРОЧИТАН",
            body: `${readCount} из ${d.items.length} досье, тронутых ирисом. Он это учитывает.`,
          });
        }
        if (!allRead) return;
        const isNew = unlockAchievement("IRIS_COLLECTOR");
        if (isNew) {
          sfx.achievement();
          pushToast({
            kind: "ach",
            sigil: "ꙮ",
            title: "ДОСТИЖЕНИЕ: СОБИРАТЕЛЬ ЗАБВЕНИЯ",
            body: "Все досье, тронутые ирисом, прочитаны. Он это учёл.",
          });
        }
      } catch {
        /* сеть недоступна — проверим при следующем открытии */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [irisReadIds, record.system, unlockAchievement, pushToast]);

  // Плавное закрытие: 170мс на анимацию выхода, затем настоящий onClose.
  // v5.6 — ирис-досье на прощание отвечает шёпотом (низ экрана).
  const requestClose = useCallback(() => {
    if (closeTimer.current) return; // уже закрываемся
    if (!isSealed && hasOblivionMarks(displayRecord.description)) {
      dispatchIrisWhisper({ phase: "farewell" });
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onClose();
    }, 170);
  }, [onClose, isSealed, displayRecord.description]);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sfx.blip();
        requestCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Проклятие Кали: при открытии досье — весь экран искажается
    // (имя — через ref: эффект живёт только на маунт)
    if (recordNameRef.current === "Кали") {
      document.body.classList.add("cursed-screen");
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.classList.remove("cursed-screen");
      // v5.7.2 — ВАЖНО: НЕ отменяем closeTimer. Если закрытие уже началось,
      // onClose обязан выстрелить даже после размонтирования — иначе модалка
      // зависнет невидимой ловушкой для кликов. setState на размонтированном
      // родителе безвреден (no-op), а вот невыстреливший onClose — тот самый баг.
    };
    // эффект живёт только на маунт: колбэки читаются через ref
  }, []);

  // v5.7.2 — страховка «архив не зависает»: как только закрытие началось,
  // родитель получит onClose не позднее чем через 450мс — даже если основной
  // таймер кто-то убил по какой-то причине. Повторный onClose безвреден
  // (родитель просто повторно выставит false).
  useEffect(() => {
    if (!closing) return;
    const id = setTimeout(() => {
      onCloseRef.current();
    }, 450);
    return () => clearTimeout(id);
  }, [closing]);

  const completeRitual = useCallback(() => {
    setRitualActive(false);
    const isNew = unlockRecord(record.id);
    sfx.unlock();
    addGaze(4);
    if (isNew) {
      pushToast({ kind: "ach", sigil: "🔓", title: "ПЕЧАТЬ СНЯТА", body: record.name });
    }
  }, [record.id, record.name, unlockRecord, pushToast, addGaze]);

  useEffect(() => {
    if (!ritualActive) return;
    ritualRef.current = setInterval(() => {
      setRitualCharge((c) => {
        if (c >= 100) {
          if (ritualRef.current) clearInterval(ritualRef.current);
          completeRitual();
          return 100;
        }
        return c + 4;
      });
    }, 40);
    return () => { if (ritualRef.current) clearInterval(ritualRef.current); };
  }, [ritualActive, completeRitual]);

  const startRitual = () => { if (ritualCharge >= 100) return; setRitualActive(true); sfx.whisper(); };
  const stopRitual = () => { if (ritualCharge >= 100) return; setRitualActive(false); if (ritualCharge > 0) { setRitualCharge(0); sfx.error(); } };

  const onCollectShard = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!record.shardWord || shardCollected) return;
    const isNew = addShard(record.shardWord);
    if (isNew) {
      addGaze(2);
      sfx.beep();
      pushToast({ kind: "secret", sigil: "🧩", title: "ОСКОЛОК ПАМЯТИ", body: `Собрано: «${record.shardWord}»` });
    }
  };

  const onRevealSecret = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!record.secretFragment || secretRevealed) return;
    const isNew = revealRecordSecret(record.id);
    if (isNew) {
      addGaze(2);
      sfx.whisper();
      pushToast({ kind: "secret", sigil: "⟁", title: "СОКРЫТОЕ ОБНАРУЖЕНО", body: record.secretFragment });
    }
  };

  const isReflection = record.name === "Отражение";
  const isEntity = record.name === "???" || record.name === "Неизвестная личность";
  const isCursed = record.name === "Кали";
  const isUnknown = record.name === "Неизвестная" || record.name === "Четвёртый" || record.name === "Мёртвый План";

  // ── Цветовая тема досье: как фиолетовое у Кали, но для любого героя ──
  // Задаётся в Мастерской (themeColor). Кали и «Отражение» остаются
  // фиолетовыми по наследию — даже если поле не заполнено.
  const dossierTheme: DossierTheme | null =
    getDossierTheme(displayRecord.themeColor) ??
    (isCursed || isReflection ? getDossierTheme("violet") : null);
  const hasMarks = hasAnyMarks(displayRecord.description);

  // ── Права на редактирование: владелец персонажа или Созидатель (админ) ──
  const isCharacterRecord = record.recordType === "character";
  const isDossierOwner = !!user && user.characterId === record.id;
  const canEditDossier =
    isCharacterRecord &&
    !!user &&
    !isSealed &&
    (isDossierOwner || user.role === "ADMIN");
  // Созидатель может открыть в Мастерской любую запись с известным типом
  const canOpenWorkshop =
    !!user && user.role === "ADMIN" && !!record.recordType;

  const startEdit = () => {
    setEditDraft({
      description: baseRecord.description,
      title: baseRecord.characterTitle ?? "",
      status: baseRecord.status ?? "ALIVE",
    });
    setSaveError(null);
    setEditMode(true);
    sfx.select();
  };

  const saveEdit = async () => {
    if (!user) return;
    const description = editDraft.description.trim();
    if (description.length < 3) {
      setSaveError("Архив отказал: описание слишком короткое (минимум 3 символа)");
      sfx.error();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/characters/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: record.id,
          patch: {
            description,
            title: editDraft.title.trim() || undefined,
            status: editDraft.status,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const hints: Record<string, string> = {
          FORBIDDEN: "Только владелец досье или Созидатель может вносить правки",
          UNKNOWN_CHARACTER: "Запись не найдена в архиве",
          UNKNOWN_USER: "Страж не опознан — войдите заново",
          BAD_DESCRIPTION: "Описание отклонено (3..6000 символов)",
          BAD_TITLE: "Эпитет отклонён (1..120 символов)",
          BAD_STATUS: "Недопустимый статус",
          SYSTEM_MISMATCH: "Досье принадлежит другому миру",
          EMPTY_PATCH: "Нет полей для сохранения",
        };
        setSaveError(hints[data.error as string] ?? "Архив отказал в записи");
        sfx.error();
        return;
      }
      const c = data.character as {
        name: string;
        title: string;
        category: string;
        race: string;
        description: string;
        status: "ALIVE" | "DEAD" | "MISSING";
      };
      setLocalPatch({
        description: c.description,
        status: c.status,
        characterTitle: c.title,
        subtitle: `${c.category} · ${c.race} · ${c.title}`,
      });
      setEditMode(false);
      bumpDataRevision();
      sfx.unlock();
      pushToast({
        kind: "ach",
        sigil: "✎",
        title: "ДОСЬЕ ОБНОВЛЕНО",
        body: `Правки вписаны в архив: ${c.name}. Их увидят все стражи.`,
      });
    } catch {
      setSaveError("Сеть архива недоступна — попробуйте ещё раз");
      sfx.error();
    } finally {
      setSaving(false);
    }
  };

  // выбор анимации панели: cursed/reflection-досье живут с постоянным
  // глитчем, поэтому им нужны комбинированные классы (глитч + вход/выход)
  const glitchy = isReflection || isCursed;
  const modalAnimClass = closing
    ? glitchy
      ? "glitch-out"
      : "modal-anim-out"
    : glitchy
      ? "glitch-in"
      : "modal-anim-in";

  // стили темы досье (фон/рамка/свечение) — применяются к модалке
  const themedStyle: React.CSSProperties | undefined = dossierTheme
    ? {
        "--acc": dossierTheme.accent,
        background: dossierTheme.bg,
        border: `1px solid ${dossierTheme.border}`,
        boxShadow: dossierTheme.glow,
      } as React.CSSProperties
    : undefined;
  const themedBackdrop: React.CSSProperties | undefined = dossierTheme
    ? { background: dossierTheme.bg, backdropFilter: "blur(4px)" }
    : undefined;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9700] flex items-center justify-center p-2 sm:p-4 ${
        closing ? "backdrop-out" : "backdrop-in"
      }`}
      style={{
        background:
          themedBackdrop?.background ??
          (isReflection || isCursed ? "rgba(20, 0, 30, 0.9)" : "rgba(2, 0, 2, 0.85)"),
        backdropFilter: themedBackdrop?.backdropFilter ??
          (isReflection || isCursed ? "blur(4px)" : "blur(2px)"),
      }}
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
      aria-label={displayRecord.name}
    >
      {/* ОТРАЖЕНИЕ — слова по всему экрану (только для Кали) */}
      {isCursed && <ReflectionOverlay />}
      <div
        className={`panel clip-hud brackets w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden ${modalAnimClass} ${isReflection ? "reflection-panel" : ""} ${isEntity ? "entity-modal" : ""} ${isCursed ? "cursed-modal" : ""} ${dossierTheme ? "themed-modal" : ""} ${isIrisRecord && irisStage >= 2 ? "iris-consumed" : ""} ${isIrisRecord && irisStage >= 5 ? "iris-devoured" : ""}`}
        style={
          themedStyle ?? {
            boxShadow:
              "0 0 60px rgba(var(--green-rgb), 0.2), 0 0 120px rgba(0, 0, 0, 0.8)",
          }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--line-bright)] shrink-0 bg-[var(--panel-2)]">
          <span className="led led-red" />
          <span className="led led-amber" />
          <span className="led led-green" />
          <span className="text-[10px] text-dim tracking-widest ml-2 truncate">
            {"// ПРОТОКОЛ_ДОСЬЕ // "}
            <span className="glow-green">{displayRecord.name}</span>
          </span>
          <span className="flex-1" />
          <button onClick={requestClose} className="btn-crt btn-red clip-hud-sm px-2 py-0.5 text-[11px]" aria-label="Закрыть">
            ✕ ЗАКРЫТЬ
          </button>
        </div>

        {/* body: two columns */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto crt-scroll">
          {/* LEFT: text */}
          <div className="md:w-[55%] p-4 sm:p-6 overflow-y-auto crt-scroll border-b md:border-b-0 md:border-r border-[var(--line)]">
            <div className="mb-4">
              <h2
                className={`font-medieval text-2xl sm:text-3xl leading-tight mb-1 ${
                  irisBeyond ? "iris-name-devoured" : (isCorrupted || hasMarks ? "glitch" : "glow-green")
                } ${isEntity ? "entity-title" : ""}`}
                data-text={displayRecord.name}
                style={
                  irisBeyond
                    ? undefined
                    : dossierTheme
                    ? {
                        color: dossierTheme.accent,
                        textShadow: `0 0 14px ${dossierTheme.accentDim}, 0 0 30px ${dossierTheme.accentDim}`,
                      }
                    : isCorrupted
                      ? undefined
                      : undefined
                }
              >
                {displayRecord.name}
              </h2>
              <div className={`text-sm tracking-wider ${isEntity ? "text-[var(--cyan)] opacity-80" : "text-dim"}`}>{displayRecord.subtitle}</div>
            </div>

            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              <span className="chip" style={{ color: SYSTEM_COLOR[record.system], borderColor: `color-mix(in srgb, ${SYSTEM_COLOR[record.system]} 40%, transparent)` }}>
                {SYSTEM_LABEL[record.system]}
              </span>
              {isDossierOwner && <span className="chip chip-warn" title="Это досье привязано к вам — вы можете его редактировать">✎ ВАШЕ ДОСЬЕ</span>}
              {isSealed && <span className="chip chip-warn">🔒 ОПЕЧАТАНО</span>}
              {isCorrupted && <span className="chip chip-err">⚠ ИСКАЖЕНО</span>}
              {dossierTheme && !isCorrupted && (
                <span
                  className="chip"
                  style={{
                    color: dossierTheme.accent,
                    borderColor: dossierTheme.border,
                    background: dossierTheme.btnBg,
                  }}
                  title="У этого досье особое цветовое оформление"
                >
                  ◆ ОСОБОЕ ДОСЬЕ
                </span>
              )}
              {!isSealed && !isCorrupted && <span className="chip chip-ok">✓ ДОСТУПНО</span>}
              {record.status === "DEAD" && <span className="chip chip-err">💀 ПАЛ</span>}
              {record.status === "MISSING" && (
                <span className="chip chip-warn">{isCursed ? "? ПРОПАЛА" : "? ПРОПАЛ"}</span>
              )}
            </div>

            <div className="divider-glow mb-3" />

            {/* v5.6 — шкала поглощения: ирис ест досье с каждым открытием.
                Метаприбор архива фиксирует потерю — страж видит цену любопытства.
                v5.7 — стадии 5..6: прибор за пределом шкалы, «ИРИС НЕ
                ОТПУСКАЕТ», счётчик уходит в бесконечность. */}
            {isIrisRecord && !isSealed && !editMode && (
              <div
                className="iris-consume-meter mb-4"
                data-stage={irisStage}
                title={`Открытий: ${irisOpenCount}. ${IRIS_STAGE_HINTS[irisStage]}${irisStage >= 6 ? ". Ирис дочитывает за тебя." : irisStage >= 5 ? ". Дальше — только ирис." : ""}`}
              >
                <span className="iris-consume-glyph" aria-hidden="true">ꙮ</span>
                <span className="iris-consume-label">
                  {IRIS_STAGE_LABELS[irisStage]}
                  <span className="iris-consume-hint">{"// "}{IRIS_STAGE_HINTS[irisStage]}{" //"}</span>
                </span>
                <span
                  className="iris-consume-segs"
                  role="img"
                  aria-label={`Стадия поглощения ${irisBeyond ? "за пределом шкалы" : `${Math.min(irisOpenCount, 5)} из 5`}: ${IRIS_STAGE_HINTS[irisStage]}`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= Math.min(irisOpenCount, 5) ? "on" : ""} />
                  ))}
                </span>
                <span className={`iris-consume-count${irisBeyond ? " iris-count-beyond" : ""}`}>
                  {irisBeyond ? "∞" : `${Math.min(irisOpenCount, 5)}/5`}
                </span>
              </div>
            )}

            <FriendshipMeter value={record.friendship} />

            <div className="text-[10px] text-dim tracking-widest mb-2">{"// ОПИСАНИЕ //"}</div>

            {isReflection && (
              <div className="mb-3 text-center space-y-1">
                <div className="reflection-warning text-lg">НЕ ВЕРЬ ЕЙ</div>
                <div className="reflection-warning text-lg">ОНО ЛЖЁТ</div>
                <div className="reflection-warning text-2xl">БЕГИ!</div>
                <div className="reflection-warning text-2xl">СПАСАЙСЯ!</div>
              </div>
            )}

            {/* ── РЕЖИМ ЗАПИСИ: редактирование досье владельцем/Созидателем ── */}
            {editMode ? (
              <DossierEditForm
                draft={editDraft}
                setDraft={setEditDraft}
                saving={saving}
                saveError={saveError}
                descRef={descEditRef}
                accent={dossierTheme?.accent}
                onSave={saveEdit}
                onCancel={() => {
                  setEditMode(false);
                  sfx.blip();
                }}
              />
            ) : !isSealed ? (
              isUnknown ? (
                <div className="text-[14px] leading-relaxed space-y-2">
                  {displayRecord.description.split("\n").map((line, i) => {
                    if (line.includes("★★★")) {
                      return <p key={i} className="glow-amber text-lg font-bold text-center tracking-wider pulse-slow">{line}</p>;
                    }
                    return <p key={i} className="reflection-text text-[13px]">{line || "\u00A0"}</p>;
                  })}
                </div>
              ) : isCursed ? (
                // Досье Кали: «расплавленный» при записи текст (zalgo-метки в
                // самой БД) оживляется — искажённые слова дрейфуют, руны
                // проступают и растворяются. Шесть якорей-грехов остаются
                // читаемыми всегда и разбирают поток на строки. Порча теперь
                // разрежена: сквозь неё читается структура повествования.
                <CorruptedText
                  text={structureKaliText(displayRecord.description)}
                  zalgoAware
                  ratio={0.12}
                  zalgoChance={0.45}
                  protect={KALI_ANCHORS}
                  variant="violet"
                  syncLine
                  paragraphClassName="text-[14px] leading-relaxed text-[var(--text)] mb-2 last:mb-0"
                />
              ) : isCorrupted || hasMarks ? (
                // Искажённые досье: при каждом открытии порча выбирает
                // случайные слова — прочесть текст до конца невозможно.
                // Текст с метками ⟦…⟧ (порча по выделению из Мастерской):
                // искажаются ТОЛЬКО помеченные фрагменты, остальное чисто.
                // v5.6: irisSpread — ирис ПОГЛОЩАЕТ чистые слова досье с
                // каждым повторным открытием (стадия растёт, текст тает).
                <CorruptedText
                  text={displayRecord.description}
                  ratio={isCorrupted ? 0.42 : 0}
                  variant={dossierTheme ? undefined : "red"}
                  accent={dossierTheme?.accent}
                  irisPalette={displayRecord.irisColor ?? undefined}
                  irisSpread={irisSpread}
                  syncLine
                  paragraphClassName={`text-[14px] leading-relaxed mb-2 last:mb-0 ${
                    isEntity ? "text-[var(--cyan)]" : "text-[var(--text)]"
                  }`}
                />
              ) : (
                <p
                  className={`text-[14px] leading-relaxed whitespace-pre-line ${isEntity ? "text-[var(--cyan)]" : "text-[var(--text)]"}`}
                >
                  {displayRecord.description}
                </p>
              )
            ) : (
              <div className="panel-inset p-4 text-center">
                <div className="font-vt323 text-xl glow-amber mb-1">[ ДАННЫЕ ОПЕЧАТАНЫ ]</div>
                <div className="text-dim text-xs">{"// для доступа требуется ритуал снятия печати //"}</div>
              </div>
            )}

            {secretRevealed && record.secretFragment && (
              <div className="mt-4 panel-inset p-3 border-l-2 border-[var(--violet)]">
                <div className="text-[10px] glow-violet tracking-widest mb-1">⟁ СОКРЫТОЕ</div>
                <div className="text-[13px] italic text-[var(--text)] leading-relaxed">{record.secretFragment}</div>
              </div>
            )}

            {/* Кнопка «А что могло бы быть?» — только для Бруно */}
            {record.name === "Бруно" && (
              <button
                onClick={() => {
                  sfx.whisper();
                  setSinsWheelOpen(true);
                }}
                className="btn-crt clip-hud-sm px-4 py-2 text-xs mt-3 w-full"
                style={{
                  borderColor: "var(--amber-dim)",
                  color: "var(--amber)",
                  background: "rgba(var(--amber-rgb), 0.08)",
                }}
              >
                💀 А ЧТО МОГЛО БЫ БЫТЬ?
              </button>
            )}

            {/* Кнопка «PRIME FORM» — для Реми и Бруно.
                ПЕРМАНЕНТНО ЗАБЛОКИРОВАНА: нельзя нажать ни при каких условиях.
                Кнопка рендерится как disabled div (не кнопка), без onClick,
                с замком и диагональными полосами запрета. */}
            {(record.name === "Реми" || record.name === "Бруно") && (
              <div
                className="mt-3 w-full relative"
                aria-label="Prime Form — перманентно заблокирована"
                role="img"
              >
                <div
                  className="btn-crt clip-hud-sm px-4 py-2 text-xs w-full relative overflow-hidden cursor-not-allowed select-none"
                  style={{
                    borderColor: "var(--line)",
                    color: "var(--dim)",
                    background: "rgba(20, 20, 20, 0.5)",
                    boxShadow: "inset 0 0 24px rgba(0,0,0,0.7)",
                    opacity: 0.55,
                    filter: "grayscale(1)",
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <span className="text-sm pulse-slow">🔒</span>
                    <span className="tracking-wider">PRIME FORM · НА ПЕЧАТИ</span>
                  </span>
                  {/* Диагональные полосы запрета */}
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, transparent 0, transparent 8px, rgba(255,255,255,0.025) 8px, rgba(255,255,255,0.025) 16px)",
                    }}
                  />
                  {/* Лёгкое мерцание «печати» */}
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(circle at center, rgba(255,36,36,0.04) 0%, transparent 70%)",
                      animation: "primeSealPulse 4s ease-in-out infinite",
                    }}
                  />
                </div>

                <style>{`
                  @keyframes primeSealPulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                  }
                `}</style>
              </div>
            )}

            {/* Кнопка SWAP — только для Дианы (PF2E) */}
            {record.name === "Диана" && (
              <button
                onClick={() => {
                  sfx.whisper();
                  setSwappedToAnaid(!swappedToAnaid);
                }}
                className="btn-crt clip-hud-sm px-4 py-2 text-xs mt-3 w-full"
                style={{
                  borderColor: "var(--amber-dim)",
                  color: "var(--amber)",
                  background: "rgba(var(--amber-rgb), 0.08)",
                }}
              >
                🔄 SWAP → {swappedToAnaid ? "ДИАНУ" : "АНАИД"}
              </button>
            )}

            {/* Кнопка «Проникнуть в память» — только для Кали */}
            {record.name === "Кали" && (
              <button
                onClick={() => {
                  sfx.whisper();
                  setMemoryProbeOpen(true);
                }}
                className="btn-crt clip-hud-sm px-4 py-2 text-xs mt-3 w-full"
                style={{
                  borderColor: "var(--violet-dim)",
                  color: "var(--violet)",
                  background: "rgba(var(--violet-rgb), 0.08)",
                }}
              >
                🧠 ПРОНИКНУТЬ В ПАМЯТЬ
              </button>
            )}

            <style>{`
              @keyframes primeBtnSweep {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            `}</style>

            {memoryProbeOpen && <MemoryProbeModal onClose={() => setMemoryProbeOpen(false)} />}

            <div className="flex items-center gap-2 mt-5 flex-wrap">
              {isSealed ? (
                <button
                  className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs relative overflow-hidden"
                  onMouseDown={startRitual}
                  onMouseUp={stopRitual}
                  onMouseLeave={stopRitual}
                  onTouchStart={(e) => { e.preventDefault(); startRitual(); }}
                  onTouchEnd={stopRitual}
                  aria-label="Снятие печати"
                >
                  {ritualActive || ritualCharge > 0 ? (
                    <span className="relative z-10">РИТУАЛ... {Math.round(ritualCharge)}%</span>
                  ) : (
                    <span>🔑 СНЯТИЕ ПЕЧАТИ</span>
                  )}
                  {(ritualActive || ritualCharge > 0) && (
                    <span className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(var(--amber-rgb),0.3), rgba(var(--amber-rgb),0.1))", width: `${ritualCharge}%`, transition: "width 0.05s linear" }} />
                  )}
                </button>
              ) : (
                <button onClick={requestClose} className="btn-crt clip-hud-sm px-4 py-2 text-xs">◂ ЗАКРЫТЬ ДОСЬЕ</button>
              )}
              {canEditDossier && !editMode && (
                <button
                  onClick={startEdit}
                  className="btn-crt clip-hud-sm px-4 py-2 text-xs"
                  style={{
                    borderColor: "var(--amber-dim)",
                    color: "var(--amber)",
                    background: "rgba(var(--amber-rgb), 0.08)",
                  }}
                  title={isDossierOwner ? "Это ваше досье — впишите свою историю" : "Созидатель может править любое досье"}
                >
                  ✎ РЕДАКТИРОВАТЬ
                </button>
              )}
              {canOpenWorkshop && !editMode && (
                <button
                  onClick={openInWorkshop}
                  className="btn-crt clip-hud-sm px-4 py-2 text-xs"
                  title="Открыть запись в Мастерской Созидателя — все поля, осколки, печати и изображение"
                >
                  ⚙ В МАСТЕРСКУЮ
                </button>
              )}
              {!isSealed && record.shardWord && (
                <button onClick={onCollectShard} disabled={shardCollected} className={`btn-crt clip-hud-sm px-4 py-2 text-xs ${shardCollected ? "opacity-50 cursor-default" : ""}`}>
                  {shardCollected ? "✓ ОСКОЛОК СОБРАН" : "🧩 ОСКОЛОК ПАМЯТИ"}
                </button>
              )}
              {!isSealed && record.secretFragment && !secretRevealed && (
                <button onClick={onRevealSecret} className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs">⟁ РАСКРЫТЬ СОКРЫТОЕ</button>
              )}
            </div>
          </div>

          {/* RIGHT: hologram */}
          <HoloColumn
            record={record}
            imageUrl={displayRecord.imageUrl}
            isSealed={isSealed}
            isCorrupted={isCorrupted}
            missingLabel={isCursed ? "? ПРОПАЛА" : undefined}
          />
        </div>
      </div>
      {martinSecretShown && (
        <MartinSecretModal onClose={() => setMartinSecretShown(false)} />
      )}
      {sinsWheelOpen && (
        <SinsWheel onClose={() => setSinsWheelOpen(false)} />
      )}
    </div>,
    document.body
  );
}
