"use client";

import { useEffect } from "react";

// Снятие бана: комбинация U N B A N (подряд, без модификаторов)
// Работает на экране логина, когда аккаунт забанен.
export function UnbanHandler() {
  useEffect(() => {
    const SEQUENCE = ["u", "n", "b", "a", "n"];
    let seq: string[] = [];

    const onKey = (e: KeyboardEvent) => {
      // Только буквы, без модификаторов
      if (e.ctrlKey || e.altKey || e.metaKey) {
        seq = [];
        return;
      }
      const k = e.key.toLowerCase();
      if (!/^[a-z]$/.test(k)) {
        seq = [];
        return;
      }
      seq.push(k);
      if (seq.length > SEQUENCE.length) seq.shift();

      if (seq.join("") === SEQUENCE.join("")) {
        seq = [];
        // Удаляем ВСЕ баны из localStorage
        if (typeof window !== "undefined") {
          const keys = Object.keys(window.localStorage);
          let removed = 0;
          keys.forEach((key) => {
            if (key.startsWith("ashen-banned-")) {
              window.localStorage.removeItem(key);
              removed++;
            }
          });
          if (removed > 0) {
            // Перезагружаем страницу, чтобы форма логина обновилась
            window.location.reload();
          }
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
