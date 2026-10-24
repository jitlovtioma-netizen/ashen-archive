// Оптимизация картинок через встроенный оптимизатор Next.js (/_next/image):
// исходные PNG по 1–2 МБ отдаются браузеру как WebP/AVIF нужной ширины.
// Файлы и пути в базе не меняются — меняется только src в <img>.

// Ширины должны входить в images.deviceSizes / imageSizes (next.config.ts).
const WIDTHS = [128, 256, 384, 640, 828, 1080] as const

const OPTIMIZABLE = /\.(png|jpe?g|webp)(\?.*)?$/i

export function optimizedSrc(src: string | null | undefined, displayWidth: number): string {
  if (!src) return ''
  const local = src.startsWith('/') && !src.startsWith('//')
  const supabase = /^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(src)
  if ((!local && !supabase) || !OPTIMIZABLE.test(src)) return src
  // запас под retina-экраны
  const target = displayWidth * 2
  const w = WIDTHS.find((x) => x >= target) ?? WIDTHS[WIDTHS.length - 1]
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`
}
