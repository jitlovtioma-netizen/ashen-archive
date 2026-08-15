"use client";

export function CRTOverlays() {
  return (
    <>
      <div className="crt-overlay crt-scanlines" aria-hidden />
      <div className="crt-overlay crt-vignette" aria-hidden />
      <div className="crt-overlay crt-noise" aria-hidden />
      <div className="crt-overlay crt-flicker" aria-hidden />
    </>
  );
}
