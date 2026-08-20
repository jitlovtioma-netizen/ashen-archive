"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

interface KaliDialogProps {
  onComplete: (allYes: boolean) => void;
}

const BASE_QUESTIONS = [
  "Ты бросишь меня?",
  "Помоги мне!",
  "Тут холодно!",
  "Я не буду манипулировать тобой!",
  "У тебя есть сердце?",
  "Держишь девушку на привязи.. Тебе это нравится?",
];

const EXTRA_QUESTIONS = [
  "Ты любишь меня?",
  "Я буду послушной! И хорошо! Прими меня!",
];

type Phase = "questions" | "result" | "done";

/**
 * KaliDialog — интерактивный диалог при попытке открыть досье Кали.
 *
 * 6 базовых вопросов с кнопками «Нет» / «Да». Закрыть нельзя (ESC заблокирован).
 *
 * Если на 6-й вопрос ответить «Да» → появляются 2 дополнительных вопроса.
 *
 * Результаты:
 * - Последние 3 вопроса все «Да» → «Уфф... Я люблю когда меня шлёпают...» + ачивка
 * - В любом другом случае → «Ну ты и бесчеловечный!»
 *
 * После 5 секунд показа результата — onComplete, открывается досье.
 */
export function KaliDialog({ onComplete }: KaliDialogProps) {
  const [phase, setPhase] = useState<Phase>("questions");
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const [hasExtra, setHasExtra] = useState(false);
  const unlockAchievement = useArchive((s) => s.unlockAchievement);
  const pushToast = useArchive((s) => s.pushToast);

  // Все вопросы (базовые + дополнительные, если активированы)
  const allQuestions = hasExtra
    ? [...BASE_QUESTIONS, ...EXTRA_QUESTIONS]
    : BASE_QUESTIONS;

  // Блокировка ESC и других клавиш закрытия
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
    };
  }, []);

  // Фаза результата — через 5 секунд onComplete
  useEffect(() => {
    if (phase !== "result") return;

    // Проверяем последние 3 ответа
    const lastThree = answers.slice(-3);
    const qualifies = lastThree.length === 3 && lastThree.every((a) => a === true);

    if (qualifies) {
      const isNew = unlockAchievement("BDSM_LOVER");
      if (isNew) {
        sfx.achievement();
        pushToast({
          kind: "ach",
          sigil: "🔮",
          title: "ДОСТИЖЕНИЕ: БДСМ ЛЮБИТЕЛЬ",
          body: "Ты ответил «Да» на последние три вопроса Кали...",
        });
      }
    }

    const timer = setTimeout(() => {
      setPhase("done");
      onComplete(qualifies);
    }, 5000);
    return () => clearTimeout(timer);
  }, [phase, answers, onComplete, unlockAchievement, pushToast]);

  const handleAnswer = useCallback(
    (answer: boolean) => {
      if (transitioning) return;
      setTransitioning(true);
      sfx.blip();
      const newAnswers = [...answers, answer];
      setAnswers(newAnswers);

      setTimeout(() => {
        // Если это 6-й вопрос (индекс 5) и ответ «Да» — активируем доп. вопросы
        if (qIdx === BASE_QUESTIONS.length - 1 && answer) {
          setHasExtra(true);
          setQIdx(BASE_QUESTIONS.length);
          setTransitioning(false);
          return;
        }

        // Если это 6-й вопрос и ответ «Нет» — сразу к результату
        if (qIdx === BASE_QUESTIONS.length - 1 && !answer) {
          setPhase("result");
          setTransitioning(false);
          return;
        }

        // Если это последний вопрос (из доп. или базовых) — к результату
        if (qIdx >= allQuestions.length - 1) {
          setPhase("result");
          setTransitioning(false);
          return;
        }

        // Иначе — следующий вопрос
        setQIdx((i) => i + 1);
        setTransitioning(false);
      }, 400);
    },
    [answers, qIdx, transitioning, allQuestions.length],
  );

  if (phase === "done" || typeof document === "undefined") return null;

  // Результат: последние 3 ответа все «Да»?
  const lastThree = answers.slice(-3);
  const qualifies = lastThree.length === 3 && lastThree.every((a) => a === true);
  const resultText = qualifies
    ? "Уфф... Я люблю когда меня шлёпают..."
    : "Ну ты и бесчеловечный!";

  return createPortal(
    <div
      className="fixed inset-0 z-[9950] flex items-center justify-center p-4 select-none"
      style={{
        background: "rgba(10, 0, 20, 0.97)",
        backdropFilter: "blur(6px)",
      }}
    >
      {/* scan-line overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(167,139,250,0.04) 0, rgba(167,139,250,0.04) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {phase === "questions" && (
        <div
          className="relative w-full max-w-lg text-center fade-in"
          key={qIdx}
          style={{ animation: "kaliQuestionIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        >
          {/* Сигил */}
          <div className="text-5xl glow-violet pulse-slow mb-6">🔮</div>

          {/* Имя */}
          <div className="text-[10px] text-dim tracking-widest mb-2">
            {"// КАЛИ ГОВОРИТ //"}
          </div>

          {/* Вопрос */}
          <p
            className="font-medieval text-xl sm:text-2xl glow-violet leading-relaxed mb-8 tracking-wider"
            style={{
              textShadow:
                "0 0 12px rgba(167, 139, 250, 0.6), 0 0 24px rgba(167, 139, 250, 0.3), 2px 0 rgba(255,36,36,0.2), -2px 0 rgba(63,214,200,0.2)",
            }}
          >
            {allQuestions[qIdx]}
          </p>

          {/* Индикатор прогресса (динамический: 6 или 8 точек) */}
          <div className="flex justify-center gap-2 mb-8">
            {allQuestions.map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  background:
                    i < answers.length
                      ? "var(--violet)"
                      : i === qIdx
                        ? "rgba(167, 139, 250, 0.5)"
                        : "var(--line-bright)",
                  boxShadow: i < answers.length ? "0 0 6px rgba(167, 139, 250, 0.6)" : "none",
                }}
              />
            ))}
          </div>

          {/* Кнопки */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => handleAnswer(false)}
              disabled={transitioning}
              className="btn-crt clip-hud-sm px-8 py-3 text-sm tracking-wider"
              style={{
                borderColor: "var(--red-dim)",
                color: "var(--red)",
              }}
            >
              ✕ НЕТ
            </button>
            <button
              onClick={() => handleAnswer(true)}
              disabled={transitioning}
              className="btn-crt clip-hud-sm px-8 py-3 text-sm tracking-wider"
              style={{
                borderColor: "rgba(167, 139, 250, 0.5)",
                color: "var(--violet)",
              }}
            >
              ✓ ДА
            </button>
          </div>

          {/* Подсказка — нельзя закрыть */}
          <div className="text-[9px] text-dim mt-6 tracking-widest">
            {"// закрыть нельзя · ESC отключён //"}
          </div>
        </div>
      )}

      {phase === "result" && (
        <div
          className="relative w-full max-w-lg text-center fade-in"
          style={{ animation: "kaliResultIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        >
          <div className="text-5xl glow-violet pulse-slow mb-6">
            {qualifies ? "💜" : "💔"}
          </div>

          <p
            className="font-medieval text-2xl sm:text-3xl glow-violet leading-relaxed mb-4 tracking-wider"
            style={{
              textShadow:
                "0 0 16px rgba(167, 139, 250, 0.8), 0 0 32px rgba(167, 139, 250, 0.4)",
            }}
          >
            {resultText}
          </p>

          {/* Прогресс-бар 5 секунд */}
          <div className="w-full max-w-xs mx-auto mt-6">
            <div className="panel-inset h-1.5 overflow-hidden">
              <div
                className="h-full"
                style={{
                  background: "linear-gradient(90deg, var(--violet), rgba(167,139,250,0.3))",
                  animation: "kaliProgress 5s linear forwards",
                }}
              />
            </div>
          </div>

          <div className="text-[9px] text-dim mt-4 tracking-widest">
            {"// досье откроется через 5 секунд //"}
          </div>
        </div>
      )}

      <style>{`
        @keyframes kaliQuestionIn {
          0% { opacity: 0; transform: translateY(15px) scale(0.95); filter: blur(8px); }
          60% { filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes kaliResultIn {
          0% { opacity: 0; transform: scale(0.7); filter: blur(20px); }
          60% { filter: blur(0); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes kaliProgress {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
