"use client";

import { useEffect, useState, useRef } from "react";
import { sfx } from "@/lib/audio";

const MESSAGES = [
  "ПОМОГИТЕ БРУНО!",
  "Спаситель! Спаситель! Спаситель! The Savior!",
  "Стрелять в пещере было умно!",
  "Родители или РШ-12? Конечно же РШ-12",
  "Худший файт днд? Махорага против Громара!",
  "Повелитель? Это вы!",
  "ХОЗЯЙН! Я помурчу тебе!",
  "Убегай! Беги! Спасайся! Он видит тебя!",
];

export function VoiceOfTheMaster() {
  const [message, setMessage] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: "20%", left: "10%" });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageIdx = useRef(-1);

  useEffect(() => {
    const showRandom = () => {
      // Выбираем случайное сообщение, не повторяя предыдущее
      let idx: number;
      do {
        idx = Math.floor(Math.random() * MESSAGES.length);
      } while (idx === lastMessageIdx.current && MESSAGES.length > 1);
      lastMessageIdx.current = idx;

      setMessage(MESSAGES[idx]);

      // Случайная позиция на экране
      const top = 10 + Math.random() * 70;
      const left = 5 + Math.random() * 70;
      setPosition({ top: `${top}%`, left: `${left}%` });

      sfx.whisper();

      // Показываем 3-5 секунд, потом скрываем
      const duration = 3000 + Math.random() * 2000;
      timeoutRef.current = setTimeout(() => {
        setMessage(null);
        // Следующее сообщение через 2-5 минут
        const nextDelay = 120000 + Math.random() * 180000;
        timeoutRef.current = setTimeout(showRandom, nextDelay);
      }, duration);
    };

    // Первое сообщение через 1-3 минуты после входа
    const initialDelay = 60000 + Math.random() * 120000;
    timeoutRef.current = setTimeout(showRandom, initialDelay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      className="fixed z-[9600] pointer-events-none fade-in"
      style={{
        top: position.top,
        left: position.left,
        animation: "glitchSkew 0.3s infinite",
      }}
    >
      <div
        className="px-4 py-2 font-mono-crt text-sm tracking-wider"
        style={{
          background: "rgba(15, 0, 25, 0.9)",
          border: "1px solid rgba(167, 139, 250, 0.5)",
          color: "rgba(167, 139, 250, 0.9)",
          textShadow: "0 0 8px rgba(167, 139, 250, 0.6), 2px 0 rgba(255,36,36,0.3), -2px 0 rgba(63,214,200,0.3)",
          boxShadow: "0 0 20px rgba(167, 139, 250, 0.3)",
          clipPath: "polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px))",
          maxWidth: "400px",
          whiteSpace: "pre-wrap",
        }}
      >
        <span className="text-[9px] text-dim tracking-widest block mb-1">
          {"// ГОЛОС ХОЗЯИНА //"}
        </span>
        {message}
      </div>
    </div>
  );
}
