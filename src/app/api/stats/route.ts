import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/stats?system=DND|PF2E
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

  // Подсчитываем уникальные shardWord ТОЛЬКО в таблице Lore
  // (Character осколки убраны — они не нужны)
  const loreShards = await db.lore.findMany({
    where: { ...where, shardWord: { not: null } },
    select: { shardWord: true },
  })
  const uniqueShardWords = new Set<string>()
  loreShards.forEach((r) => {
    if (r.shardWord) uniqueShardWords.add(r.shardWord)
  })
  const totalShardWords = uniqueShardWords.size

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
  ] = await Promise.all([
    db.character.count({ where: { ...where, kind: 'HERO' } }),
    db.lore.count({ where }),
    db.location.count({ where }),
    db.faction.count({ where }),
    db.character.count({ where: { ...where, kind: 'HERO', isLocked: true } }),
    db.lore.count({ where: { ...where, isLocked: true } }),
    db.location.count({ where: { ...where, isLocked: true } }),
    db.character.count({ where: { ...where, kind: 'HERO', isCorrupted: true } }),
    db.lore.count({ where: { ...where, isCorrupted: true } }),
    db.location.count({ where: { ...where, isCorrupted: true } }),
  ])

  const totalRecords = charactersCount + loreCount + locationsCount + factionsCount
  const sealedRecords = charactersSealed + loreSealed + locationsSealed
  const corruptedRecords = charactersCorrupted + loreCorrupted + locationsCorrupted

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
