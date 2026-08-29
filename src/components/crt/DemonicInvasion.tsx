"use client";

import { useEffect } from "react";
import { useArchive } from "@/lib/store";

/**
 * DemonicInvasion — переключает интерфейс в демонический красный режим.
 * 
 * Только для DND (Элария) — при входе в DND мир добавляет body.demonic-theme.
 * При переключении на PF2E — убирает класс.
 */
export function DemonicInvasion() {
  const user = useArchive((s) => s.user);
  const booted = useArchive((s) => s.booted);

  useEffect(() => {
    const body = document.body;

    if (user?.system === "DND") {
      body.classList.add("demonic-theme");
      if (!booted) {
        body.classList.add("demonic-boot");
      } else {
        body.classList.remove("demonic-boot");
      }
    } else {
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
