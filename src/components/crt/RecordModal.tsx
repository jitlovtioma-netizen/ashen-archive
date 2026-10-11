"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HoloPortrait } from "./HoloPortrait";
import { Sigil } from "./Sigil";
import { MartinSecretModal } from "./MartinSecretModal";
import { SinsWheel } from "./SinsWheel";
import { CorruptedText, KALI_ANCHORS } from "./CorruptedText";
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
  } = useArchive();
  const user = useArchive((s) => s.user);
  const bumpDataRevision = useArchive((s) => s.bumpDataRevision);

  // ── Локальные правки досье (после сохранения владельцем) — накладываются
  // на проп до рефетча секции, чтобы правки были видны мгновенно
  const [localPatch, setLocalPatch] = useState<Partial<CardRecord> | null>(null);
  // ── Режим редактирования досье (владелец персонажа или Созидатель) ──
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({
    description: "",
    title: "",
    status: "ALIVE" as "ALIVE" | "DEAD" | "MISSING",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  // Плавное закрытие: 170мс на анимацию выхода, затем настоящий onClose.
  const requestClose = useCallback(() => {
    if (closeTimer.current) return; // уже закрываемся
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onClose();
    }, 170);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sfx.blip();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Проклятие Кали: при открытии досье — весь экран искажается
    const isCursedRecord = record.name === "Кали";
    if (isCursedRecord) {
      document.body.classList.add("cursed-screen");
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.classList.remove("cursed-screen");
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [onClose, record.name, requestClose]);

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

  // ── Права на редактирование: владелец персонажа или Созидатель (админ) ──
  const isCharacterRecord = record.recordType === "character";
  const isDossierOwner = !!user && user.characterId === record.id;
  const canEditDossier =
    isCharacterRecord &&
    !!user &&
    !isSealed &&
    (isDossierOwner || user.role === "ADMIN");

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
          requester: user.login,
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9700] flex items-center justify-center p-2 sm:p-4 ${
        closing ? "backdrop-out" : "backdrop-in"
      }`}
      style={{
        background: isReflection || isCursed ? "rgba(20, 0, 30, 0.9)" : "rgba(2, 0, 2, 0.85)",
        backdropFilter: isReflection || isCursed ? "blur(4px)" : "blur(2px)",
      }}
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
      aria-label={displayRecord.name}
    >
      {/* ОТРАЖЕНИЕ overlay — разбросанные слова по всему экрану (только для Кали) */}
      {isCursed && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9701 }}>
          {Array.from({ length: 30 }).map((_, i) => {
            const colors = ["#ff3366", "#a78bfa", "#660066", "#ff0033", "#990033"];
            const sizes = ["10px", "12px", "14px", "16px", "18px", "20px"];
            return (
              <div
                key={i}
                className="absolute font-bold tracking-wider whitespace-nowrap"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  fontSize: sizes[Math.floor(Math.random() * sizes.length)],
                  color: colors[Math.floor(Math.random() * colors.length)],
                  opacity: 0.08 + Math.random() * 0.25,
                  transform: `rotate(${Math.random() * 60 - 30}deg)`,
                  textShadow: `0 0 8px ${colors[Math.floor(Math.random() * colors.length)]}`,
                  // задержка — внутри шортката, чтобы React не ругался на
                  // конфликт animation/animationDelay при ререндерах
                  animation: `reflectionFloat ${4 + Math.random() * 6}s ease-in-out ${i * 0.2}s infinite`,
                }}
              >
                ОТРАЖЕНИЕ
              </div>
            );
          })}
          <style>{`
            @keyframes reflectionFloat {
              0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.1; }
              50% { transform: translateY(-20px) rotate(5deg); opacity: 0.3; }
            }
          `}</style>
        </div>
      )}
      <div
        className={`panel clip-hud brackets w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden ${modalAnimClass} ${isReflection ? "reflection-panel" : ""} ${isEntity ? "entity-modal" : ""} ${isCursed ? "cursed-modal" : ""}`}
        style={{
          boxShadow: isReflection || isCursed
            ? "0 0 60px rgba(167, 139, 250, 0.4), 0 0 120px rgba(40, 0, 60, 0.9)"
            : "0 0 60px rgba(74, 246, 38, 0.2), 0 0 120px rgba(0, 0, 0, 0.8)",
          background: isReflection || isCursed ? "rgba(15, 0, 25, 0.95)" : undefined,
          border: isReflection || isCursed ? "1px solid rgba(167, 139, 250, 0.5)" : undefined,
        }}
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
              <h2 className={`font-medieval text-2xl sm:text-3xl leading-tight mb-1 ${isCorrupted ? "glow-red glitch" : "glow-green"} ${isEntity ? "entity-title" : ""}`} data-text={displayRecord.name}>
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
              {!isSealed && !isCorrupted && <span className="chip chip-ok">✓ ДОСТУПНО</span>}
              {record.status === "DEAD" && <span className="chip chip-err">💀 ПАЛ</span>}
              {record.status === "MISSING" && <span className="chip chip-warn">? ПРОПАЛ</span>}
            </div>

            <div className="divider-glow mb-3" />

            {/* Большая шкала дружбы в досье */}
            {typeof record.friendship === "number" && record.friendship > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  {record.friendship >= 10 && <span className="text-2xl">❤️</span>}
                  <div
                    className="flex-1 h-3 overflow-hidden rounded-full"
                    style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--line)" }}
                  >
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${(record.friendship / 10) * 100}%`,
                        background: record.friendship >= 10
                          ? "#ff69b4"
                          : record.friendship >= 7
                            ? `rgb(${Math.round(232 * (1 - (record.friendship - 7) / 3))}, 246, 38)`
                            : record.friendship >= 4
                              ? `rgb(255, ${Math.round(140 + 92 * ((record.friendship - 4) / 3))}, 40)`
                              : `rgb(${Math.round(160 + 95 * ((record.friendship - 1) / 2))}, ${Math.round(20 + 16 * ((record.friendship - 1) / 2))}, 20)`,
                        boxShadow: `0 0 8px ${record.friendship >= 10
                          ? "#ff69b4"
                          : record.friendship >= 7
                            ? `rgb(${Math.round(232 * (1 - (record.friendship - 7) / 3))}, 246, 38)`
                            : record.friendship >= 4
                              ? `rgb(255, ${Math.round(140 + 92 * ((record.friendship - 4) / 3))}, 40)`
                              : `rgb(${Math.round(160 + 95 * ((record.friendship - 1) / 2))}, ${Math.round(20 + 16 * ((record.friendship - 1) / 2))}, 20)`}`,
                      }}
                    />
                  </div>
                  <span
                    className="text-sm font-mono tracking-wider shrink-0"
                    style={{
                      color: record.friendship >= 10
                        ? "#ff69b4"
                        : record.friendship >= 7
                          ? `rgb(${Math.round(232 * (1 - (record.friendship - 7) / 3))}, 246, 38)`
                          : record.friendship >= 4
                            ? `rgb(255, ${Math.round(140 + 92 * ((record.friendship - 4) / 3))}, 40)`
                            : `rgb(${Math.round(160 + 95 * ((record.friendship - 1) / 2))}, ${Math.round(20 + 16 * ((record.friendship - 1) / 2))}, 20)`,
                    }}
                  >
                    {record.friendship}/10
                  </span>
                </div>
                <div className="text-[9px] text-dim tracking-widest mt-1 text-center">
                  {"// ОТНОШЕНИЯ //"}
                </div>
              </div>
            )}

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
              <div
                className="panel-inset p-3 space-y-3 fade-in"
                style={{ borderColor: "var(--amber-dim)", boxShadow: "inset 0 0 18px rgba(232,161,58,0.07)" }}
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
                    value={editDraft.title}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, title: e.target.value }))
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
                        onClick={() => setEditDraft((d) => ({ ...d, status: s }))}
                        className={`chip text-[10px] transition-all cursor-pointer ${
                          editDraft.status === s
                            ? "chip-warn"
                            : "opacity-60 hover:opacity-100"
                        }`}
                        aria-pressed={editDraft.status === s}
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
                        editDraft.description.length > 5900 ? "glow-red" : "text-dim"
                      }`}
                    >
                      {editDraft.description.length}/6000
                    </span>
                  </div>
                  <textarea
                    id="dossier-desc-edit"
                    value={editDraft.description}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, description: e.target.value }))
                    }
                    maxLength={6000}
                    rows={12}
                    spellCheck={false}
                    className="w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-2 text-[13px] leading-relaxed text-[var(--text)] transition-colors crt-scroll resize-y min-h-[220px]"
                    placeholder="Впишите историю героя… Пустая строка — новый абзац."
                  />
                </div>

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
                    onClick={saveEdit}
                    disabled={saving}
                    className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-default"
                  >
                    {saving ? "▸ ЗАПИСЬ В АРХИВ…" : "💾 СОХРАНИТЬ ДОСЬЕ"}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      sfx.blip();
                    }}
                    disabled={saving}
                    className="btn-crt clip-hud-sm px-4 py-2 text-xs"
                  >
                    ✕ ОТМЕНА
                  </button>
                </div>
              </div>
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
              ) : isCorrupted ? (
                // Искажённые досье: при каждом открытии порча выбирает
                // случайные слова — прочесть текст до конца невозможно.
                <CorruptedText
                  text={displayRecord.description}
                  ratio={0.42}
                  variant="red"
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
                  background: "rgba(232, 161, 58, 0.08)",
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
                  background: "rgba(232, 161, 58, 0.08)",
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
                  background: "rgba(167, 139, 250, 0.08)",
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

            {/* Модалка «Проникнуть в память» — Бруно отказался */}
            {memoryProbeOpen && (
              <div
                className="fixed inset-0 z-[9700] flex items-center justify-center p-4"
                style={{ background: "rgba(2, 0, 2, 0.9)", backdropFilter: "blur(4px)" }}
                onClick={() => setMemoryProbeOpen(false)}
                role="dialog"
                aria-modal="true"
                aria-label="Проникновение в память"
              >
                <div
                  className="panel clip-hud brackets w-full max-w-md p-8 text-center fade-in"
                  style={{
                    borderColor: "var(--violet-dim)",
                    boxShadow: "0 0 40px rgba(167, 139, 250, 0.3)",
                    animation: "modalIn 0.3s ease-out forwards",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-5xl mb-4 pulse-slow">🧠</div>
                  <div className="font-medieval text-lg glow-violet tracking-wider mb-3 glitch" data-text="ОТКАЗАНО">
                    ОТКАЗАНО
                  </div>
                  <div className="text-[14px] text-[var(--text)] leading-relaxed mb-6">
                    Бруно отказался от этого действия...
                    <br />
                    <span className="text-dim italic">Пока что.</span>
                  </div>
                  <button
                    onClick={() => setMemoryProbeOpen(false)}
                    className="btn-crt clip-hud-sm px-6 py-2 text-xs"
                  >
                    ◂ ЗАКРЫТЬ
                  </button>
                </div>
              </div>
            )}

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
                    <span className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(232,161,58,0.3), rgba(232,161,58,0.1))", width: `${ritualCharge}%`, transition: "width 0.05s linear" }} />
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
                    background: "rgba(232, 161, 58, 0.08)",
                  }}
                  title={isDossierOwner ? "Это ваше досье — впишите свою историю" : "Созидатель может править любое досье"}
                >
                  ✎ РЕДАКТИРОВАТЬ
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
          <div className="md:w-[45%] p-4 sm:p-6 flex flex-col bg-[var(--bg-deep)] min-h-[300px] relative">
            <div className="text-[10px] text-dim tracking-widest mb-3 absolute top-3 left-4 z-30">{"// ПРОЕКЦИЯ //"}</div>
            <div className="flex-1 flex items-center justify-center w-full min-h-[280px] holo-reveal">
              {record.imageUrl && !isSealed ? (
                <HoloPortrait src={displayRecord.imageUrl} corrupted={isCorrupted} sealed={isSealed} status={record.status} full fallbackGlyph={record.sigil} />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Sigil glyph={record.sigil} corrupted={isCorrupted} size={180} />
                  {isSealed && (
                    <div className="text-center">
                      <div className="font-vt323 text-xl glow-amber">[ ПЕЧАТЬ ]</div>
                      <div className="text-dim text-[10px] tracking-wider mt-1">{"// проекция недоступна //"}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 w-full panel-inset p-2 text-[9px] text-dim tracking-wider">
              <div className="flex justify-between"><span>SIGIL</span><span className="glow-green">{record.sigil}</span></div>
              <div className="flex justify-between"><span>MAP_X</span><span>{record.mapX}</span></div>
              <div className="flex justify-between"><span>MAP_Y</span><span>{record.mapY}</span></div>
              <div className="flex justify-between">
                <span>STATUS</span>
                <span className={record.status === "DEAD" ? "glow-red" : record.status === "MISSING" ? "glow-amber" : "glow-green"}>
                  {record.status ?? "ALIVE"}
                </span>
              </div>
            </div>
          </div>
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
