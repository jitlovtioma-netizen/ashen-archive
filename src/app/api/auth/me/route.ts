import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/auth/me?login=...
// Свежие данные стража (роль, привязка персонажа) — без пароля.
// Используется при восстановлении сессии из localStorage, чтобы
// роль/привязка всегда были актуальны.
export async function GET(request: NextRequest) {
  const login = new URL(request.url).searchParams.get('login')?.trim() ?? ''

  if (!login) {
    return NextResponse.json({ ok: false, error: 'NO_LOGIN' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { login } })

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNKNOWN_USER' }, { status: 404 })
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
}
