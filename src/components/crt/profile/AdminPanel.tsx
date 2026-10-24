"use client";

import { useState } from "react";
import { useArchive } from "@/lib/store";
import { sendBroadcast } from "@/lib/presence";
import { sfx } from "@/lib/audio";
import type { Character, GameSystem, UserSummary } from "@/lib/types";

// ─── админ-панель: вещание + привязки ──────────────────────────────────

export function AdminPanel({
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
