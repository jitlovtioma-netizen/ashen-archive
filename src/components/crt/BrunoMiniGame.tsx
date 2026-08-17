"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useArchive } from "@/lib/store";
import { sfx } from "@/lib/audio";

interface BrunoMiniGameProps {
  onClose: () => void;
}

interface Question {
  a: number;
  b: number;
  answer: number;
}

function generateQuestion(): Question {
  const a = Math.floor(Math.random() * 15) + 1;
  const b = Math.floor(Math.random() * 15) + 1;
  return { a, b, answer: a + b };
}

export function BrunoMiniGame({ onClose }: BrunoMiniGameProps) {
  const { pushToast, addGaze } = useArchive();
  const [question, setQuestion] = useState<Question>(generateQuestion);
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">("playing");
  const [wrong, setWrong] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const endGame = useCallback((won: boolean) => {
    setGameState(won ? "won" : "lost");
    if (timerRef.current) clearInterval(timerRef.current);
    if (won) {
      sfx.achievement();
      addGaze(-10);
      pushToast({
        kind: "ach",
        sigil: "🧠",
        title: "СПАСИТЕЛЬ БРУНО",
        body: "Вы прошли мини-игру! Бруно благодарит вас.",
      });
    } else {
      sfx.error();
    }
  }, [pushToast, addGaze]);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          endGame(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [endGame]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(input, 10);
    if (isNaN(num)) return;

    if (num === question.answer) {
      setCorrect((c) => {
        const newCorrect = c + 1;
        sfx.beep();
        if (newCorrect >= 5) {
          endGame(true);
        } else {
          setQuestion(generateQuestion());
          setInput("");
        }
        return newCorrect;
      });
    } else {
      setWrong(true);
      sfx.error();
      setTimeout(() => setWrong(false), 500);
    }
    setInput("");
  };

  return (
    <div
      className="fixed inset-0 z-[9800] flex items-center justify-center p-4"
      style={{
        background: "rgba(2, 0, 2, 0.95)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="panel clip-hud brackets w-full max-w-md p-6 fade-in"
        style={{
          boxShadow: "0 0 40px rgba(74, 246, 38, 0.3)",
          animation: "modalIn 0.3s ease-out forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="led led-green" />
          <span className="text-[10px] text-dim tracking-widest ml-2">
            {"// ПОМОЧЬ БРУНО //"}
          </span>
          <span className="flex-1" />
          <button
            onClick={onClose}
            className="btn-crt btn-red clip-hud-sm px-2 py-0.5 text-[11px]"
          >
            ✕
          </button>
        </div>

        {gameState === "playing" && (
          <>
            {/* timer + progress */}
            <div className="flex justify-between items-center mb-4">
              <div className="text-[11px] tracking-widest">
                <span className="text-dim">ВРЕМЯ: </span>
                <span className={timeLeft <= 5 ? "glow-red" : "glow-green"}>
                  {timeLeft}s
                </span>
              </div>
              <div className="text-[11px] tracking-widest">
                <span className="text-dim">ВЕРНО: </span>
                <span className="glow-green">{correct}/5</span>
              </div>
            </div>

            {/* progress bar */}
            <div className="panel-inset h-2 mb-4 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${(correct / 5) * 100}%`,
                  background: "linear-gradient(90deg, var(--green-deep), var(--green))",
                  boxShadow: "0 0 8px rgba(74,246,38,0.5)",
                }}
              />
            </div>

            {/* timer bar */}
            <div className="panel-inset h-1.5 mb-4 overflow-hidden">
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: `${(timeLeft / 20) * 100}%`,
                  background: timeLeft <= 5
                    ? "linear-gradient(90deg, var(--red-dim), var(--red))"
                    : "linear-gradient(90deg, var(--amber-dim), var(--amber))",
                }}
              />
            </div>

            {/* question */}
            <div className="text-center mb-4">
              <div className="text-[10px] text-dim tracking-widest mb-2">
                {"// РЕШИ //"}
              </div>
              <div
                className={`font-vt323 text-4xl ${wrong ? "glow-red glitch" : "glow-green"}`}
                data-text={wrong ? "НЕВЕРНО" : `${question.a} + ${question.b}`}
              >
                {question.a} + {question.b} = ?
              </div>
            </div>

            {/* input */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="number"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
                className={`w-full bg-[var(--bg-deep)] border px-3 py-3 text-center text-2xl text-[var(--green)] focus:outline-none transition-all font-vt323 clip-hud-sm ${
                  wrong
                    ? "border-[var(--red)] shadow-[0_0_10px_rgba(255,36,36,0.4)]"
                    : "border-[var(--line-bright)] focus:border-[var(--green)] focus:shadow-[0_0_10px_rgba(74,246,38,0.3)]"
                }`}
                placeholder="?"
                disabled={gameState !== "playing"}
              />
              <button
                type="submit"
                className="btn-crt clip-hud-sm w-full py-2 text-xs"
              >
                ▸ ОТВЕТИТЬ
              </button>
            </form>

            <div className="text-[9px] text-dim mt-3 text-center tracking-wider">
              {"// 5 правильных ответов за 20 секунд //"}
            </div>
          </>
        )}

        {gameState === "won" && (
          <div className="text-center py-4">
            <div className="text-4xl mb-3 glow-green pulse-slow">🧠</div>
            <div className="font-medieval text-xl glow-green mb-2 tracking-wider">
              БРУНО СПАСЁН
            </div>
            <div className="text-dim text-sm mb-4">
              {"// вы решили 5 задач за " + (20 - timeLeft) + " секунд //"}
            </div>
            <div className="text-[11px] text-dim mb-4">
              {"// взгляд созидателя ослаблен на 10% //"}
            </div>
            <button
              onClick={onClose}
              className="btn-crt clip-hud-sm px-4 py-2 text-xs"
            >
              ◂ ЗАКРЫТЬ
            </button>
          </div>
        )}

        {gameState === "lost" && (
          <div className="text-center py-4">
            <div className="text-4xl mb-3 glow-red pulse-slow">💀</div>
            <div className="font-medieval text-xl glow-red mb-2 tracking-wider">
              ВРЕМЯ ВЫШЛО
            </div>
            <div className="text-dim text-sm mb-4">
              {`// вы решили ${correct} из 5 //`}
            </div>
            <button
              onClick={() => {
                setCorrect(0);
                setTimeLeft(20);
                setGameState("playing");
                setQuestion(generateQuestion());
                setInput("");
              }}
              className="btn-crt clip-hud-sm px-4 py-2 text-xs mr-2"
            >
              ↻ ЕЩЁ РАЗ
            </button>
            <button
              onClick={onClose}
              className="btn-crt btn-red clip-hud-sm px-4 py-2 text-xs"
            >
              ✕ ЗАКРЫТЬ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
