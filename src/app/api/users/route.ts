import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dbHint } from '@/lib/db-diagnostics'

export const dynamic = 'force-dynamic'

function parseArr(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map(String).slice(0, 500) : []
  } catch {
    return []
  }
}

// GET /api/users
// Все стражи архива + сводка их прогресса (для меню «Профиль»).
// Пароли не отдаём. Онлайн-статус клиент сливает с presence-сокетом.
export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      include: { progress: true },
    })

    return NextResponse.json({
      users: users.map((u) => {
        // сводка по миру «домашней» системы пользователя
        const p = u.progress.find((x) => x.system === u.system)
        return {
          login: u.login,
          displayName: u.displayName,
          system: u.system === 'PF2E' ? 'PF2E' : 'DND',
          role: u.role === 'ADMIN' ? 'ADMIN' : 'USER',
          characterId: u.characterId ?? null,
          createdAt: u.createdAt,
          summary: p
            ? {
                achievements: parseArr(p.achievements).length,
                shards: parseArr(p.shards).length,
                unlockedIds: parseArr(p.unlockedIds).length,
                solvedRiddles: parseArr(p.solvedRiddles).length,
                revealedSecrets: parseArr(p.revealedSecrets).length,
                konamiUnlocked: p.konamiUnlocked,
                gaze: p.gaze,
                updatedAt: p.updatedAt,
              }
            : null,
        }
      }),
    })
  } catch (e) {
    // Диагностика проблем деплоя вместо безликого 500 (см. db-diagnostics.ts)
    console.error('[api/users] DB error:', e)
    return NextResponse.json(
      { error: 'DB_UNAVAILABLE', hint: dbHint(e) },
      { status: 503 },
    )
  }
}
