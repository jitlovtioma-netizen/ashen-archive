import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, publicUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/auth/me — текущий пользователь по cookie сессии (без пароля).
// 401 → сессии нет/истекла: клиент должен выйти и попросить войти заново.
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, user: publicUser(user) })
}
