import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dbHint } from '@/lib/db-diagnostics'
import { hashPassword, isHashed, publicUser, setSessionCookie, verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/auth/login
// Body: { login: string, password: string }
// 200 → { ok: true, user } + cookie сессии
// 401 → { ok: false, error: 'INVALID_CREDENTIALS' }
// Старые открытые пароли при первом успешном входе перехешируются (scrypt).
export async function POST(request: NextRequest) {
  const fail = () =>
    NextResponse.json({ ok: false, error: 'INVALID_CREDENTIALS' }, { status: 401 })

  let body: { login?: unknown; password?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    return fail()
  }

  const login = typeof body.login === 'string' ? body.login.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!login || !password || password.length > 200) return fail()

  try {
    const user = await db.user.findUnique({ where: { login } })
    if (!user || !(await verifyPassword(password, user.password))) return fail()

    if (!isHashed(user.password)) {
      await db.user.update({
        where: { id: user.id },
        data: { password: await hashPassword(password) },
      })
    }

    const res = NextResponse.json({ ok: true, user: publicUser(user) })
    setSessionCookie(res, user.login)
    return res
  } catch (e) {
    // База недоступна (частая причина — конфигурация Vercel+Supabase)
    console.error('[api/auth/login] DB error:', e)
    return NextResponse.json(
      { ok: false, error: 'DB_UNAVAILABLE', hint: dbHint(e) },
      { status: 503 },
    )
  }
}
