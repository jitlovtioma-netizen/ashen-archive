"use client";

import { useEffect } from "react";
import { useArchive } from "@/lib/store";

/**
 * DemonicInvasion — переключает интерфейс в демонический красный режим.
 * 
 * Только для DND (Элария) — при входе в DND мир добавляет body.demonic-theme.
 * При переключении на PF2E — убирает класс.
 * 
 * Добавляет:
 * - Красные scanlines
 * - Красный vignette
 * - Усиленный noise
 * - Красный glow вместо зелёного
 * - Лёгкий screen jitter
 * 
 * Также добавляет body.demonic-boot при загрузке (показывается зловещая загрузка).
 */
export function DemonicInvasion() {
  const user = useArchive((s) => s.user);
  const booted = useArchive((s) => s.booted);

  useEffect(() => {
    const body = document.body;

    if (user?.system === "DND") {
      // Демоническая тема для DND
      body.classList.add("demonic-theme");

      // Во время загрузки — дополнительный класс
      if (!booted) {
        body.classList.add("demonic-boot");
      } else {
        body.classList.remove("demonic-boot");
      }
    } else {
      // Для PF2E — убираем
      body.classList.remove("demonic-theme");
      body.classList.remove("demonic-boot");
    }

    return () => {
      body.classList.remove("demonic-theme");
      body.classList.remove("demonic-boot");
    };
  }, [user, booted]);

  return null;
}
