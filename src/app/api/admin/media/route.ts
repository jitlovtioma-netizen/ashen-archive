import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/media
// Список изображений из public/ (heroes, gods, videos) — для подсказок
// в поле «путь к изображению» Мастерской Созидателя.
// Публичные имена файлов — секретом не являются, авторизация не нужна.
// Если файловая система недоступна (serverless) — просто пустой список.
// ─────────────────────────────────────────────────────────────────────────────

const DIRS = ['heroes', 'gods', 'videos', 'uploads']

export async function GET() {
  const images: string[] = []
  try {
    const pub = path.join(process.cwd(), 'public')
    await Promise.all(
      DIRS.map(async (dir) => {
        try {
          const files = await readdir(path.join(pub, dir))
          for (const f of files) {
            if (/\.(png|jpe?g|gif|webp|svg)$/i.test(f)) {
              images.push(`/${dir}/${f}`)
            }
          }
        } catch {
          // папки нет — пропускаем
        }
      }),
    )
  } catch {
    // недоступно — возвращаем пустой список
  }
  return NextResponse.json({ ok: true, images: images.sort() })
}
