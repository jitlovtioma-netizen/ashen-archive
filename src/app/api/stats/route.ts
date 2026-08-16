import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/stats?system=DND|PF2E
// Возвращает агрегированную статистику для статус-бара:
// { totalRecords, sealedRecords, corruptedRecords, gazeBase, breakdown }
// breakdown: { characters (kind=HERO only), lore, locations, factions }
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
    factionsCount,
    charactersSealed,
    loreSealed,
    locationsSealed,
    charactersCorrupted,
    loreCorrupted,
    locationsCorrupted,
    totalShardWords,
  ] = await Promise.all([
    db.character.count({ where: { ...where, kind: 'HERO' } }),
    db.lore.count({ where }),
    db.location.count({ where }),
    db.faction.count({ where }),
    db.character.count({ where: { ...where, kind: 'HERO', isLocked: true } }),
    db.lore.count({ where: { ...where, isLocked: true } }),
    db.location.count({ where: { ...where, isLocked: true } }),
    db.character.count({
      where: { ...where, kind: 'HERO', isCorrupted: true },
    }),
    db.lore.count({ where: { ...where, isCorrupted: true } }),
    db.location.count({ where: { ...where, isCorrupted: true } }),
    // Количество уникальных shardWord во всех таблицах (для вкладки «Секреты»)
    db.character.count({
      where: { ...where, kind: 'HERO', shardWord: { not: null } },
    }).then(async (n) => {
      const [chars, lore, locs] = await Promise.all([
        db.character.findMany({ where: { ...where, kind: 'HERO', shardWord: { not: null } }, select: { shardWord: true } }),
        db.lore.findMany({ where: { ...where, shardWord: { not: null } }, select: { shardWord: true } }),
        db.location.findMany({ where: { ...where, shardWord: { not: null } }, select: { shardWord: true } }),
      ])
      const unique = new Set<string>()
      ;[...chars, ...lore, ...locs].forEach((r) => {
        if (r.shardWord) unique.add(r.shardWord)
      })
      return unique.size
    }),
  ])

  const totalRecords =
    charactersCount + loreCount + locationsCount + factionsCount

  const sealedRecords =
    charactersSealed +
    loreSealed +
    locationsSealed

  const corruptedRecords =
    charactersCorrupted +
    loreCorrupted +
    locationsCorrupted

  return NextResponse.json({
    totalRecords,
    sealedRecords,
    corruptedRecords,
    gazeBase: 7,
    totalShardWords,
    breakdown: {
      characters: charactersCount,
      lore: loreCount,
      locations: locationsCount,
      factions: factionsCount,
    },
  })
}
