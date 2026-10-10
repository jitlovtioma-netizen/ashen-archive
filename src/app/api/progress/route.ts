import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function parseArr(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

function clampArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(String).filter((s) => s.length > 0).slice(0, 500)
}

// GET /api/progress?login=X&requester=Y&system=DND
// Свой прогресс — всегда; чужой — только если requester имеет роль ADMIN.
export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams
  const login = sp.get('login')?.trim() ?? ''
  const requester = sp.get('requester')?.trim() ?? ''
  const system = (sp.get('system') ?? 'DND').toUpperCase() === 'PF2E' ? 'PF2E' : 'DND'

  if (!login) {
    return NextResponse.json({ ok: false, error: 'NO_LOGIN' }, { status: 400 })
  }

  // Проверка прав: сам пользователь или админ
  if (login !== requester) {
    const req = await db.user.findUnique({ where: { login: requester } })
    if (!req || req.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
    }
  }

  const user = await db.user.findUnique({ where: { login } })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNKNOWN_USER' }, { status: 404 })
  }

  const p = await db.progress.findUnique({
    where: { userId_system: { userId: user.id, system } },
  })

  return NextResponse.json({
    ok: true,
    login,
    system,
    progress: p
      ? {
          achievements: parseArr(p.achievements),
          shards: parseArr(p.shards),
          unlockedIds: parseArr(p.unlockedIds),
          revealedSecrets: parseArr(p.revealedSecrets),
          solvedRiddles: parseArr(p.solvedRiddles),
          konamiUnlocked: p.konamiUnlocked,
          secretRevealed: p.secretRevealed,
          gaze: p.gaze,
          updatedAt: p.updatedAt,
        }
      : null,
  })
}

// DELETE /api/progress?login=X&requester=Y&system=Z
// Полный сброс прогресса до нуля. Свой прогресс — всегда; чужой — только админ.
export async function DELETE(request: NextRequest) {
  const sp = new URL(request.url).searchParams
  const login = sp.get('login')?.trim() ?? ''
  const requester = sp.get('requester')?.trim() ?? ''
  const system = (sp.get('system') ?? 'DND').toUpperCase() === 'PF2E' ? 'PF2E' : 'DND'

  if (!login) {
    return NextResponse.json({ ok: false, error: 'NO_LOGIN' }, { status: 400 })
  }

  // Проверка прав: сам пользователь или админ
  if (login !== requester) {
    const req = await db.user.findUnique({ where: { login: requester } })
    if (!req || req.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
    }
  }

  const user = await db.user.findUnique({ where: { login } })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNKNOWN_USER' }, { status: 404 })
  }

  // Удаляем строку прогресса целиком — GET начнёт возвращать null (чистый лист)
  await db.progress.deleteMany({
    where: { userId: user.id, system },
  })

  return NextResponse.json({ ok: true, login, system })
}

// POST /api/progress
// Body: { login, system, achievements[], shards[], unlockedIds[],
//         revealedSecrets[], solvedRiddles[], konamiUnlocked, secretRevealed, gaze }
// Сохраняет (upsert) прогресс стража для указанного мира.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 })
  }

  const login = typeof body.login === 'string' ? body.login.trim() : ''
  const system = String(body.system ?? '').toUpperCase() === 'PF2E' ? 'PF2E' : 'DND'

  if (!login) {
    return NextResponse.json({ ok: false, error: 'NO_LOGIN' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { login } })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNKNOWN_USER' }, { status: 404 })
  }

  const gazeRaw = typeof body.gaze === 'number' ? body.gaze : 7
  const gaze = Math.max(0, Math.min(100, Math.round(gazeRaw)))

  const data = {
    achievements: JSON.stringify(clampArr(body.achievements)),
    shards: JSON.stringify(clampArr(body.shards)),
    unlockedIds: JSON.stringify(clampArr(body.unlockedIds)),
    revealedSecrets: JSON.stringify(clampArr(body.revealedSecrets)),
    solvedRiddles: JSON.stringify(clampArr(body.solvedRiddles)),
    konamiUnlocked: body.konamiUnlocked === true,
    secretRevealed: body.secretRevealed === true,
    gaze,
  }

  await db.progress.upsert({
    where: { userId_system: { userId: user.id, system } },
    create: { userId: user.id, system, ...data },
    update: data,
  })

  return NextResponse.json({ ok: true })
}
