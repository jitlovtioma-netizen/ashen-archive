import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { issueSeedToken } from '@/lib/seed-token'

export const dynamic = 'force-dynamic'

const execFileAsync = promisify(execFile)

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/make-seed — жизнь архива проекта seed.zip из Мастерской.
//
//   GET  ?requester=X            → { ok, exists, size } — статус архива
//   GET  ?requester=X&issue=1    → { ok, url, exp } — подписанная ссылка
//                                   на скачивание (живёт 15 минут)
//   POST { requester }           → { ok, size, files } — пересборка архива
//
// Зачем: seed.zip (полный архив проекта: исходники, база, доки — для
// развёртывания вручную) в песочнице фантомно исчезал: dev-вотчер Next.js
// стирал файл из public/ в течение секунды после создания (4+ инцидента
// за v5.5–v5.7). С v5.7.1 архив живёт в seed-archive/ у корня (вне
// public/), раздаётся через /api/seed?t=<токен>, а кнопки в Мастерской
// проверяют/пересобирают его прямо из браузера — без ssh и команд.
//
// Доступ: только роль ADMIN. Файл содержит базу с паролями — потому и
// статус, и ссылка, и пересборка доступны исключительно администратору.
// На Vercel пересборка недоступна (read-only FS) — вернём UNAVAILABLE.
// ─────────────────────────────────────────────────────────────────────────────

const SEED_PATH = () => join(process.cwd(), 'seed-archive', 'seed.zip')

async function requireAdmin(requester: string) {
  if (!requester) return 'NO_LOGIN'
  const admin = await db.user.findUnique({ where: { login: requester } })
  if (!admin || admin.role !== 'ADMIN') return 'FORBIDDEN'
  return null
}

export async function GET(request: NextRequest) {
  const requester = request.nextUrl.searchParams.get('requester')?.trim() ?? ''
  const issue = request.nextUrl.searchParams.get('issue') === '1'

  const denied = await requireAdmin(requester)
  if (denied) {
    return NextResponse.json({ ok: false, error: denied }, { status: denied === 'NO_LOGIN' ? 400 : 403 })
  }

  if (issue) {
    const { url, exp } = issueSeedToken(requester)
    return NextResponse.json({ ok: true, url, exp })
  }

  const p = SEED_PATH()
  if (existsSync(p)) return NextResponse.json({ ok: true, exists: true, size: statSync(p).size })
  // резерв: свежепересобранный архив бывает не виден прямому fs-вызову
  // (гонка состояния fs в dev-рантайме) — перепроверяем дочерним процессом
  try {
    const st = await execFileAsync('stat', ['-c', '%s', p])
    const size = Number(st.stdout.trim())
    if (Number.isFinite(size) && size > 0) return NextResponse.json({ ok: true, exists: true, size })
  } catch {
    /* файла нет */
  }
  return NextResponse.json({ ok: true, exists: false, size: 0 })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 })
  }

  const requester = typeof body.requester === 'string' ? body.requester.trim() : ''
  const denied = await requireAdmin(requester)
  if (denied) {
    return NextResponse.json({ ok: false, error: denied }, { status: denied === 'NO_LOGIN' ? 400 : 403 })
  }

  // scripts/make-seed-zip.mjs от корня проекта; в standalone-сборке его нет
  const cwd = process.cwd()
  const maker = join(cwd, 'scripts', 'make-seed-zip.mjs')
  if (!existsSync(maker)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'UNAVAILABLE',
        hint: 'пересборка архива доступна только в песочнице/локально (на хостинге файла нет)',
      },
      { status: 409 },
    )
  }

  // раннер — тот же, что поднял сервер (bun в dev, node в проде)
  try {
    // До трёх попыток: между созданием архива и проверкой существует гонка
    // с fs-состоянием рантайма Next (Turbopack): после rm+create файл бывает
    // «не виден» прямому existsSync, хотя на диске есть. Потому проверяем
    // двумя способами — прямым fs и через дочерний процесс (обходит кэш).
    let built = false
    let size = 0
    let files: number | null = null
    let lastErr = ''

    for (let attempt = 1; attempt <= 3 && !built; attempt++) {
      const { stdout } = await execFileAsync(process.execPath, [maker], {
        cwd,
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
      })

      const seedPath = SEED_PATH()
      let ok = existsSync(seedPath)
      if (!ok) {
        try {
          const st = await execFileAsync('stat', ['-c', '%s', seedPath])
          const viaChild = Number(st.stdout.trim())
          if (Number.isFinite(viaChild) && viaChild > 0) {
            ok = true
            size = viaChild
          }
        } catch {
          ok = false
        }
      }
      if (ok) {
        built = true
        if (!size) size = statSync(seedPath).size
        // «[seed.zip] готов: seed-archive/seed.zip — 173 файлов, 802 КБ, md5:…»
        const m = /—\s*(\d+)\s*файлов/.exec(stdout ?? '')
        files = m ? Number(m[1]) : null
      } else {
        lastErr = 'архив не появился после сборки'
        await new Promise((r) => setTimeout(r, 600))
      }
    }

    if (!built) {
      return NextResponse.json({ ok: false, error: 'BUILD_FAILED', hint: lastErr }, { status: 500 })
    }

    return NextResponse.json({ ok: true, size, files })
  } catch (e) {
    const err = e as { killed?: boolean }
    return NextResponse.json(
      {
        ok: false,
        error: 'BUILD_FAILED',
        hint: err.killed
          ? 'сборка не уложилась в 2 минуты — попробуйте ещё раз'
          : 'системный zip недоступен (нужен пакет zip) — соберите вручную: bun run make-seed',
      },
      { status: 500 },
    )
  }
}
