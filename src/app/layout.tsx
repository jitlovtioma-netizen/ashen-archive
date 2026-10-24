import type { Metadata, Viewport } from "next";
import {
  Share_Tech_Mono,
  VT323,
  MedievalSharp,
  IBM_Plex_Mono,
  Ruslan_Display,
  Cormorant_Garamond,
  Cormorant_SC,
  Marck_Script,
} from "next/font/google";
import "./globals.css";
import "./world-dnd.css";
import { Toaster } from "@/components/ui/toaster";

// цвет панели браузера на телефонах — в тон CRT-фону
export const viewport: Viewport = {
  themeColor: "#050805",
  colorScheme: "dark",
};

const shareTechMono = Share_Tech_Mono({
  variable: "--font-mono",
  // Share Tech Mono поддерживает только latin.
  // Кириллица отрисуется системным моноширинным шрифтом (выглядит аутентично для CRT).
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const vt323 = VT323({
  variable: "--font-vt323",
  // VT323 не поддерживает кириллицу — только latin/latin-ext/vietnamese.
  // Кириллический текст отрисуется системным CRT-like шрифтом.
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});

const medieval = MedievalSharp({
  variable: "--font-medieval",
  // MedievalSharp не поддерживает кириллицу — используем latin-ext для расширенной латиницы.
  // Кириллический текст будет отрисован системным fallback-шрифтом.
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});

// ── Кириллица ─────────────────────────────────────────────────────────────
// Шрифты выше не умеют кириллицу: раньше русский текст падал в случайный
// системный шрифт. Эти идут в стеке вторыми и рисуют только кириллицу.
const plexMono = IBM_Plex_Mono({
  variable: "--font-mono-cyr",
  subsets: ["cyrillic"],
  weight: ["400", "600"],
  display: "swap",
});

const ruslan = Ruslan_Display({
  variable: "--font-medieval-cyr",
  subsets: ["cyrillic"],
  weight: "400",
  display: "swap",
});

// ── Хроника Эларии (мир D&D) ──────────────────────────────────────────────
// Грузятся только когда реально используются (preload: false).
const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

const cormorantSC = Cormorant_SC({
  variable: "--font-serif-sc",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700"],
  display: "swap",
  preload: false,
});

const marck = Marck_Script({
  variable: "--font-hand",
  subsets: ["latin", "cyrillic"],
  weight: "400",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "АРХИВ ПЕПЕЛЬНОЙ ДЛАНИ // Библиотека Угасающего Света",
  description:
    "Тёмно-фэнтезийный архив лора авантюрной компании Ордена Пепельной Длани. D&D 5e и Pathfinder 2e. Герои, лор, бестиарий, хроники партий.",
  keywords: [
    "D&D",
    "Pathfinder 2e",
    "PF2e",
    "лор",
    "архив",
    "Пепельная Длань",
    "тёмное фэнтези",
    "настольные ролевые игры",
  ],
  authors: [{ name: "Орден Пепельной Длани" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      // переменные шрифтов — на <html>, чтобы стеки --ff-* (объявлены там же) их видели
      className={[
        "dark",
        shareTechMono.variable,
        vt323.variable,
        medieval.variable,
        plexMono.variable,
        ruslan.variable,
        cormorant.variable,
        cormorantSC.variable,
        marck.variable,
      ].join(" ")}
    >
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
