import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/stats?system=DND|PF2E
// Возвращает агрегированную статистику для статус-бара:
// { totalRecords, sealedRecords, corruptedRecords, gazeBase, breakdown }
// breakdown: { characters (kind=HERO only), lore, locations, chronicles, factions }
// Все фильтры по `system`. gazeBase=7 фиксированный. По умолчанию system=DND.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawSystem = (searchParams.get('system') ?? 'DND').toUpperCase()

  const VALID_SYSTEMS = ['DND', 'PF2E'] as const
  type System = (typeof VALID_SYSTEMS)[number]

  if (!VALID_SYSTEMS.includes(rawSystem as System)) {
    return NextResponse.json(
      {
        error: 'INVALID_SYSTEM',
        message: `Параметр system должен быть одним из: ${VALID_SYSTEMS.join(', ')}`,
        received: rawSystem,
      },
      { status: 400 },
    )
  }

  const system = rawSystem as System

  const where = { system }

  const [
    charactersCount,
    loreCount,
    locationsCount,
    chroniclesCount,
    factionsCount,
    charactersSealed,
    loreSealed,
    locationsSealed,
    chroniclesSealed,
    charactersCorrupted,
    loreCorrupted,
    locationsCorrupted,
    chroniclesCorrupted,
  ] = await Promise.all([
    db.character.count({ where: { ...where, kind: 'HERO' } }),
    db.lore.count({ where }),
    db.location.count({ where }),
    db.chronicle.count({ where }),
    db.faction.count({ where }),
    db.character.count({ where: { ...where, kind: 'HERO', isLocked: true } }),
    db.lore.count({ where: { ...where, isLocked: true } }),
    db.location.count({ where: { ...where, isLocked: true } }),
    db.chronicle.count({ where: { ...where, isLocked: true } }),
    db.character.count({
      where: { ...where, kind: 'HERO', isCorrupted: true },
    }),
    db.lore.count({ where: { ...where, isCorrupted: true } }),
    db.location.count({ where: { ...where, isCorrupted: true } }),
    db.chronicle.count({ where: { ...where, isCorrupted: true } }),
  ])

  const totalRecords =
    charactersCount + loreCount + locationsCount + chroniclesCount + factionsCount

  const sealedRecords =
    charactersSealed +
    loreSealed +
    locationsSealed +
    chroniclesSealed

  const corruptedRecords =
    charactersCorrupted +
    loreCorrupted +
    locationsCorrupted +
    chroniclesCorrupted

  return NextResponse.json({
    totalRecords,
    sealedRecords,
    corruptedRecords,
    gazeBase: 7,
    breakdown: {
      characters: charactersCount,
      lore: loreCount,
      locations: locationsCount,
      chronicles: chroniclesCount,
      factions: factionsCount,
    },
  })
}
