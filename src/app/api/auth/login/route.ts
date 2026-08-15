import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/auth/login
// Body: { login: string, password: string }
// 200 → { ok: true, user: { login, displayName, system } }
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
    },
  })
}
