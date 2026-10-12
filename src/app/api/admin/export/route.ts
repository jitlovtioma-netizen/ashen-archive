import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/export?requester=<login> — полный бэкап архива в JSON.
//
// Выгружает ВСЕ таблицы контента (включая ответы загадок и userModified-
// записи) плюс пользователей с привязками досье. Файл скачивается кнопкой
// «⇩ БЭКАП» в Мастерской и позволяет восстановить архив после случайной
// потери (merge-seed защищает от пересева, но не от ручного удаления).
// Доступ: только роль ADMIN.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const requester = searchParams.get('requester') ?? ''

  try {
    const admin = await db.user.findUnique({ where: { login: requester } })
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
    }

    const [characters, lore, locations, factions, riddles, achievements, users] =
      await Promise.all([
        db.character.findMany({ orderBy: { createdAt: 'asc' } }),
        db.lore.findMany({ orderBy: { createdAt: 'asc' } }),
        db.location.findMany({ orderBy: { createdAt: 'asc' } }),
        db.faction.findMany({ orderBy: { createdAt: 'asc' } }),
        db.riddle.findMany({ orderBy: { createdAt: 'asc' } }),
        db.achievement.findMany({ orderBy: { code: 'asc' } }),
        db.user.findMany({
          orderBy: { createdAt: 'asc' },
          select: {
            login: true,
            displayName: true,
            role: true,
            characterId: true,
            lastSeenAt: true,
            createdAt: true,
          },
        }),
      ])

    const dump = {
      _meta: {
        kind: 'ashen-archive-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        counts: {
          characters: characters.length,
          lore: lore.length,
          locations: locations.length,
          factions: factions.length,
          riddles: riddles.length,
          achievements: achievements.length,
          users: users.length,
        },
      },
      characters,
      lore,
      locations,
      factions,
      riddles,
      achievements,
      users,
    }

    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify(dump, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="archive-backup-${stamp}.json"`,
      },
    })
  } catch (e) {
    console.error('[api/admin/export] DB error:', e)
    return NextResponse.json({ ok: false, error: 'DB_UNAVAILABLE' }, { status: 503 })
  }
}
