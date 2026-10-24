import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ============================================================================
// /api/presence — «был в сети» для бесплатного режима онлайна (Supabase
// Realtime). Клиент раз в минуту отмечается POST'ом; GET возвращает карту
// login → epoch последнего визита (за последние 30 дней, не больше 100).
// Модель безопасности — как у остальных роутов архива: логин доверенный,
// это архив дружеской партии, а не банк.
// ============================================================================

// GET /api/presence → { ok: true, lastSeen: { [login]: number } }
export async function GET() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const users = await db.user.findMany({
      where: { lastSeenAt: { gte: since } },
      select: { login: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    })
    const lastSeen: Record<string, number> = {}
    for (const u of users) {
      if (u.lastSeenAt) lastSeen[u.login] = u.lastSeenAt.getTime()
    }
    return NextResponse.json({ ok: true, lastSeen })
  } catch (e) {
    console.error('[api/presence] GET error:', e)
    return NextResponse.json(
      { ok: false, error: 'DB_UNAVAILABLE' },
      { status: 503 },
    )
  }
}

// POST /api/presence { login } → отмечает стража онлайн (lastSeenAt = сейчас)
export async function POST(request: NextRequest) {
  let body: { login?: unknown } = {}
  try {
    body = (await request.json()) as { login?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 })
  }

  const login = typeof body.login === 'string' ? body.login.trim() : ''
  if (!login) {
    return NextResponse.json({ ok: false, error: 'NO_LOGIN' }, { status: 400 })
  }
  // отмечать онлайн можно только себя
  const me = await getSessionUser(request)
  if (!me || me.login !== login) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const user = await db.user.findUnique({
      where: { login },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'UNKNOWN_USER' },
        { status: 404 },
      )
    }
    await db.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/presence] POST error:', e)
    return NextResponse.json(
      { ok: false, error: 'DB_UNAVAILABLE' },
      { status: 503 },
    )
  }
}
