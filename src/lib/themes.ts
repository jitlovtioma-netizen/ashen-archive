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
