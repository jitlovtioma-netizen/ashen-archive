import type { Metadata } from "next";
import { Share_Tech_Mono, VT323, MedievalSharp } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
    <html lang="ru" suppressHydrationWarning className="dark">
      <body
        className={`${shareTechMono.variable} ${vt323.variable} ${medieval.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
