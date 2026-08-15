import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/factions?system=DND|PF2E
// Возвращает массив фракций с вложенными `npcs` (Character[] где kind="NPC").
// Сортировка: factions по sortOrder asc, npcs по name asc.
// По умолчанию system=DND. Невалидный system → 400.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawSystem = (searchParams.get('system') ?? 'DND').toUpperCase()

  const VALID = ['DND', 'PF2E'] as const
  type System = (typeof VALID)[number]

  if (!VALID.includes(rawSystem as System)) {
    return NextResponse.json(
      {
        error: 'INVALID_SYSTEM',
        message: `Параметр system должен быть одним из: ${VALID.join(', ')}`,
        received: rawSystem,
      },
      { status: 400 },
    )
  }

  const system = rawSystem as System

  const factions = await db.faction.findMany({
    where: { system },
    orderBy: { sortOrder: 'asc' },
    include: {
      npcs: {
        where: { kind: 'NPC' },
        orderBy: { name: 'asc' },
      },
    },
  })

  return NextResponse.json(factions)
}
