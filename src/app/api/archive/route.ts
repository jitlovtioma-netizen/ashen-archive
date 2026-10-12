import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dbHint } from '@/lib/db-diagnostics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawType = (searchParams.get('type') ?? 'characters').toLowerCase()
  const rawSystem = (searchParams.get('system') ?? 'DND').toUpperCase()

  const VALID_TYPES = ['characters', 'lore', 'locations', 'iris'] as const
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
        // порядок задаётся Созидателем (drag-n-drop в Мастерской);
        // равные sortOrder → по алфавиту
        const rows = await db.character.findMany({
          where: { system, kind: 'HERO' },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
        return NextResponse.json(rows)
      }
      case 'lore': {
        const rows = await db.lore.findMany({
          where: { system },
          orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        })
        return NextResponse.json(rows)
      }
      case 'locations': {
        const rows = await db.location.findMany({
          where: { system },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
        return NextResponse.json(rows)
      }
      case 'iris': {
        // v5.5 — реестр досье с полным искажением (⟪…⟫) для ачивки
        // IRIS_COLLECTOR: клиент проверяет, что все id прочитаны.
        // Запечатанные тоже считаются: печать можно вскрыть и прочитать.
        const [chars, lores, locs] = await Promise.all([
          db.character.findMany({
            where: { system, description: { contains: '⟪' } },
            select: { id: true, name: true },
          }),
          db.lore.findMany({
            where: { system, description: { contains: '⟪' } },
            select: { id: true, title: true },
          }),
          db.location.findMany({
            where: { system, description: { contains: '⟪' } },
            select: { id: true, name: true },
          }),
        ])
        const items = [
          ...chars.map((r) => ({ id: r.id, name: r.name, kind: 'character' })),
          ...lores.map((r) => ({ id: r.id, name: r.title, kind: 'lore' })),
          ...locs.map((r) => ({ id: r.id, name: r.name, kind: 'location' })),
        ]
        return NextResponse.json({ system, total: items.length, items })
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
