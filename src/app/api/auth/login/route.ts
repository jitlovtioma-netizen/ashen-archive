import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dbHint } from '@/lib/db-diagnostics'

export const dynamic = 'force-dynamic'

// POST /api/auth/login
// Body: { login: string, password: string }
// 200 → { ok: true, user: { login, displayName, system, role, characterId } }
// 401 → { ok: false, error: 'INVALID_CREDENTIALS' }
// Пароль в этом sandbox-архиве хранится открыто в SQLite.
export async function POST(request: NextRequest) {
  let body: { login?: unknown; password?: unknown } = {}
  try {
    body = (await request.json()) as { login?: unknown; password?: unknown }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_CREDENTIALS' },
      { status: 401 },
    )
  }

  const login = typeof body.login === 'string' ? body.login.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!login || !password) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_CREDENTIALS' },
      { status: 401 },
    )
  }

  try {
    const user = await db.user.findUnique({ where: { login } })

    if (!user || user.password !== password) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_CREDENTIALS' },
        { status: 401 },
      )
    }

    return NextResponse.json({
      ok: true,
      user: {
        login: user.login,
        displayName: user.displayName,
        system: user.system,
        role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
        characterId: user.characterId ?? null,
      },
    })
  } catch (e) {
    // База недоступна (частая причина — конфигурация Vercel+Supabase):
    // отдаём 503 с подсказкой вместо безликого 500
    console.error('[api/auth/login] DB error:', e)
    return NextResponse.json(
      { ok: false, error: 'DB_UNAVAILABLE', hint: dbHint(e) },
      { status: 503 },
    )
  }
}
