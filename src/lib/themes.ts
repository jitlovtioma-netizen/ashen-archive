// ============================================================================
// ТЕМЫ ДОСЬЕ — цветовые схемы для персональных досье (как фиолетовое у Кали).
// Цвет задаётся в Мастерской (поле themeColor) и хранится в БД.
// Значение — ключ из DOSSIER_THEMES; null/неизвестный ключ — стандартное досье.
// ============================================================================

export interface DossierTheme {
  key: string;
  /** подпись в Мастерской */
  label: string;
  /** основной акцентный цвет (заголовки, свечение) */
  accent: string;
  /** приглушённый акцент (подписи, рамки) */
  accentDim: string;
  /** фон модалки досье */
  bg: string;
  /** цвет рамки */
  border: string;
  /** box-shadow модалки */
  glow: string;
  /** цвет фона кнопок-акцентов */
  btnBg: string;
}

export const DOSSIER_THEMES: Record<string, DossierTheme> = {
  violet: {
    key: "violet",
    label: "Фиолетовое · проклятое",
    accent: "#a78bfa",
    accentDim: "rgba(167, 139, 250, 0.55)",
    bg: "rgba(15, 0, 25, 0.95)",
    border: "rgba(167, 139, 250, 0.5)",
    glow: "0 0 60px rgba(167, 139, 250, 0.4), 0 0 120px rgba(40, 0, 60, 0.9)",
    btnBg: "rgba(167, 139, 250, 0.08)",
  },
  blue: {
    key: "blue",
    label: "Синее · глубинное",
    accent: "#5b9dff",
    accentDim: "rgba(91, 157, 255, 0.55)",
    bg: "rgba(2, 8, 28, 0.95)",
    border: "rgba(91, 157, 255, 0.5)",
    glow: "0 0 60px rgba(91, 157, 255, 0.35), 0 0 120px rgba(0, 10, 50, 0.9)",
    btnBg: "rgba(91, 157, 255, 0.08)",
  },
  green: {
    key: "green",
    label: "Зелёное · ядовитое",
    accent: "#4af626",
    accentDim: "rgba(74, 246, 38, 0.55)",
    bg: "rgba(2, 18, 8, 0.95)",
    border: "rgba(74, 246, 38, 0.45)",
    glow: "0 0 60px rgba(74, 246, 38, 0.3), 0 0 120px rgba(0, 40, 10, 0.9)",
    btnBg: "rgba(74, 246, 38, 0.07)",
  },
  amber: {
    key: "amber",
    label: "Янтарное · жертвенное",
    accent: "#e8a13a",
    accentDim: "rgba(232, 161, 58, 0.55)",
    bg: "rgba(26, 16, 2, 0.95)",
    border: "rgba(232, 161, 58, 0.5)",
    glow: "0 0 60px rgba(232, 161, 58, 0.35), 0 0 120px rgba(45, 25, 0, 0.9)",
    btnBg: "rgba(232, 161, 58, 0.08)",
  },
  red: {
    key: "red",
    label: "Багровое · кровавое",
    accent: "#ff4040",
    accentDim: "rgba(255, 64, 64, 0.55)",
    bg: "rgba(24, 2, 2, 0.95)",
    border: "rgba(255, 64, 64, 0.5)",
    glow: "0 0 60px rgba(255, 64, 64, 0.35), 0 0 120px rgba(45, 0, 0, 0.9)",
    btnBg: "rgba(255, 64, 64, 0.08)",
  },
  cyan: {
    key: "cyan",
    label: "Голубое · ледяное",
    accent: "#38e8d8",
    accentDim: "rgba(56, 232, 216, 0.55)",
    bg: "rgba(2, 18, 20, 0.95)",
    border: "rgba(56, 232, 216, 0.5)",
    glow: "0 0 60px rgba(56, 232, 216, 0.35), 0 0 120px rgba(0, 35, 40, 0.9)",
    btnBg: "rgba(56, 232, 216, 0.08)",
  },
  pink: {
    key: "pink",
    label: "Розовое · фантомное",
    accent: "#ff69b4",
    accentDim: "rgba(255, 105, 180, 0.55)",
    bg: "rgba(26, 4, 16, 0.95)",
    border: "rgba(255, 105, 180, 0.5)",
    glow: "0 0 60px rgba(255, 105, 180, 0.35), 0 0 120px rgba(50, 0, 30, 0.9)",
    btnBg: "rgba(255, 105, 180, 0.08)",
  },
};

export const DOSSIER_THEME_KEYS = Object.keys(DOSSIER_THEMES);

/** Тема по ключу из БД; null — стандартное оформление. */
export function getDossierTheme(color?: string | null): DossierTheme | null {
  if (!color) return null;
  return DOSSIER_THEMES[color] ?? null;
}

// ============================================================================
// ПАЛИТРЫ ИРИСА — v5.5, Мастерская Созидателя.
// Полное искажение (⟪…⟫) по умолчанию переливается полным спектром
// (бирюза→небо→аметист→роза→золото) и мягко сдвигается под цвет досье
// (v5.4.1). Палитра позволяет закрепить спектр досье НАВСЕГДА: кровавый
// ирис для проклятых, изумрудный для ядовитых, золотой для божественных.
// Ключ хранится в БД (поле irisColor); null/'' — авто.
// ============================================================================

export interface IrisPalette {
  key: string;
  /** подпись в Мастерской */
  label: string;
  /** срез градиента для свотча в UI (CSS background) */
  swatch: string;
  /** 5-стоповый градиент перелива (background для .oblivion-glyphs) */
  gradient: string;
  /** статичный сдвиг оттенка анимации (CSS hue-rotate, deg) */
  hueShift: number;
  /** характер перелива для подписи */
  hint: string;
}

export const IRIS_PALETTES: Record<string, IrisPalette> = {
  spectrum: {
    key: "spectrum",
    label: "Спектр · полный",
    swatch: "linear-gradient(100deg,#9ff5e0,#8fd3ff,#c4a5ff,#ff9fd0,#ffd28f)",
    gradient:
      "linear-gradient(100deg,#9ff5e0 0%,#8fd3ff 16%,#c4a5ff 33%,#ff9fd0 50%,#ffd28f 66%,#9ff5e0 83%,#8fd3ff 100%)",
    hueShift: 0,
    hint: "весь спектр: бирюза → небо → аметист → роза → золото",
  },
  emerald: {
    key: "emerald",
    label: "Изумруд · ядовитый",
    swatch: "linear-gradient(100deg,#7dffb0,#2fe88f,#0fbf6f,#baffd2,#3ddc91)",
    gradient:
      "linear-gradient(100deg,#7dffb0 0%,#2fe88f 16%,#baffd2 33%,#0fbf6f 50%,#59ffa8 66%,#7dffb0 83%,#2fe88f 100%)",
    hueShift: -38,
    hint: "малахит и мята — цвет яда и хвои",
  },
  blood: {
    key: "blood",
    label: "Кровь · проклятый",
    swatch: "linear-gradient(100deg,#ff9d9d,#ff5c5c,#c21f2e,#ffb3a0,#d43a4a)",
    gradient:
      "linear-gradient(100deg,#ff9d9d 0%,#ff5c5c 16%,#ffb3a0 33%,#c21f2e 50%,#ff7d6e 66%,#ff9d9d 83%,#ff5c5c 100%)",
    hueShift: 24,
    hint: "киноварь и рубин — ирис, что помнит боль",
  },
  gold: {
    key: "gold",
    label: "Золото · божественный",
    swatch: "linear-gradient(100deg,#ffe9a0,#ffcf4d,#e8a13a,#fff3c4,#d9931f)",
    gradient:
      "linear-gradient(100deg,#ffe9a0 0%,#ffcf4d 16%,#fff3c4 33%,#e8a13a 50%,#ffd97a 66%,#ffe9a0 83%,#ffcf4d 100%)",
    hueShift: -14,
    hint: "янтарь и латунь — цвет украденного света",
  },
  night: {
    key: "night",
    label: "Ночь · глубинный",
    swatch: "linear-gradient(100deg,#a8c6ff,#5b7fd4,#2c3e8f,#c3d4ff,#4054a8)",
    gradient:
      "linear-gradient(100deg,#a8c6ff 0%,#5b7fd4 16%,#c3d4ff 33%,#2c3e8f 50%,#7d95e8 66%,#a8c6ff 83%,#5b7fd4 100%)",
    hueShift: 18,
    hint: "ультрамарин и сталь — ирис глубин и забвения",
  },
  amethyst: {
    key: "amethyst",
    label: "Аметист · потусторонний",
    swatch: "linear-gradient(100deg,#d9b8ff,#a06ee8,#7b2fd1,#eccbff,#9258d9)",
    gradient:
      "linear-gradient(100deg,#d9b8ff 0%,#a06ee8 16%,#eccbff 33%,#7b2fd1 50%,#b98af2 66%,#d9b8ff 83%,#a06ee8 100%)",
    hueShift: 8,
    hint: "сливовый и гелиотроп — цвет между мирами",
  },
};

export const IRIS_PALETTE_KEYS = Object.keys(IRIS_PALETTES);
