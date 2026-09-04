"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/audio";

interface HopeVideoProps {
  onComplete: () => void;
}

export function HopeVideo({ onComplete }: HopeVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);

    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        setTimeout(onComplete, 10000);
      });
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onComplete]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src="/videos/hope_video.mp4"
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        onEnded={() => {
          sfx.blip();
          onComplete();
        }}
        onError={() => {
          setTimeout(onComplete, 3000);
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
          opacity: 0.4,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
        <span className="text-[10px] text-dim tracking-widest opacity-50">
          {"// ВОСПОМИНАНИЕ... //"}
        </span>
      </div>
    </div>,
    document.body,
  );
}
