import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ============================================================================
// /api/presence — онлайн без внешних сервисов. Клиент отмечается POST'ом
// (только за себя — проверяется сессия); GET отдаёт «был в сети» (карта
// login → epoch за 30 дней) и список тех, кто в сети прямо сейчас.
// ============================================================================

// Страж считается «в сети», если отмечался не дольше этого времени назад
// (клиент в режиме опроса отмечается раз в 30 секунд).
const ONLINE_WINDOW_MS = 90_000

// GET /api/presence →
//   { ok, lastSeen: { [login]: epoch }, online: [{ login, displayName, system, role }] }
// online — для режима «опрос сервера» (без Supabase Realtime и без socket.io).
export async function GET() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const users = await db.user.findMany({
      where: { lastSeenAt: { gte: since } },
      select: { login: true, displayName: true, system: true, role: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    })
    const lastSeen: Record<string, number> = {}
    const online: { login: string; displayName: string; system: string; role: string }[] = []
    const onlineAfter = Date.now() - ONLINE_WINDOW_MS
    for (const u of users) {
      if (!u.lastSeenAt) continue
      lastSeen[u.login] = u.lastSeenAt.getTime()
      if (u.lastSeenAt.getTime() >= onlineAfter) {
        online.push({
          login: u.login,
          displayName: u.displayName,
          system: u.system === 'PF2E' ? 'PF2E' : 'DND',
          role: u.role === 'ADMIN' ? 'ADMIN' : 'USER',
        })
      }
    }
    return NextResponse.json({ ok: true, lastSeen, online })
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
