import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/reorder — порядок записей в архиве (drag-n-drop в Мастерской).
//
// POST { kind, system, ids }
//   kind: 'character' | 'lore' | 'location' | 'faction'
//   system: 'DND' | 'PF2E' (мир списка)
//   ids: массив id записей В НОВОМ ПОРЯДКЕ (текущая вкладка Мастерской)
//
// sortOrder присваивается 10, 20, 30… — между записями остаётся запас для
// вставок. Записи, не попавшие в ids (другая вкладка/папка), не трогаются.
// merge-seed порядок не сбрасывает: Prisma-апдейт не включает sortOrder,
// а seed не содержит этого поля для character/location.
// Доступ: только ADMIN.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SYSTEMS = ['DND', 'PF2E'] as const
type System = (typeof VALID_SYSTEMS)[number]

const SORTABLE_KINDS = ['character', 'lore', 'location', 'faction'] as const
type SortKind = (typeof SORTABLE_KINDS)[number]

const MAX_IDS = 500

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 })
  }

  const kind = String(body.kind ?? '') as SortKind
  const rawSystem = String(body.system ?? '').toUpperCase()
  const ids = Array.isArray(body.ids) ? body.ids : []

  if (!(SORTABLE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json(
      { ok: false, error: 'BAD_KIND', hint: 'сортируются: character, lore, location, faction' },
      { status: 400 },
    )
  }
  if (!(VALID_SYSTEMS as readonly string[]).includes(rawSystem)) {
    return NextResponse.json({ ok: false, error: 'BAD_SYSTEM' }, { status: 400 })
  }
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: 'NO_IDS' }, { status: 400 })
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { ok: false, error: 'TOO_MANY_IDS', hint: `максимум ${MAX_IDS} записей за раз` },
      { status: 400 },
    )
  }
  // только строки, без дублей
  const idList = ids.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (idList.length !== ids.length || new Set(idList).size !== idList.length) {
    return NextResponse.json(
      { ok: false, error: 'BAD_IDS', hint: 'id должны быть уникальными строками' },
      { status: 400 },
    )
  }

  try {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error
    const admin = auth.user
    const system = rawSystem as System

    // все записи этого вида и мира — id из другого мира/таблицы отклоняем
    const table = (
      kind === 'character'
        ? db.character
        : kind === 'lore'
          ? db.lore
          : kind === 'location'
            ? db.location
            : db.faction
    ) as unknown as typeof db.character
    const inWorld = await table.findMany({
      where: { system },
      select: { id: true },
    })
    const known = new Set(inWorld.map((r) => r.id))
    const foreign = idList.filter((id) => !known.has(id))
    if (foreign.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'BAD_IDS',
          hint: 'среди id есть записи другого мира или уже удалённые',
        },
        { status: 400 },
      )
    }

    // 10, 20, 30… — записи не из этого списка сохраняют прежний порядок
    await db.$transaction(
      idList.map((id, i) =>
        table.update({
          where: { id },
          data: { sortOrder: (i + 1) * 10 },
        }),
      ),
    )

    return NextResponse.json({ ok: true, updated: idList.length })
  } catch (e) {
    console.error('[api/admin/reorder] DB error:', e)
    return NextResponse.json({ ok: false, error: 'DB_UNAVAILABLE' }, { status: 503 })
  }
}
