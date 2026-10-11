"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useArchive } from "@/lib/store";
import { usePresence, sendBroadcast, kickUser, presenceEnabled } from "@/lib/presence";
import { sfx } from "@/lib/audio";
import type {
  Achievement,
  Character,
  Chronicle,
  GameSystem,
  PresenceUser,
  UserSummary,
} from "@/lib/types";
import { Sigil } from "@/components/crt/Sigil";
import { UserProfileModal } from "@/components/crt/UserProfileModal";

const SYS_COLOR: Record<GameSystem, string> = {
  DND: "var(--red)",
  PF2E: "var(--cyan)",
};
const SYS_LABEL: Record<GameSystem, string> = {
  DND: "D&D 5e · ЭЛАРИЯ",
  PF2E: "PF2E · ГОЛАРИОН",
};

// режимы сортировки реестра стражей
const SORT_MODES = [
  { id: "ONLINE", label: "ПО СЕТИ" },
  { id: "PROGRESS", label: "ПО ПРОГРЕССУ" },
  { id: "DAYS", label: "ПО СТАЖУ" },
] as const;
type SortMode = (typeof SORT_MODES)[number]["id"];

export function ProfileSection({ system }: { system: GameSystem }) {
  const user = useArchive((s) => s.user);
  const shards = useArchive((s) => s.shards);
  const achievements = useArchive((s) => s.achievements);
  const unlockedIds = useArchive((s) => s.unlockedIds);
  const solvedRiddles = useArchive((s) => s.solvedRiddles);
  const revealedSecrets = useArchive((s) => s.revealedSecrets);
  const konamiUnlocked = useArchive((s) => s.konamiUnlocked);
  const gaze = useArchive((s) => s.gaze);
  const totalShardWords = useArchive((s) => s.totalShardWords);
  const pushToast = useArchive((s) => s.pushToast);
  const resetMyProgress = useArchive((s) => s.resetMyProgress);

  const online = usePresence((s) => s.online);
  const lastSeenMap = usePresence((s) => s.lastSeen);

  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [achCatalog, setAchCatalog] = useState<Achievement[] | null>(null);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [viewUser, setViewUser] = useState<UserSummary | null>(null);

  // ── фильтр стражей по миру ──
  const [worldFilter, setWorldFilter] = useState<"ALL" | GameSystem>("ALL");

  // ── сортировка стражей: сеть / прогресс / стаж ──
  const [sortMode, setSortMode] = useState<SortMode>("ONLINE");

  // ── летопись сессий текущего мира (блок «Летопись» в досье) ──
  const [chronicles, setChronicles] = useState<Chronicle[] | null>(null);

  // ── тикер, чтобы относительные времена («был в сети N мин») обновлялись ──
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // ── сброс прогресса: двухшаговое подтверждение ──
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {});
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((d) => setAchCatalog(d ?? []))
      .catch(() => {});
  }, []);

  // каталог персонажей ОБЕИХ миров — своя привязка, имена персонажей
  // в карточках стражей и админ-привязки
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/archive?type=characters&system=DND")
        .then((r) => r.json())
        .catch(() => []),
      fetch("/api/archive?type=characters&system=PF2E")
        .then((r) => r.json())
        .catch(() => []),
    ]).then(([a, b]) => {
      if (cancelled) return;
      setCharacters([
        ...(Array.isArray(a) ? a : []),
        ...(Array.isArray(b) ? b : []),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // летопись сессий текущего мира — перезагружается при смене мира (W)
  useEffect(() => {
    let cancelled = false;
    setChronicles(null);
    fetch(`/api/archive?type=chronicles&system=${system}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setChronicles(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        if (!cancelled) setChronicles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [system]);

  // последние сессии летописи (новые сверху)
  const chronicleList = useMemo(
    () =>
      [...(chronicles ?? [])]
        .sort((a, b) => b.sessionNumber - a.sessionNumber)
        .slice(0, 6),
    [chronicles],
  );

  const achList = useMemo(
    () => (achCatalog ?? []).filter((a) => !a.system || a.system === system),
    [achCatalog, system],
  );

  const onlineByLogin = useMemo(() => {
    const m = new Map<string, PresenceUser>();
    for (const o of online) m.set(o.login, o);
    return m;
  }, [online]);

  // мой персонаж (если привязан)
  const myCharacter = useMemo(
    () => characters?.find((c) => c.id === user?.characterId) ?? null,
    [characters, user?.characterId],
  );

  // собственная карточка в реестре — оттуда берём дату вступления в архив
  const myCreatedAt = useMemo(
    () => users?.find((u) => u.login === user?.login)?.createdAt ?? null,
    [users, user?.login],
  );
  const myDays = myCreatedAt ? daysInArchive(myCreatedAt) : 0;
  const mySinceDate = myCreatedAt ? formatDateRu(myCreatedAt) : null;

  // id → персонаж (для имён в карточках стражей)
  const charById = useMemo(() => {
    const m = new Map<string, Character>();
    for (const c of characters ?? []) m.set(c.id, c);
    return m;
  }, [characters]);

  // балл прогресса стража (для сортировки «по прогрессу»):
  // достижения и осколки памяти весят больше прочих находок
  const progressScore = (u: UserSummary): number => {
    const s = u.summary;
    if (!s) return -1;
    return (
      s.achievements * 3 +
      s.shards * 2 +
      s.unlockedIds +
      s.solvedRiddles +
      s.revealedSecrets
    );
  };

  // сортировка стражей — зависит от выбранного режима (+ фильтр по миру)
  const sortedUsers = useMemo(() => {
    if (!users) return null;
    const list = [...users].filter(
      (u) => worldFilter === "ALL" || u.system === worldFilter,
    );
    if (sortMode === "PROGRESS") {
      list.sort(
        (a, b) => progressScore(b) - progressScore(a) || a.login.localeCompare(b.login),
      );
    } else if (sortMode === "DAYS") {
      list.sort(
        (a, b) =>
          daysInArchive(b.createdAt) - daysInArchive(a.createdAt) ||
          a.login.localeCompare(b.login),
      );
    } else {
      // ПО СЕТИ: онлайн первыми, затем админы, далее по логину
      list.sort((a, b) => {
        const aOn = onlineByLogin.has(a.login) ? 0 : 1;
        const bOn = onlineByLogin.has(b.login) ? 0 : 1;
        if (aOn !== bOn) return aOn - bOn;
        const aAdm = a.role === "ADMIN" ? 0 : 1;
        const bAdm = b.role === "ADMIN" ? 0 : 1;
        if (aAdm !== bAdm) return aAdm - bAdm;
        return a.login.localeCompare(b.login);
      });
    }
    return list;
  }, [users, onlineByLogin, worldFilter, sortMode]);

  // сброс прогресса до нуля (сервер + локальный стор)
  const doReset = async () => {
    setResetting(true);
    const ok = await resetMyProgress();
    setResetting(false);
    setConfirmReset(false);
    if (confirmTimer.current) {
      clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
    if (ok) {
      sfx.glitch();
      pushToast({
        kind: "warn",
        title: "ЛЕТОПИСЬ ОБНУЛЕНА",
        body: "Архив забыл ваши шаги. Прогресс этого мира сброшен до нуля.",
      });
    } else {
      sfx.error();
      pushToast({
        kind: "warn",
        title: "ОТКАЗ АРХИВА",
        body: "Сброс не выполнен — связь с хранилищем прервана.",
      });
    }
  };

  const armReset = () => {
    setConfirmReset(true);
    sfx.thud();
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmReset(false), 6000);
  };

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const gazeColor =
    gaze >= 90 ? "var(--red)" : gaze >= 60 ? "var(--amber)" : "var(--green)";

  return (
    <section className="flex flex-col gap-3">
      {/* ─── шапка раздела ─── */}
      <div className="panel clip-hud-sm px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-dim tracking-widest">
          КОРЕНЬ &gt; СЕКТОР_{system} &gt;
        </span>
        <span className="text-[11px] glow-amber tracking-widest">
          ЗАПРОС_ПРОФИЛЬ_СТРАЖА
        </span>
        <span className="flex-1" />
        {presenceEnabled ? (
          <span className="chip chip-ok text-[10px]">
            <span className="online-dot inline-block mr-1 align-middle" />
            В СЕТИ: {online.length}
          </span>
        ) : (
          <span className="chip text-[10px] text-dim" title="Сервис онлайна не подключён в этой сборке">
            ◌ ЗЕРКАЛО ТУМАННО
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-medieval text-2xl glow-amber tracking-wider">
          Профиль стража
        </h2>
        <span className="text-[10px] text-dim">
          {"// досье, прогресс и братья по архиву //"}
        </span>
      </div>

      {/* ─── карточка собственного профиля ─── */}
      <div className="panel clip-hud brackets p-4 sm:p-5">
        <div className="flex flex-col md:flex-row gap-5">
          {/* аватар + идентификация */}
          <div className="flex items-start gap-4 md:w-[340px] shrink-0">
            <div
              className="panel-inset p-3 shrink-0"
              style={{
                borderColor: isAdmin ? "var(--amber-dim)" : undefined,
                boxShadow: isAdmin ? "0 0 24px rgba(232,161,58,0.18)" : undefined,
              }}
            >
              <Sigil
                glyph={isAdmin ? "⚡" : "🛡"}
                size={84}
                spin={isAdmin}
                corrupted={false}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medieval text-xl leading-tight break-words">
                {user?.displayName ?? "—"}
              </div>
              <div className="text-[11px] text-dim tracking-wider mt-0.5">
                логин: <span className="glow-green">{user?.login}</span>
              </div>
              {mySinceDate && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="chip text-[9px]" title="Полных суток в архиве">
                    ⌛ {myDays} дн.
                  </span>
                  <span className="text-[10px] text-dim italic">
                    в архиве с {mySinceDate}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span
                  className="chip text-[10px]"
                  style={{
                    color: SYS_COLOR[system],
                    borderColor:
                      system === "DND"
                        ? "var(--red-dim)"
                        : "rgba(63,214,200,0.4)",
                  }}
                >
                  {SYS_LABEL[system]}
                </span>
                {isAdmin ? (
                  <span className="chip chip-warn text-[10px]">
                    ⚡ АДМИНИСТРАТОР
                  </span>
                ) : (
                  <span className="chip text-[10px]">🛡 СТРАЖ</span>
                )}
                <span className="chip chip-ok text-[10px]">
                  <span className="online-dot inline-block mr-1 align-middle" />
                  В СЕТИ
                </span>
              </div>
            </div>
          </div>

          {/* статистика прогресса */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
            <Stat
              label="ОСКОЛКИ ПАМЯТИ"
              value={`${shards.length}${totalShardWords > 0 ? `/${totalShardWords}` : ""}`}
              color="green"
            />
            <Stat
              label="СНЯТЫХ ПЕЧЕЙ"
              value={`${unlockedIds.length}`}
              color="green"
            />
            <Stat
              label="РАЗГАДАННЫХ ЗАГАДОК"
              value={`${solvedRiddles.length}`}
              color="violet"
            />
            <Stat
              label="ДОСТИЖЕНИЯ"
              value={`${achievements.length}/${achList.length || "…"}`}
              color="amber"
            />
            <Stat
              label="РАСКРЫТЫХ СЕКРЕТОВ"
              value={`${revealedSecrets.length}`}
              color="violet"
            />
            <Stat
              label="ВЗГЛЯД СОЗИДАТЕЛЯ"
              value={`${Math.round(gaze)}%`}
              color="green"
              valueColor={gazeColor}
            />
            <Stat label="ДНЕЙ В АРХИВЕ" value={`${myDays}`} color="amber" />
          </div>
        </div>

        {/* привязанный персонаж */}
        <div className="mt-4 pt-4 border-t border-[var(--line)]">
          <div className="text-[10px] text-dim tracking-widest mb-2">
            {"// ПЕРСОНАЖ_АРХИВА //"}
          </div>
          {myCharacter ? (
            <div className="panel-inset p-3 flex items-center gap-4 flex-wrap">
              {myCharacter.imageUrl && (
                <img
                  src={myCharacter.imageUrl}
                  alt={myCharacter.name}
                  className="w-14 h-14 object-cover clip-hud-sm"
                  style={{ filter: "saturate(0.85) contrast(1.05)" }}
                />
              )}
              <div className="min-w-0">
                <div className="font-medieval text-base glow-amber">
                  {myCharacter.sigil} {myCharacter.name}
                </div>
                <div className="text-[11px] text-dim">
                  {myCharacter.title} · {myCharacter.race}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: myCharacter.status === "DEAD" ? "var(--red)" : "var(--green)" }}>
                  {myCharacter.status === "DEAD"
                    ? "💀 ПАЛ"
                    : myCharacter.status === "MISSING"
                      ? "❓ ПРОПАЛ БЕЗ ВЕСТИ"
                      : "✓ ЖИВ"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-dim italic">
              {"// привязка персонажа не установлена — обратитесь к Созидателю //"}
            </div>
          )}
          {konamiUnlocked && (
            <div className="mt-2 chip chip-violet text-[10px]">
              ⟁ KONAMI-СЕКРЕТ ОТКРЫТ
            </div>
          )}
        </div>

        {/* ── зона обнуления: сброс прогресса до нуля ── */}
        <div className="mt-4 pt-4 border-t border-[var(--line)] flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <div
              className="text-[10px] tracking-widest"
              style={{ color: "var(--red)" }}
            >
              {"// ОБНУЛЕНИЕ_ЛЕТОПИСИ //"}
            </div>
            <div className="text-[10px] text-dim italic">
              стереть достижения, осколки, снятые печати и разгадки этого
              мира — без возврата
            </div>
          </div>
          {confirmReset ? (
            <button
              onClick={doReset}
              disabled={resetting}
              className="btn-crt btn-red clip-hud-sm px-4 py-2 text-xs shrink-0 disabled:opacity-40 disabled:cursor-default animate-pulse"
              aria-label="Подтвердить сброс прогресса"
            >
              {resetting ? "▸ ОБНУЛЕНИЕ…" : "☢ ПОДТВЕРДИТЬ СБРОС"}
            </button>
          ) : (
            <button
              onClick={armReset}
              className="btn-crt clip-hud-sm px-4 py-2 text-xs shrink-0"
              style={{ borderColor: "var(--red-dim)", color: "var(--red)" }}
              aria-label="Сбросить прогресс до нуля"
            >
              ☢ СБРОСИТЬ ПРОГРЕСС
            </button>
          )}
        </div>
      </div>

      {/* ─── достижения: полный реестр (переехал из отдельной вкладки) ─── */}
      <div className="panel clip-hud-sm p-3">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="text-[10px] text-dim tracking-widest">
            {"// РЕЕСТР_ДОСТИЖЕНИЙ //"}
          </div>
          <span className="text-[10px] text-dim italic">
            {"// вкладка переехала в досье стража //"}
          </span>
          <span className="flex-1" />
          <span className="chip chip-warn text-[10px]">
            ОТКРЫТО: {achievements.length} / {achList.length || "…"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 content-start">
          {achList.map((a) => {
            const on = achievements.includes(a.code);
            return (
              <div
                key={a.id}
                className={`panel-inset brackets p-3 flex gap-3 items-start transition-all ${
                  on ? "" : "opacity-60 grayscale"
                }`}
              >
                <Sigil glyph={a.sigil} size={44} spin={on} corrupted={!on} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-dim tracking-wider">
                    {a.code}
                  </div>
                  <div
                    className={`font-medieval text-sm leading-tight ${
                      on ? "glow-amber" : "text-dim"
                    }`}
                  >
                    {on ? a.name : "// сокрыто //"}
                  </div>
                  {/* описание видно ТОЛЬКО после выполнения */}
                  {on && a.description ? (
                    <p className="text-[11px] text-dim mt-1 leading-relaxed">
                      {a.description}
                    </p>
                  ) : null}
                  {!on && (
                    <p className="text-[11px] text-dim mt-1 italic leading-relaxed">
                      {"// описание сокрыто до выполнения //"}
                    </p>
                  )}
                  {/* намёк для DESTROYER даже когда закрыт */}
                  {!on && a.code === "DESTROYER" && (
                    <div className="mt-1.5 panel-inset p-1.5 border-l-2 border-[var(--cyan)]">
                      <div className="text-[9px] glow-cyan tracking-widest mb-0.5">
                        ⟁ НАМЕК
                      </div>
                      <div className="text-[10px] italic text-[var(--text)]">
                        Вспомни прошлое
                      </div>
                    </div>
                  )}
                  {/* тайный фрагмент — после выполнения */}
                  {on && a.secretFragment && (
                    <div className="mt-1.5 panel-inset p-1.5 border-l-2 border-[var(--violet)]">
                      <div className="text-[9px] glow-violet tracking-widest mb-0.5">
                        ⟁ ПОДСКАЗКА
                      </div>
                      <div className="text-[10px] italic text-[var(--text)]">
                        {a.secretFragment}
                      </div>
                    </div>
                  )}
                  <div className="mt-1.5">
                    {on ? (
                      <span className="chip chip-warn text-[9px]">✓ ОТКРЫТО</span>
                    ) : (
                      <span className="chip text-[9px]">🔒 ЗАКРЫТО</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── летопись сессий мира ─── */}
      <div className="panel clip-hud-sm p-3">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="text-[10px] text-dim tracking-widest">
            {"// ЛЕТОПИСЬ_СЕССИЙ //"}
          </div>
          <span className="text-[10px] text-dim italic">
            {"// хроника партии этого мира //"}
          </span>
          <span className="flex-1" />
          <span className="chip chip-warn text-[10px]">
            СЕССИЙ: {chronicles?.length ?? "···"}
          </span>
        </div>

        {!chronicles && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="panel-inset p-3 h-14 animate-pulse" />
            ))}
          </div>
        )}

        {chronicles && chronicles.length === 0 && (
          <div className="text-[11px] text-dim italic p-2">
            {"// летопись этого мира пока чиста — сессии не записаны //"}
          </div>
        )}

        {chronicles && chronicleList.length > 0 && (
          <div className="space-y-1.5 max-h-96 overflow-y-auto crt-scroll pr-1">
            {chronicleList.map((c) => (
              <div
                key={c.id}
                className="panel-inset p-2.5 flex gap-3 items-start border-l-2 transition-[filter] hover:brightness-110"
                style={{
                  borderLeftColor: c.isLocked
                    ? "var(--violet)"
                    : "var(--amber-dim)",
                }}
              >
                <div
                  className="font-vt323 text-xl glow-amber w-12 text-center shrink-0 leading-none pt-0.5"
                  title={`Сессия №${c.sessionNumber}`}
                >
                  {toRoman(c.sessionNumber)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medieval text-sm leading-tight ${
                        c.isLocked ? "text-dim" : "glow-amber"
                      }`}
                    >
                      {c.title}
                    </span>
                    <span className="chip text-[9px] shrink-0">{c.date}</span>
                    {c.isCorrupted && (
                      <span className="chip chip-err text-[9px]">▓ ИСКАЖЕНО</span>
                    )}
                  </div>
                  {c.isLocked ? (
                    <p className="text-[11px] text-dim italic mt-1">
                      {"// печать не снята — текст под грифом Ордена //"}
                    </p>
                  ) : (
                    <p className="text-[11px] text-dim mt-1 leading-relaxed line-clamp-2">
                      {c.summary}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {chronicles.length > chronicleList.length && (
              <div className="text-[10px] text-dim italic text-center pt-1">
                {"// показаны последние сессии летописи //"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── стражи архива (все + онлайн) ─── */}
      <div className="panel clip-hud-sm p-3">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="text-[10px] text-dim tracking-widest">
            {"// СТРАЖИ_АРХИВА //"}
          </div>
          <span className="flex-1" />
          {presenceEnabled ? (
            <span className="chip chip-ok text-[10px]">
              В СЕТИ: {online.length}
            </span>
          ) : (
            <span className="chip text-[10px] text-dim">
              ◌ БЕЗ ЗЕРКАЛА
            </span>
          )}
          <span className="chip text-[10px]">ВСЕГО: {users?.length ?? "···"}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-3 text-[10px] text-dim tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5" style={{ background: "var(--red)" }} />
            ЭЛАРИЯ (D&D)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5" style={{ background: "var(--cyan)" }} />
            ГОЛАРИОН (PF2E)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5" style={{ background: "var(--amber)" }} />
            АДМИНИСТРАТОР
          </span>
          <span className="flex-1" />
          {/* фильтр по миру */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] text-dim tracking-widest">ФИЛЬТР:</span>
            {(["ALL", "DND", "PF2E"] as const).map((f) => {
              const active = worldFilter === f;
              const color =
                f === "DND" ? "var(--red)" : f === "PF2E" ? "var(--cyan)" : "var(--amber)";
              return (
                <button
                  key={f}
                  onClick={() => {
                    setWorldFilter(f);
                    sfx.hover();
                  }}
                  className={`chip text-[9px] cursor-pointer transition-all ${
                    active ? "" : "opacity-45 hover:opacity-80"
                  }`}
                  style={
                    active
                      ? {
                          color,
                          borderColor: color,
                          boxShadow: `0 0 10px ${color}33`,
                        }
                      : undefined
                  }
                  aria-pressed={active}
                >
                  {f === "ALL" ? "ВСЕ" : f === "DND" ? "ЭЛАРИЯ" : "ГОЛАРИОН"}
                </button>
              );
            })}
          </div>
          {/* сортировка реестра стражей */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] text-dim tracking-widest">СОРТ:</span>
            {SORT_MODES.map((m) => {
              const active = sortMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setSortMode(m.id);
                    sfx.hover();
                  }}
                  className={`chip text-[9px] cursor-pointer transition-all ${
                    active ? "" : "opacity-45 hover:opacity-80"
                  }`}
                  style={
                    active
                      ? {
                          color: "var(--green)",
                          borderColor: "var(--green)",
                          boxShadow: "0 0 10px rgba(120,255,170,0.18)",
                        }
                      : undefined
                  }
                  aria-pressed={active}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {!users && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="panel-inset p-3 h-20 animate-pulse" />
            ))}
          </div>
        )}

        {sortedUsers && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto crt-scroll pr-1">
            {sortedUsers.map((u) => {
              const pres = onlineByLogin.get(u.login);
              const isOnline = !!pres;
              const isSelf = u.login === user?.login;
              const color = SYS_COLOR[u.system];
              const char = u.characterId
                ? charById.get(u.characterId)
                : undefined;
              const openDossier = isAdmin && !isSelf;
              return (
                <div
                  key={u.login}
                  onClick={openDossier ? () => setViewUser(u) : undefined}
                  onKeyDown={
                    openDossier
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setViewUser(u);
                          }
                        }
                      : undefined
                  }
                  role={openDossier ? "button" : undefined}
                  tabIndex={openDossier ? 0 : undefined}
                  className={`guard-card panel clip-hud-sm p-3 border-l-2 ${isOnline ? "guard-online" : ""} ${u.role === "ADMIN" ? "guard-admin" : ""} ${isSelf ? "guard-self" : ""} ${openDossier ? "cursor-pointer hover:brightness-125 transition-[filter]" : ""}`}
                  style={{ borderLeftColor: color }}
                  title={
                    isSelf
                      ? "Это вы"
                      : openDossier
                        ? "Открыть полное досье стража"
                        : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className={isOnline ? "online-dot shrink-0" : "offline-dot shrink-0"} />
                    <span className="text-xs truncate flex-1 min-w-0">
                      {u.role === "ADMIN" && <span className="glow-amber">⚡ </span>}
                      {u.displayName}
                    </span>
                    {isSelf && (
                      <span className="chip chip-ok text-[9px] shrink-0">ЭТО ВЫ</span>
                    )}
                  </div>
                  <div className="text-[9px] text-dim tracking-wider mt-0.5 truncate">
                    {u.login} · {u.system === "DND" ? "ЭЛАРИЯ" : "ГОЛАРИОН"}
                  </div>
                  {/* время в архиве / последний визит */}
                  {isOnline && pres ? (
                    <div className="text-[9px] mt-0.5" style={{ color: "var(--green)" }}>
                      ⏱ в архиве: {formatDuration(Date.now() - pres.since)}
                    </div>
                  ) : lastSeenMap[u.login] ? (
                    <div className="text-[9px] text-dim italic mt-0.5">
                      ⚑ был в сети: {formatLastSeen(lastSeenMap[u.login])}
                    </div>
                  ) : null}
                  {char ? (
                    <div
                      className="text-[10px] mt-1 truncate"
                      style={{ color }}
                      title="Персонаж стража"
                    >
                      {char.sigil} {char.name}
                    </div>
                  ) : (
                    <div className="text-[10px] text-dim italic mt-1 truncate">
                      без персонажа
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <span className="chip text-[9px]" style={{ color, borderColor: color }}>
                      {u.system}
                    </span>
                    {daysInArchive(u.createdAt) > 0 && (
                      <span
                        className="chip text-[9px]"
                        title={`В архиве ${daysInArchive(u.createdAt)} дн. (с ${formatDateRu(u.createdAt)})`}
                      >
                        ⌛ {daysInArchive(u.createdAt)}д
                      </span>
                    )}
                    {u.summary ? (
                      <>
                        <span className="chip chip-warn text-[9px]">🏆 {u.summary.achievements}</span>
                        <span className="chip chip-ok text-[9px]">🧩 {u.summary.shards}</span>
                      </>
                    ) : (
                      <span className="text-[9px] text-dim italic">новичок</span>
                    )}
                    {isOnline && !isSelf && isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          kickUser(u.login);
                          pushToast({
                            kind: "warn",
                            title: "РИТУАЛ ИЗГНАНИЯ",
                            body: `${u.displayName} изгнан из архива.`,
                          });
                          sfx.thud();
                        }}
                        className="chip chip-err text-[9px] cursor-pointer hover:opacity-80"
                        title="Изгнать стража из архива"
                      >
                        ⏻ ИЗГНАТЬ
                      </button>
                    )}
                    {openDossier && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewUser(u);
                        }}
                        className="chip chip-cyan text-[9px] cursor-pointer hover:opacity-80"
                        title="Открыть полное досье стража"
                      >
                        👁 ДОСЬЕ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── админ-панель ─── */}
      {isAdmin && (
        <AdminPanel
          users={users ?? []}
          characters={characters ?? []}
          system={system}
        />
      )}

      {/* модалка чужого профиля (только админ) */}
      {viewUser && isAdmin && (
        <UserProfileModal
          target={viewUser}
          requester={user?.login ?? ""}
          onClose={() => setViewUser(null)}
        />
      )}
    </section>
  );
}

// ─── админ-панель: вещание + привязки ──────────────────────────────────

function AdminPanel({
  users,
  characters,
  system,
}: {
  users: UserSummary[];
  characters: Character[];
  system: GameSystem;
}) {
  const pushToast = useArchive((s) => s.pushToast);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  // привязки
  const [bindLogin, setBindLogin] = useState("");
  const [bindChar, setBindChar] = useState("");
  const [bindSaving, setBindSaving] = useState(false);
  const user = useArchive((s) => s.user);

  const doBroadcast = () => {
    const text = msg.trim();
    if (!text) return;
    setSending(true);
    sendBroadcast(text);
    sfx.glitch();
    setTimeout(() => {
      setSending(false);
      setMsg("");
      pushToast({
        kind: "warn",
        title: "ГОЛОС АРХИВА",
        body: "Сообщение отправлено всем стражам в сети.",
      });
    }, 400);
  };

  const doBind = async () => {
    if (!bindLogin) return;
    setBindSaving(true);
    try {
      const r = await fetch("/api/users/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester: user?.login,
          login: bindLogin,
          characterId: bindChar || null,
        }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        sfx.unlock();
        pushToast({
          kind: "ach",
          title: "ПРИВЯЗКА ОБНОВЛЕНА",
          body: bindChar
            ? `Персонаж привязан к стражу ${bindLogin}.`
            : `Привязка стража ${bindLogin} снята.`,
        });
      } else {
        sfx.error();
        pushToast({
          kind: "warn",
          title: "ОТКАЗ АРХИВА",
          body: `Код: ${d.error ?? "UNKNOWN"}`,
        });
      }
    } catch {
      sfx.error();
    } finally {
      setBindSaving(false);
    }
  };

  const sysChars = characters.filter((c) => c.system === system);

  return (
    <div
      className="panel clip-hud brackets p-4"
      style={{ borderColor: "var(--amber-dim)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="glow-amber text-sm tracking-widest">
          ⚡ ПАНЕЛЬ СОЗИДАТЕЛЯ
        </span>
        <span className="text-[10px] text-dim">
          {"// доступно только администраторам архива //"}
        </span>
      </div>

      {/* вещание */}
      <div className="panel-inset p-3 mb-3">
        <div className="text-[10px] text-dim tracking-widest mb-2">
          {"// ВЕЩАНИЕ_НА_ВЕСЬ_ЭКРАН //"}
        </div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value.slice(0, 500))}
          placeholder="// введите послание стражам архива… //"
          rows={3}
          className="w-full bg-[var(--bg-deep)] text-sm text-[var(--text)] p-2 outline-none border border-[var(--line)] focus:border-[var(--red-dim)] transition-colors resize-none crt-scroll font-mono-crt"
          aria-label="Текст сообщения для всех стражей"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={doBroadcast}
            disabled={!msg.trim() || sending}
            className="btn-crt btn-red clip-hud-sm px-4 py-2 text-xs disabled:opacity-40 disabled:cursor-default"
          >
            {sending ? "▸ ПЕРЕДАЧА…" : "📢 ОТПРАВИТЬ ВСЕМ"}
          </button>
          <span className="text-[9px] text-dim">
            {msg.length}/500 · получат все стражи в сети
          </span>
        </div>
      </div>

      {/* привязка персонажей */}
      <div className="panel-inset p-3">
        <div className="text-[10px] text-dim tracking-widest mb-2">
          {"// ПРИВЯЗКА_ПЕРСОНАЖЕЙ //"}
        </div>
        <div className="text-[10px] text-dim italic mb-2">
          {"// выберите стража и его персонажа из мира " + (system === "DND" ? "Эларии" : "Голариона") + " //"}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={bindLogin}
            onChange={(e) => setBindLogin(e.target.value)}
            className="flex-1 bg-[var(--bg-deep)] text-xs text-[var(--text)] p-2 outline-none border border-[var(--line)] focus:border-[var(--amber-dim)] cursor-pointer"
            aria-label="Выбор стража"
          >
            <option value="">— страж —</option>
            {users
              .filter((u) => u.system === system)
              .map((u) => (
                <option key={u.login} value={u.login}>
                  {u.login} ({u.displayName})
                </option>
              ))}
          </select>
          <select
            value={bindChar}
            onChange={(e) => setBindChar(e.target.value)}
            className="flex-[2] bg-[var(--bg-deep)] text-xs text-[var(--text)] p-2 outline-none border border-[var(--line)] focus:border-[var(--amber-dim)] cursor-pointer"
            aria-label="Выбор персонажа"
          >
            <option value="">— без привязки —</option>
            {sysChars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sigil} {c.name} — {c.title}
              </option>
            ))}
          </select>
          <button
            onClick={doBind}
            disabled={!bindLogin || bindSaving}
            className="btn-crt btn-amber clip-hud-sm px-4 py-2 text-xs disabled:opacity-40 disabled:cursor-default shrink-0"
          >
            {bindSaving ? "▸…" : "🔗 ПРИВЯЗАТЬ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── мини-стат ──────────────────────────────────────────────────────────

// ─── форматирование времени для карточек стражей ───────────────────────

// «дней в архиве»: полных суток с момента регистрации стража
function daysInArchive(createdAt: string): number {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

// римские цифры для номеров сессий — атмосфера старой хроники
function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const map: [number, string][] = [
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = Math.min(Math.floor(n), 3999);
  let out = "";
  for (const [v, s] of map) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out || "—";
}

// дата в русском формате ДД.ММ.ГГГГ
function formatDateRu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// «был в сети»: только что / N мин назад / N ч назад / вчера / DD.MM.YYYY
function formatLastSeen(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} ч назад`;
  if (h < 48) return "вчера";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// «в архиве»: сколько времени страж уже онлайн
function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "меньше минуты";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  return `${h} ч ${min % 60} мин`;
}

function Stat({
  label,
  value,
  color,
  valueColor,
}: {
  label: string;
  value: string;
  color: "amber" | "green" | "violet";
  valueColor?: string;
}) {
  const cls =
    color === "amber"
      ? "glow-amber"
      : color === "violet"
        ? "glow-violet"
        : "glow-green";
  return (
    <div className="panel-inset p-2 text-center">
      <div className={`font-vt323 text-2xl ${cls}`} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <div className="text-[9px] text-dim tracking-widest mt-0.5">{label}</div>
    </div>
  );
}
