import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { verifySeedToken } from '@/lib/seed-token'

export const dynamic = 'force-dynamic'

const execFileAsync = promisify(execFile)

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/seed?t=<token> — скачивание seed.zip (архив проекта для
// развёртывания вручную: исходники + база + доки + worklog).
//
// Ссылку выдаёт /api/admin/make-seed?issue=1 (только админам): токен
// подписан HMAC-ом и живёт 15 минут. Здесь проверяем подпись, срок и что
// владелец всё ещё админ — затем отдаём файл аттачментом.
//
// Почему так: архив содержит БД с паролями → держать его в public/
// нельзя; а с v5.7.1 и невозможно — dev-вотчер Next.js стирает большие
// файлы из public/ («фантом», 4+ инцидента). Файл лежит в
// seed-archive/seed.zip вне раздачи статики.
//
// Гонка fs: сразу после пересборки прямой readFileSync в рантайме Next
// иногда не видит свежий файл (состояние fs инвалидируется событием
// удаления) — потому чтение дублируется через дочерний процесс.
// ─────────────────────────────────────────────────────────────────────────────

function zipResponse(data: Buffer | Uint8Array, size: number) {
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(size),
      'Content-Disposition': 'attachment; filename="seed.zip"',
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get('t')
  if (!t) {
    return NextResponse.json(
      { ok: false, error: 'NO_TOKEN', hint: 'ссылку на архив выдаёт Мастерская (кнопка «⇩ АРХИВ»)' },
      { status: 400 },
    )
  }

  const login = verifySeedToken(t)
  if (!login) {
    return NextResponse.json(
      { ok: false, error: 'BAD_TOKEN', hint: 'ссылка просрочена — запросите новую в Мастерской' },
      { status: 403 },
    )
  }

  // токен валиден, но права могли отозвать за 15 минут
  const admin = await db.user.findUnique({ where: { login } })
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }

  const seedPath = join(process.cwd(), 'seed-archive', 'seed.zip')

  // 1) быстрый путь: прямой fs
  try {
    const data = readFileSync(seedPath)
    return zipResponse(data, data.length)
  } catch {
    /* падаем в резервный путь */
  }

  // 2) резерв: чтение дочерним процессом — обходит возможный устаревший
  //    fs-кэш рантайма Next сразу после пересборки архива
  try {
    const { stdout } = await execFileAsync('cat', [seedPath], {
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'buffer',
      timeout: 30_000,
    })
    if (stdout && stdout.length > 0) {
      return zipResponse(stdout, stdout.length)
    }
  } catch {
    /* файла нет даже по ту сторону кэша */
  }

  return NextResponse.json(
    { ok: false, error: 'NO_ARCHIVE', hint: 'архив потерян — пересоберите его кнопкой «⟳» в Мастерской' },
    { status: 404 },
  )
}
