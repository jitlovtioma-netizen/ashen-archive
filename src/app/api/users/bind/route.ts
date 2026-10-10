import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/users/bind
// Body: { requester, login, characterId | null }
// Привязка персонажа к аккаунту стража. Только ADMIN (проверка по БД).
// characterId === null → отвязать.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 })
  }

  const requester = typeof body.requester === 'string' ? body.requester.trim() : ''
  const login = typeof body.login === 'string' ? body.login.trim() : ''
  const characterId =
    typeof body.characterId === 'string' && body.characterId.length > 0
      ? body.characterId
      : null

  if (!requester || !login) {
    return NextResponse.json({ ok: false, error: 'NO_LOGIN' }, { status: 400 })
  }

  // Права: только админ
  const admin = await db.user.findUnique({ where: { login: requester } })
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }

  const user = await db.user.findUnique({ where: { login } })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNKNOWN_USER' }, { status: 404 })
  }

  // Валидация персонажа: существует и из того же мира, что и страж
  if (characterId) {
    const character = await db.character.findUnique({ where: { id: characterId } })
    if (!character) {
      return NextResponse.json({ ok: false, error: 'UNKNOWN_CHARACTER' }, { status: 404 })
    }
    if (character.system !== user.system) {
      return NextResponse.json({ ok: false, error: 'SYSTEM_MISMATCH' }, { status: 400 })
    }
  }

  const updated = await db.user.update({
    where: { login },
    data: { characterId },
  })

  return NextResponse.json({
    ok: true,
    user: {
      login: updated.login,
      displayName: updated.displayName,
      system: updated.system,
      role: updated.role === 'ADMIN' ? 'ADMIN' : 'USER',
      characterId: updated.characterId ?? null,
    },
  })
}
