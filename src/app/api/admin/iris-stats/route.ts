import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// МАСТЕРСКАЯ · ИРИС В ЦИФРАХ — агрегация поглощения по всем стражам.
// Доступ: только роль ADMIN.
//
// GET /api/admin/iris-stats?requester=<login>
//   → { ok, totals, rows }
//     rows — ирис-досье (⟪…⟫), отсортированные по открытиям:
//     { id, name, kind, system, opens, readers, stage, cleanWords, eaten }
//     eaten — оценка слов, съеденных ирисом СУММАРНО всеми стражами
//     (у каждого своя стадия поглощения = его личные открытия).
//
// Читает только Progress.irisOpens / irisReadIds — ничего не пишет.
// ─────────────────────────────────────────────────────────────────────────────

// стадии поглощения (доля съеденных чистых слов) — зеркало
// IRIS_SPREAD_BY_STAGE из CorruptedText.tsx (клиент и сервер согласованы)
const SPREAD_BY_STAGE = [0, 0.1, 0.22, 0.38, 0.55, 0.68, 0.78] as const

/** Слова ВНЕ меток ⟪…⟫ и ⟦…⟧ — именно их ест ирис. */
function countCleanWords(text: string): number {
  const stripped = text
    .replace(/⟪[^⟫]*⟫/g, ' ')
    .replace(/⟦[^⟧]*⟧/g, ' ')
  return stripped.split(/\s+/).filter(Boolean).length
}

function parseJsonMap(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const out: Record<string, number> = {}
      for (const [k, n] of Object.entries(v)) {
        const num = Number(n)
        if (typeof k === 'string' && k.length <= 40 && Number.isFinite(num) && num > 0 && num < 1000) {
          out[k] = Math.floor(num)
        }
      }
      return out
    }
  } catch {
    // битый JSON — просто пустая карта
  }
  return {}
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').slice(0, 500)
  } catch {
    // ignore
  }
  return []
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const requester = searchParams.get('requester') ?? ''

  try {
    const admin = await db.user.findUnique({ where: { login: requester } })
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
    }

    // ирис-досье всех миров: Character / Lore / Location с ⟪…⟫ в тексте
    const [characters, lore, locations, progress] = await Promise.all([
      db.character.findMany({ select: { id: true, name: true, system: true, description: true } }),
      db.lore.findMany({ select: { id: true, title: true, system: true, description: true } }),
      db.location.findMany({ select: { id: true, name: true, system: true, description: true } }),
      db.progress.findMany({
        select: { irisOpens: true, irisReadIds: true, system: true },
      }),
    ])

    type IrisRec = { id: string; name: string; kind: string; system: string; cleanWords: number }
    const irisRecords: IrisRec[] = []
    for (const c of characters) {
      if (c.description.includes('⟪'))
        irisRecords.push({ id: c.id, name: c.name, kind: 'character', system: c.system, cleanWords: countCleanWords(c.description) })
    }
    for (const l of lore) {
      if (l.description.includes('⟪'))
        irisRecords.push({ id: l.id, name: l.title, kind: 'lore', system: l.system, cleanWords: countCleanWords(l.description) })
    }
    for (const loc of locations) {
      if (loc.description.includes('⟪'))
        irisRecords.push({ id: loc.id, name: loc.name, kind: 'location', system: loc.system, cleanWords: countCleanWords(loc.description) })
    }

    // агрегируем по каждому ирис-досье: открытия, читатели, съеденные слова
    const byId = new Map(irisRecords.map((r) => [r.id, { ...r, opens: 0, readers: 0, maxOpens: 0, eaten: 0 }]))
    let playersTouchedIris = 0
    let totalEaten = 0

    for (const p of progress) {
      const opens = parseJsonMap(p.irisOpens)
      const reads = new Set(parseJsonArray(p.irisReadIds))
      const irisKeys = new Set([...Object.keys(opens), ...reads])
      if (irisKeys.size > 0) playersTouchedIris++

      for (const id of irisKeys) {
        const rec = byId.get(id)
        if (!rec) continue // досье удалено / метка устарела
        const n = opens[id] ?? 0
        rec.opens += n
        if (n > rec.maxOpens) rec.maxOpens = n
        if (reads.has(id) || n > 0) rec.readers++
        // слова, съеденные ЭТИМ стражем: его стадия × его доля чистых слов
        const stage = Math.max(0, Math.min(SPREAD_BY_STAGE.length - 1, n - 1))
        rec.eaten += Math.round(rec.cleanWords * SPREAD_BY_STAGE[stage])
      }
    }
    totalEaten = [...byId.values()].reduce((s, r) => s + r.eaten, 0)

    const rows = [...byId.values()]
      .sort((a, b) => b.opens - a.opens || b.eaten - a.eaten)
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        system: r.system,
        opens: r.opens,
        readers: r.readers,
        // максимальная стадия среди стражей: сколько «съел» самый жадный читатель
        stage: Math.max(0, Math.min(SPREAD_BY_STAGE.length - 1, r.maxOpens - 1)),
        cleanWords: r.cleanWords,
        eaten: r.eaten,
      }))

    return NextResponse.json({
      ok: true,
      totals: {
        records: irisRecords.length,
        players: playersTouchedIris,
        opens: [...byId.values()].reduce((s, r) => s + r.opens, 0),
        eaten: totalEaten,
      },
      rows,
    })
  } catch (err) {
    console.error('[admin/iris-stats] error:', err)
    return NextResponse.json({ ok: false, error: 'DB_ERROR' }, { status: 500 })
  }
}
