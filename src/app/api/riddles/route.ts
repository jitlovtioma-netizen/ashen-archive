import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// ЗАГАДКИ-ВРАТА (публичный API).
//
// GET /api/riddles
//   → массив загадок БЕЗ списка ответов (клиент не может подсмотреть):
//     { recordName, sigil, title, subtitle, riddle: string[], hint, system }
//
// POST /api/riddles  { recordName, system?, answer }
//   → { ok: true, correct: boolean } — сверка ответа с сервера.
//     Загадка ищется по имени записи (мир совпадает или не задан).
// ─────────────────────────────────────────────────────────────────────────────

/** Нормализация ответа: trim, нижний регистр, срезаем хвостовую пунктуацию. */
function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:…]+$/, '')
    .replace(/\s+/g, ' ')
}

function parseValid(raw: string): string[] {
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string').map(normalizeAnswer)
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const rows = await db.riddle.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json(
      rows.map((r) => ({
        recordName: r.recordName,
        sigil: r.sigil,
        title: r.title,
        subtitle: r.subtitle,
        riddle: r.riddle.split('\n').filter((l) => l.trim().length > 0),
        hint: r.hint,
        system: r.system,
      })),
    )
  } catch (e) {
    console.error('[api/riddles GET] DB error:', e)
    return NextResponse.json({ error: 'DB_UNAVAILABLE' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 })
  }

  const recordName = typeof body.recordName === 'string' ? body.recordName.trim() : ''
  const system =
    typeof body.system === 'string' && body.system ? body.system.toUpperCase() : null
  const answer = typeof body.answer === 'string' ? body.answer : ''

  if (!recordName || !answer.trim()) {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })
  }

  try {
    const candidates = await db.riddle.findMany({ where: { recordName } })
    const riddle =
      candidates.find((r) => !r.system || !system || r.system === system) ??
      candidates[0]
    if (!riddle) {
      return NextResponse.json({ ok: true, correct: false, error: 'NO_RIDDLE' })
    }
    const valid = parseValid(riddle.valid)
    const correct = valid.includes(normalizeAnswer(answer))
    return NextResponse.json({ ok: true, correct })
  } catch (e) {
    console.error('[api/riddles POST] DB error:', e)
    return NextResponse.json({ ok: false, error: 'DB_UNAVAILABLE' }, { status: 503 })
  }
}
