import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dbHint } from '@/lib/db-diagnostics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawType = (searchParams.get('type') ?? 'characters').toLowerCase()
  const rawSystem = (searchParams.get('system') ?? 'DND').toUpperCase()

  const VALID_TYPES = ['characters', 'lore', 'locations'] as const
  type ArchiveType = (typeof VALID_TYPES)[number]

  const VALID_SYSTEMS = ['DND', 'PF2E'] as const
  type System = (typeof VALID_SYSTEMS)[number]

  if (!VALID_TYPES.includes(rawType as ArchiveType)) {
    return NextResponse.json(
      { error: 'INVALID_TYPE', message: `type: ${VALID_TYPES.join(', ')}`, received: rawType },
      { status: 400 },
    )
  }

  if (!VALID_SYSTEMS.includes(rawSystem as System)) {
    return NextResponse.json(
      { error: 'INVALID_SYSTEM', message: `system: ${VALID_SYSTEMS.join(', ')}`, received: rawSystem },
      { status: 400 },
    )
  }

  const type = rawType as ArchiveType
  const system = rawSystem as System

  try {
    switch (type) {
      case 'characters': {
        const rows = await db.character.findMany({
          where: { system, kind: 'HERO' },
          orderBy: { name: 'asc' },
        })
        return NextResponse.json(rows)
      }
      case 'lore': {
        const rows = await db.lore.findMany({
          where: { system },
          orderBy: { title: 'asc' },
        })
        return NextResponse.json(rows)
      }
      case 'locations': {
        const rows = await db.location.findMany({
          where: { system },
          orderBy: { name: 'asc' },
        })
        return NextResponse.json(rows)
      }
    }
  } catch (e) {
    // Диагностика проблем деплоя (Vercel+Supabase): подсказка видна
    // в ответе API и в логах, вместо безликого 500.
    console.error('[api/archive] DB error:', e)
    return NextResponse.json(
      { error: 'DB_UNAVAILABLE', hint: dbHint(e) },
      { status: 503 },
    )
  }
}
