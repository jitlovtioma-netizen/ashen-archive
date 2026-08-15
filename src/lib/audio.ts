"use client";

// Synthesized CRT audio engine — no audio files.
// Ambient hum + SFX via Web Audio API. Must be started after a user gesture.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientGain: GainNode | null = null;
let ambientNodes: OscillatorNode[] = [];
let noiseSource: AudioBufferSourceNode | null = null;
let started = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function makeNoiseBuffer(c: AudioContext): AudioBuffer {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function startAudio() {
  const c = ensureCtx();
  if (!c || !masterGain || started) return;
  started = true;

  ambientGain = c.createGain();
  ambientGain.gain.value = 0.0;
  ambientGain.connect(masterGain);

  // low drone: two detuned sines
  const o1 = c.createOscillator();
  o1.type = "sine";
  o1.frequency.value = 55;
  const o2 = c.createOscillator();
  o2.type = "sine";
  o2.frequency.value = 82.4;
  const oGain = c.createGain();
  oGain.gain.value = 0.12;
  o1.connect(oGain);
  o2.connect(oGain);
  oGain.connect(ambientGain);
  o1.start();
  o2.start();
  ambientNodes.push(o1, o2);

  // filtered noise bed
  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuffer(c);
  noise.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 400;
  bp.Q.value = 0.7;
  const nGain = c.createGain();
  nGain.gain.value = 0.015;
  noise.connect(bp);
  bp.connect(nGain);
  nGain.connect(ambientGain);
  noise.start();
  noiseSource = noise;

  // slow LFO on ambient gain
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.08;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.04;
  lfo.connect(lfoGain);
  lfoGain.connect(ambientGain.gain);
  lfo.start();
  ambientNodes.push(lfo);

  // fade in ambient
  ambientGain.gain.setValueAtTime(0, c.currentTime);
  ambientGain.gain.linearRampToValueAtTime(0.12, c.currentTime + 2);
}

export function setAmbientEnabled(on: boolean) {
  const c = ensureCtx();
  if (!c || !ambientGain) return;
  ambientGain.gain.cancelScheduledValues(c.currentTime);
  ambientGain.gain.linearRampToValueAtTime(
    on ? 0.12 : 0,
    c.currentTime + 0.3
  );
}

function blip(
  freq: number,
  dur: number,
  type: OscillatorType = "square",
  vol = 0.12
) {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(masterGain);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

function noiseBurst(dur: number, vol = 0.1, freq = 800) {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuffer(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  noise.connect(bp);
  bp.connect(g);
  g.connect(masterGain);
  noise.start();
  noise.stop(c.currentTime + dur + 0.02);
}

export const sfx = {
  blip: () => blip(880, 0.06, "square", 0.08),
  beep: () => blip(1320, 0.08, "square", 0.07),
  select: () => blip(660, 0.05, "square", 0.09),
  hover: () => blip(2200, 0.03, "sine", 0.03),
  glitch: () => {
    noiseBurst(0.15, 0.12, 1200);
    blip(180, 0.12, "sawtooth", 0.05);
  },
  thud: () => blip(70, 0.25, "sine", 0.18),
  unlock: () => {
    // ascending arpeggio
    blip(523, 0.1, "square", 0.1);
    setTimeout(() => blip(659, 0.1, "square", 0.1), 80);
    setTimeout(() => blip(784, 0.12, "square", 0.1), 160);
    setTimeout(() => blip(1047, 0.18, "square", 0.1), 240);
  },
  achievement: () => {
    // success chord
    blip(523, 0.15, "triangle", 0.09);
    blip(659, 0.15, "triangle", 0.09);
    blip(784, 0.25, "triangle", 0.09);
  },
  whisper: () => noiseBurst(0.4, 0.06, 600),
  error: () => {
    blip(200, 0.12, "sawtooth", 0.1);
    setTimeout(() => blip(150, 0.15, "sawtooth", 0.1), 80);
  },
  gaze: () => {
    // ominous low pulse
    blip(45, 0.5, "sine", 0.14);
    noiseBurst(0.3, 0.05, 200);
  },
  boot: () => {
    blip(330, 0.08, "square", 0.08);
    setTimeout(() => blip(440, 0.08, "square", 0.08), 100);
    setTimeout(() => blip(550, 0.12, "square", 0.08), 200);
  },
};
