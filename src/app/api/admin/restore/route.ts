import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/restore — восстановление архива из JSON-бэкапа (кнопка
// «⇧ ВОССТАНОВИТЬ» в Мастерской; бэкап скачивается кнопкой «⇩ БЭКАП»).
//
// Body: { action: 'preview' | 'restore', dump }
//   dump — содержимое archive-backup-YYYY-MM-DD.json (формат /api/admin/export).
//
// Логика — зеркально merge-seed, ничего не удаляет и не перезаписывает:
//   - записи из бэкапа, которых нет в базе (по натуральному ключу),
//     воссоздаются с их id/userModified/createdAt из бэкапа — привязки
//     стражей к досье (characterId) восстанавливаются автоматически;
//   - существующие записи НЕ трогаются (текущая версия важнее бэкапа);
//   - пользователей не создаём (паролей в бэкапе нет); существующим стражам
//     возвращаем привязку досье, если она свободна;
//   - прогресс стражей неприкосновенен.
//
// preview — сухой прогон: сколько записей будет воссоздано/пропущено.
// Доступ: только роль ADMIN.
// ─────────────────────────────────────────────────────────────────────────────

interface DumpRow {
  [k: string]: unknown
}

interface TableReport {
  restored: number
  skipped: number
}

// натуральные ключи каждой таблицы (контракт merge-seed)
const NATURAL_KEYS: Record<string, (r: DumpRow) => Record<string, unknown>> = {
  factions: (r) => ({ name: r.name, system: r.system }),
  characters: (r) => ({ name: r.name, system: r.system }),
  lore: (r) => ({ title: r.title, system: r.system }),
  locations: (r) => ({ name: r.name, system: r.system }),
  riddles: (r) => ({ recordName: r.recordName }),
  achievements: (r) => ({ code: r.code }),
}

// служебные поля, которые не тащим в create
const DROP_FIELDS = new Set(['updatedAt'])

function sanitizeRow(row: DumpRow): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (DROP_FIELDS.has(k) || v === undefined) continue
    out[k] = v
  }
  return out
}

function isValidDump(dump: unknown): dump is Record<string, unknown> {
  if (!dump || typeof dump !== 'object') return false
  const meta = (dump as Record<string, unknown>)._meta as
    | { kind?: string }
    | undefined
  return !!meta && meta.kind === 'ashen-archive-backup'
}

async function tableFind(
  table: keyof typeof NATURAL_KEYS,
  where: Record<string, unknown>,
): Promise<{ id: string } | null> {
  switch (table) {
    case 'factions':
      return db.faction.findFirst({ where, select: { id: true } })
    case 'characters':
      return db.character.findFirst({ where, select: { id: true } })
    case 'lore':
      return db.lore.findFirst({ where, select: { id: true } })
    case 'locations':
      return db.location.findFirst({ where, select: { id: true } })
    case 'riddles':
      return db.riddle.findFirst({ where, select: { id: true } })
    default:
      return db.achievement.findFirst({ where, select: { id: true } })
  }
}

async function tableCreate(
  table: keyof typeof NATURAL_KEYS,
  data: Record<string, unknown>,
): Promise<unknown> {
  // первая попытка — с id из бэкапа (сохраняет привязки characterId);
  // если id вдруг занят (коллизия после переименования) — создаём с новым
  try {
    switch (table) {
      case 'factions':
        return await db.faction.create({ data: data as never })
      case 'characters':
        return await db.character.create({ data: data as never })
      case 'lore':
        return await db.lore.create({ data: data as never })
      case 'locations':
        return await db.location.create({ data: data as never })
      case 'riddles':
        return await db.riddle.create({ data: data as never })
      default:
        return await db.achievement.create({ data: data as never })
    }
  } catch {
    const retry = { ...data }
    delete retry.id
    switch (table) {
      case 'factions':
        return await db.faction.create({ data: retry as never })
      case 'characters':
        return await db.character.create({ data: retry as never })
      case 'lore':
        return await db.lore.create({ data: retry as never })
      case 'locations':
        return await db.location.create({ data: retry as never })
      case 'riddles':
        return await db.riddle.create({ data: retry as never })
      default:
        return await db.achievement.create({ data: retry as never })
    }
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 })
  }

  const action = body.action === 'restore' ? 'restore' : 'preview'
  const dump = body.dump

  if (!isValidDump(dump)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'BAD_DUMP',
        hint: 'это не бэкап архива — выберите файл archive-backup-*.json (кнопка «⇩ БЭКАП»)',
      },
      { status: 400 },
    )
  }

  try {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error
    const admin = auth.user

    // ── расчёт: чего в базе нет (будет воссоздано), что есть (пропуск) ──
    const report: Record<string, TableReport> = {}
    const missing: Record<string, DumpRow[]> = {}

    for (const [table, keyOf] of Object.entries(NATURAL_KEYS)) {
      const rows = Array.isArray(dump[table]) ? (dump[table] as DumpRow[]) : []
      const miss: DumpRow[] = []
      let skipped = 0
      for (const row of rows) {
        const existing = await tableFind(table as keyof typeof NATURAL_KEYS, keyOf(row))
        if (existing) skipped++
        else miss.push(row)
      }
      report[table] = { restored: miss.length, skipped }
      missing[table] = miss
    }

    // привязки досье: юзеры из бэкапа без привязки в текущей базе,
    // чей персонаж существует (или будет воссоздан)
    const dumpUsers = Array.isArray(dump.users) ? (dump.users as DumpRow[]) : []
    const charIds = new Set<string>()
    for (const c of Array.isArray(dump.characters) ? (dump.characters as DumpRow[]) : []) {
      if (typeof c.id === 'string') charIds.add(c.id)
    }
    for (const c of missing['characters'] ?? []) {
      if (typeof c.id === 'string') charIds.add(c.id)
    }
    const rebindCandidates: { login: string; characterId: string }[] = []
    for (const u of dumpUsers) {
      const login = typeof u.login === 'string' ? u.login : ''
      const characterId = typeof u.characterId === 'string' ? u.characterId : ''
      if (!login || !characterId || !charIds.has(characterId)) continue
      const current = await db.user.findUnique({
        where: { login },
        select: { characterId: true },
      })
      if (current && !current.characterId) {
        // персонаж должен существовать в базе (или быть воссозданным)
        const char = await db.character.findUnique({
          where: { id: characterId },
          select: { id: true },
        })
        if (char) rebindCandidates.push({ login, characterId })
      }
    }

    if (action === 'preview') {
      return NextResponse.json({
        ok: true,
        action,
        report,
        usersToRebind: rebindCandidates.length,
        exportedAt:
          ((dump._meta as Record<string, unknown>)?.exportedAt as string) ?? '',
      })
    }

    // ── RESTORE: воссоздаём отсутствующие записи ──
    const restoredCounts: Record<string, number> = {}
    for (const [table, rows] of Object.entries(missing)) {
      let n = 0
      for (const row of rows) {
        const data = sanitizeRow(row)
        if (Object.keys(data).length === 0) continue
        await tableCreate(table as keyof typeof NATURAL_KEYS, data)
        n++
      }
      restoredCounts[table] = n
    }

    // привязки досье — существующим стражам без привязки
    let rebound = 0
    for (const { login, characterId } of rebindCandidates) {
      try {
        await db.user.update({
          where: { login },
          data: { characterId },
        })
        rebound++
      } catch {
        // юзер исчез между preview и restore — пропускаем
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      report,
      restored: restoredCounts,
      rebound,
    })
  } catch (e) {
    console.error('[api/admin/restore] DB error:', e)
    return NextResponse.json({ ok: false, error: 'DB_UNAVAILABLE' }, { status: 503 })
  }
}
