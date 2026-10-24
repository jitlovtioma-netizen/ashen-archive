"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ЗВУКОВОЙ ДВИЖОК — всё синтезируется Web Audio API, файлов не нужно.
//
//   pf2e (CRT-архив)       — гул трансформатора + шум + «пиканье» терминала.
//   dnd  (Хроника Эларии)  — генеративная фэнтези-музыка: тёплый пэд, арфа
//                            и бас в ре-дорийском ладу под реверберацией;
//                            эффекты — щипки струн, шелест страниц, перо.
//
// Свой трек для Эларии: положи файл в public/music/dnd.mp3 — он заиграет
// по кругу вместо генеративной музыки.
// Запускается только после жеста пользователя (политика автоплея браузеров).
// ─────────────────────────────────────────────────────────────────────────────

export type AudioWorld = "dnd" | "pf2e";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let started = false;
let soundEnabled = true;
let world: AudioWorld = "pf2e";

/** Текущий фоновый слой (гул или музыка) — умеет остановиться. */
let ambient: { stop: () => void } | null = null;

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
    masterGain.gain.value = soundEnabled ? 0.5 : 0;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function makeNoiseBuffer(c: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Реверберация «каменного зала»: затухающий стерео-шум как импульс. */
function getReverb(c: AudioContext): ConvolverNode {
  if (reverb) return reverb;
  const seconds = 4.2;
  const len = Math.floor(c.sampleRate * seconds);
  const imp = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = imp.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
  }
  reverb = c.createConvolver();
  reverb.buffer = imp;
  const wet = c.createGain();
  wet.gain.value = 0.55;
  reverb.connect(wet);
  wet.connect(masterGain!);
  return reverb;
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// ── CRT: гул терминала ───────────────────────────────────────────────────────

function startCrtHum(c: AudioContext): { stop: () => void } {
  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(masterGain!);

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
  oGain.connect(bus);

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
  nGain.connect(bus);

  const lfo = c.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.04;
  lfo.connect(lfoGain);
  lfoGain.connect(bus.gain);

  [o1, o2, noise, lfo].forEach((n) => n.start());
  bus.gain.linearRampToValueAtTime(0.12, c.currentTime + 2);

  return {
    stop() {
      const t = c.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 1.2);
      setTimeout(() => {
        [o1, o2, noise, lfo].forEach((n) => {
          try {
            n.stop();
          } catch {
            /* уже остановлен */
          }
        });
        bus.disconnect();
      }, 1400);
    },
  };
}

// ── Хроника: генеративная музыка ─────────────────────────────────────────────

// Настроения глав «Хроники». У каждой — свой лад и характер арфы.
// Смена настроения применяется на границе следующего аккорда: пэды
// перекрываются, поэтому переход звучит плавно, без обрыва.
type Chord = { bass: number; pad: number[]; harp: number[] };
interface Mood {
  chords: Chord[];
  /** шанс, что арфа промолчит на шаге (больше — реже, просторнее) */
  harpRest: number;
  /** яркость пэда (частота фильтра) */
  padCutoff: number;
  /** шанс «колокольчика» на аккорд */
  bell: number;
}

export type MusicMood =
  | "default"
  | "heroes"
  | "factions"
  | "lore"
  | "gods"
  | "npcs"
  | "places"
  | "secrets";

const MOODS: Record<MusicMood, Mood> = {
  // Ре-дорийский: Dm9 → B♭maj7 → F(add9) → C(add9) — тёплый, чуть печальный
  default: {
    chords: [
      { bass: 38, pad: [50, 57, 64, 65], harp: [62, 65, 69, 72, 74, 76] },
      { bass: 34, pad: [46, 53, 57, 62], harp: [58, 62, 65, 69, 70, 74] },
      { bass: 41, pad: [53, 60, 67, 69], harp: [60, 65, 67, 69, 72, 77] },
      { bass: 36, pad: [48, 55, 62, 64], harp: [60, 62, 64, 67, 72, 74] },
    ],
    harpRest: 0.35,
    padCutoff: 1100,
    bell: 0.4,
  },
  // Герои: та же тема, но арфа живее — дорога зовёт
  heroes: {
    chords: [
      { bass: 38, pad: [50, 57, 62, 65], harp: [62, 65, 69, 74, 76, 77] },
      { bass: 36, pad: [48, 55, 60, 64], harp: [60, 64, 67, 72, 74, 76] },
      { bass: 34, pad: [46, 53, 58, 62], harp: [58, 62, 65, 70, 72, 74] },
      { bass: 33, pad: [45, 52, 57, 61], harp: [57, 61, 64, 69, 73, 76] },
    ],
    harpRest: 0.2,
    padCutoff: 1300,
    bell: 0.3,
  },
  // Державы: соль-минор, тяжёлый бас, торжественно и строго
  factions: {
    chords: [
      { bass: 31, pad: [43, 50, 55, 58], harp: [55, 58, 62, 67, 70] },
      { bass: 39, pad: [51, 55, 58, 63], harp: [58, 63, 67, 70, 75] },
      { bass: 34, pad: [46, 53, 58, 62], harp: [58, 62, 65, 70, 74] },
      { bass: 41, pad: [53, 57, 60, 65], harp: [57, 60, 65, 69, 72] },
    ],
    harpRest: 0.45,
    padCutoff: 900,
    bell: 0.15,
  },
  // Летопись эпох: ля-эолийский, медленно, как старая легенда
  lore: {
    chords: [
      { bass: 33, pad: [45, 52, 57, 60], harp: [57, 60, 64, 69, 72] },
      { bass: 29, pad: [41, 48, 53, 57], harp: [53, 57, 60, 65, 69] },
      { bass: 36, pad: [48, 55, 60, 64], harp: [60, 64, 67, 72, 76] },
      { bass: 31, pad: [43, 50, 55, 59], harp: [55, 59, 62, 67, 71] },
    ],
    harpRest: 0.5,
    padCutoff: 1000,
    bell: 0.35,
  },
  // Боги: фа-лидийский, светло и высоко — много колокольчиков
  gods: {
    chords: [
      { bass: 29, pad: [53, 57, 60, 64], harp: [65, 69, 72, 76, 79, 81] },
      { bass: 31, pad: [55, 59, 62, 65], harp: [67, 71, 74, 77, 79, 83] },
      { bass: 28, pad: [52, 55, 59, 62], harp: [64, 67, 71, 74, 76, 79] },
      { bass: 33, pad: [57, 60, 64, 67], harp: [69, 72, 76, 79, 81, 84] },
    ],
    harpRest: 0.4,
    padCutoff: 1800,
    bell: 0.8,
  },
  // Встреченные: до-мажор, уютно, как вечер в таверне
  npcs: {
    chords: [
      { bass: 36, pad: [48, 55, 60, 64], harp: [60, 64, 67, 72, 76] },
      { bass: 33, pad: [45, 52, 57, 60], harp: [57, 60, 64, 69, 72] },
      { bass: 29, pad: [41, 48, 53, 57], harp: [53, 57, 60, 65, 69] },
      { bass: 31, pad: [43, 50, 55, 59], harp: [55, 59, 62, 67, 71] },
    ],
    harpRest: 0.25,
    padCutoff: 1500,
    bell: 0.25,
  },
  // Места: ми-дорийский, странствие — открытые квинты
  places: {
    chords: [
      { bass: 28, pad: [40, 47, 52, 54], harp: [52, 54, 59, 64, 66, 71] },
      { bass: 33, pad: [45, 52, 57, 61], harp: [57, 61, 64, 69, 73] },
      { bass: 28, pad: [40, 47, 52, 55], harp: [52, 55, 59, 64, 67] },
      { bass: 38, pad: [50, 57, 62, 66], harp: [62, 66, 69, 74, 78] },
    ],
    harpRest: 0.3,
    padCutoff: 1200,
    bell: 0.3,
  },
  // Запечатанное: ре-фригийский, редкие ноты над низким гулом — тревога
  secrets: {
    chords: [
      { bass: 26, pad: [38, 50, 53, 57], harp: [62, 63, 69, 74] },
      { bass: 27, pad: [39, 51, 55, 58], harp: [63, 67, 70, 75] },
      { bass: 26, pad: [38, 50, 53, 56], harp: [62, 65, 68, 74] },
      { bass: 25, pad: [37, 49, 52, 55], harp: [61, 64, 67, 73] },
    ],
    harpRest: 0.7,
    padCutoff: 700,
    bell: 0.1,
  },
};

let mood: MusicMood = "default";

/** Настроение музыки Хроники (по главе). Меняется со следующего аккорда. */
export function setMusicMood(next: MusicMood) {
  mood = next;
}

const CHORD_SEC = 8;
const HARP_STEP = 0.5;

function padNote(c: AudioContext, bus: AudioNode, freq: number, t: number, dur: number, cutoff = 1100) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.022, t + 2.4);
  g.gain.setValueAtTime(0.022, t + dur - 2);
  g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  g.connect(lp);
  lp.connect(bus);
  for (const [type, cents] of [
    ["sine", -5],
    ["triangle", 5],
  ] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = cents;
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 1.6);
  }
}

function pluck(
  c: AudioContext,
  dest: AudioNode,
  freq: number,
  t: number,
  vol = 0.05,
  decay = 2.2,
  pan = 0,
) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  const p = c.createStereoPanner();
  p.pan.value = pan;
  g.connect(p);
  p.connect(dest);
  const o1 = c.createOscillator();
  o1.type = "triangle";
  o1.frequency.value = freq;
  const o2 = c.createOscillator();
  o2.type = "sine";
  o2.frequency.value = freq * 2;
  const g2 = c.createGain();
  g2.gain.value = 0.3;
  o1.connect(g);
  o2.connect(g2);
  g2.connect(g);
  o1.start(t);
  o2.start(t);
  o1.stop(t + decay + 0.05);
  o2.stop(t + decay + 0.05);
}

function startTaleMusic(c: AudioContext): { stop: () => void } {
  const bus = c.createGain();
  bus.gain.value = 0;
  // сухой сигнал + реверберация
  bus.connect(masterGain!);
  bus.connect(getReverb(c));

  let chordIdx = 0;
  let nextAt = c.currentTime + 0.3;
  let harpPos = 0;

  const scheduleChord = (t: number) => {
    const m = MOODS[mood];
    const ch = m.chords[chordIdx % m.chords.length];
    // бас
    const bg = c.createGain();
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(0.06, t + 1.5);
    bg.gain.linearRampToValueAtTime(0, t + CHORD_SEC + 1);
    bg.connect(bus);
    const bo = c.createOscillator();
    bo.type = "sine";
    bo.frequency.value = midi(ch.bass);
    bo.connect(bg);
    bo.start(t);
    bo.stop(t + CHORD_SEC + 1.2);
    // пэд
    ch.pad.forEach((n) => padNote(c, bus, midi(n), t, CHORD_SEC, m.padCutoff));
    // арфа: волна вверх-вниз по аккорду, с паузами, чтобы дышала
    const steps = CHORD_SEC / HARP_STEP;
    for (let i = 0; i < steps; i++) {
      if (Math.random() < m.harpRest) continue;
      const span = ch.harp.length * 2 - 2;
      const k = harpPos++ % span;
      const idx = k < ch.harp.length ? k : span - k;
      const swing = i % 2 ? 0.06 : 0;
      pluck(
        c,
        bus,
        midi(ch.harp[idx]),
        t + i * HARP_STEP + swing,
        0.028 + Math.random() * 0.018,
        2.4,
        Math.sin(i * 0.9) * 0.5,
      );
    }
    // редкий «колокольчик» сверху
    if (Math.random() < m.bell) {
      pluck(c, bus, midi(ch.harp[ch.harp.length - 1] + 12), t + 4 + Math.random() * 2, 0.018, 4, 0.3);
    }
    chordIdx++;
  };

  // планировщик по аудио-часам: таймер раз в секунду, запас 2 секунды
  const tick = () => {
    while (nextAt < c.currentTime + 2) {
      scheduleChord(nextAt);
      nextAt += CHORD_SEC;
    }
  };
  tick();
  const timer = setInterval(tick, 1000);
  bus.gain.linearRampToValueAtTime(0.9, c.currentTime + 4);

  return {
    stop() {
      clearInterval(timer);
      const t = c.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 1.5);
      setTimeout(() => bus.disconnect(), 6000);
    },
  };
}

/** Свой трек public/music/dnd.mp3, если он есть; иначе — генеративная музыка. */
function startTale(c: AudioContext): { stop: () => void } {
  let current: { stop: () => void } | null = null;
  let stopped = false;
  fetch("/music/dnd.mp3", { method: "HEAD" })
    .then((r) => {
      if (stopped) return;
      const type = r.headers.get("content-type") ?? "";
      if (r.ok && type.startsWith("audio")) {
        const el = new Audio("/music/dnd.mp3");
        el.loop = true;
        el.crossOrigin = "anonymous";
        const src = c.createMediaElementSource(el);
        const g = c.createGain();
        g.gain.value = 0;
        src.connect(g);
        g.connect(masterGain!);
        void el.play().catch(() => {});
        g.gain.linearRampToValueAtTime(0.5, c.currentTime + 3);
        current = {
          stop() {
            g.gain.linearRampToValueAtTime(0, c.currentTime + 1.2);
            setTimeout(() => el.pause(), 1300);
          },
        };
      } else {
        current = startTaleMusic(c);
      }
    })
    .catch(() => {
      if (!stopped) current = startTaleMusic(c);
    });
  return {
    stop() {
      stopped = true;
      current?.stop();
    },
  };
}

function startAmbient() {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  ambient?.stop();
  ambient = world === "dnd" ? startTale(c) : startCrtHum(c);
}

// ── Публичное API ────────────────────────────────────────────────────────────

export function startAudio() {
  if (started) return;
  const c = ensureCtx();
  if (!c || !masterGain) return;
  started = true;
  startAmbient();
}

/** Сменить мир: фон плавно меняется (гул ⇄ музыка), эффекты — тоже. */
export function setAudioWorld(next: AudioWorld) {
  if (next === world) return;
  world = next;
  if (started) startAmbient();
}

/** Включить/выключить весь звук (музыку и эффекты). */
export function setSoundEnabled(on: boolean) {
  soundEnabled = on;
  if (!ctx || !masterGain) return;
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(on ? 0.5 : 0, t + 0.3);
}

/** @deprecated старое имя — теперь глушит весь звук, а не только фон */
export const setAmbientEnabled = setSoundEnabled;

// ── Эффекты ──────────────────────────────────────────────────────────────────

function blip(freq: number, dur: number, type: OscillatorType = "square", vol = 0.12) {
  const c = ensureCtx();
  if (!c || !masterGain || !soundEnabled) return;
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

function noiseBurst(dur: number, vol = 0.1, freq = 800, type: BiquadFilterType = "bandpass") {
  const c = ensureCtx();
  if (!c || !masterGain || !soundEnabled) return;
  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuffer(c, Math.max(0.2, dur + 0.1));
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + Math.min(0.08, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  noise.connect(f);
  f.connect(g);
  g.connect(masterGain);
  noise.start();
  noise.stop(c.currentTime + dur + 0.02);
}

/** Щипок струны с реверберацией (эффекты Хроники). */
function string(note: number, vol = 0.07, decay = 1.6, delay = 0) {
  const c = ensureCtx();
  if (!c || !masterGain || !soundEnabled) return;
  const bus = c.createGain();
  bus.gain.value = 1;
  bus.connect(masterGain);
  bus.connect(getReverb(c));
  pluck(c, bus, midi(note), c.currentTime + delay, vol, decay);
  setTimeout(() => bus.disconnect(), (delay + decay + 4.5) * 1000);
}

const crtSfx = {
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
    blip(523, 0.1, "square", 0.1);
    setTimeout(() => blip(659, 0.1, "square", 0.1), 80);
    setTimeout(() => blip(784, 0.12, "square", 0.1), 160);
    setTimeout(() => blip(1047, 0.18, "square", 0.1), 240);
  },
  achievement: () => {
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
    blip(45, 0.5, "sine", 0.14);
    noiseBurst(0.3, 0.05, 200);
  },
  boot: () => {
    blip(330, 0.08, "square", 0.08);
    setTimeout(() => blip(440, 0.08, "square", 0.08), 100);
    setTimeout(() => blip(550, 0.12, "square", 0.08), 200);
  },
  page: () => noiseBurst(0.12, 0.06, 1500),
  quill: () => blip(1320, 0.05, "square", 0.05),
};

const taleSfx: typeof crtSfx = {
  blip: () => string(74, 0.05, 1.2),
  beep: () => string(81, 0.04, 1.1),
  select: () => string(69, 0.06, 1.4),
  hover: () => string(86, 0.012, 0.6),
  // искажение остаётся «чужим» звуком — оно и в хронике не отсюда
  glitch: () => {
    noiseBurst(0.18, 0.08, 900);
    blip(150, 0.14, "sawtooth", 0.03);
  },
  thud: () => string(38, 0.12, 2.2),
  unlock: () => [62, 66, 69, 74].forEach((n, i) => string(n, 0.06, 2, i * 0.09)),
  achievement: () => [62, 69, 74, 78, 81].forEach((n, i) => string(n, 0.055, 2.6, i * 0.07)),
  whisper: () => noiseBurst(0.6, 0.035, 500, "lowpass"),
  error: () => {
    string(50, 0.07, 1);
    string(51, 0.06, 1, 0.08);
  },
  gaze: () => {
    string(26, 0.14, 3);
    noiseBurst(0.5, 0.03, 180, "lowpass");
  },
  boot: () => {
    noiseBurst(0.5, 0.05, 2200, "highpass");
    [50, 57, 62, 65, 69].forEach((n, i) => string(n, 0.05, 3, 0.15 + i * 0.12));
  },
  page: () => noiseBurst(0.38, 0.05, 2600, "highpass"),
  quill: () => noiseBurst(0.09, 0.025, 4200, "highpass"),
};

/** Эффекты текущего мира. Вызов: sfx.select() и т.п. */
export const sfx: typeof crtSfx = Object.fromEntries(
  (Object.keys(crtSfx) as (keyof typeof crtSfx)[]).map((k) => [
    k,
    () => (world === "dnd" ? taleSfx : crtSfx)[k](),
  ]),
) as typeof crtSfx;
