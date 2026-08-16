"use client";

import { useState } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

export function LoginForm() {
  const login = useArchive((s) => s.login);
  const [loginStr, setLoginStr] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginStr.trim() || !password.trim()) {
      setError("Заполните все поля");
      sfx.error();
      return;
    }
    // Проверка бана (12 часов после стирания при 140% взгляда)
    if (typeof window !== "undefined") {
      const bannedUntil = window.localStorage.getItem(
        `ashen-banned-${loginStr.trim()}`
      );
      if (bannedUntil) {
        const until = parseInt(bannedUntil, 10);
        if (Date.now() < until) {
          const hoursLeft = Math.ceil((until - Date.now()) / (60 * 60 * 1000));
          setError(`Страж стёрт из архива. Возврат через ${hoursLeft} ч.`);
          sfx.error();
          return;
        } else {
          // Бан истёк — удаляем
          window.localStorage.removeItem(`ashen-banned-${loginStr.trim()}`);
        }
      }
    }
    setLoading(true);
    setError(null);
    const res = await login(loginStr.trim(), password);
    setLoading(false);
    if (!res.ok) {
      setError(
        res.error === "INVALID_CREDENTIALS"
          ? "Неверный шифр или имя стража"
          : res.error === "NETWORK"
            ? "Нет связи с архивом"
            : "Ошибка входа"
      );
      sfx.error();
    } else {
      sfx.boot();
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        {/* emblem */}
        <div className="text-center mb-8">
          <div className="text-5xl glow-green-strong mb-3 pulse-slow">👁</div>
          <div className="font-medieval text-3xl sm:text-4xl glow-green-strong tracking-widest mb-2">
            ВРАТА АРХИВА
          </div>
          <div className="text-dim text-[11px] tracking-[0.3em]">
            {"// ОРДЕН ПЕПЕЛЬНОЙ ДЛАНИ //"}
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="panel clip-hud brackets p-5 sm:p-6 space-y-4"
        >
          <div className="text-[10px] text-dim tracking-widest mb-1">
            {"// АВТОРИЗАЦИЯ СТРАЖА //"}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="login"
              className="block text-[11px] glow-green tracking-widest"
            >
              {"> ИМЯ СТРАЖА:"}
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              value={loginStr}
              onChange={(e) => setLoginStr(e.target.value)}
              disabled={loading}
              className="w-full bg-[var(--bg-deep)] border border-[var(--line-bright)] px-3 py-2 text-sm text-[var(--green)] focus:outline-none focus:border-[var(--green)] focus:shadow-[0_0_10px_rgba(74,246,38,0.3)] transition-all font-mono-crt clip-hud-sm disabled:opacity-50"
              placeholder="введите имя..."
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-[11px] glow-green tracking-widest"
            >
              {"> ШИФР:"}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full bg-[var(--bg-deep)] border border-[var(--line-bright)] px-3 py-2 text-sm text-[var(--green)] focus:outline-none focus:border-[var(--green)] focus:shadow-[0_0_10px_rgba(74,246,38,0.3)] transition-all font-mono-crt clip-hud-sm disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="panel-inset p-2 text-center fade-in">
              <span className="glow-red text-sm glitch" data-text={error}>
                [ {error} ]
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-crt clip-hud-sm w-full py-2.5 text-sm tracking-widest disabled:opacity-50 disabled:cursor-wait"
          >
            {loading ? (
              <span className="hint-caret">ПРОВЕРКА ШИФРА</span>
            ) : (
              "ВОЙТИ В АРХИВ"
            )}
          </button>
        </form>

        <div className="text-center text-[10px] text-dim mt-6 leading-relaxed px-4">
          {"// доступ определяет мир: страж Эларии — D&D 5e, страж Голариона — Pathfinder 2e //"}
          <br />
          {"// спросите Мастера об учётной записи //"}
        </div>
      </div>
    </div>
  );
}
