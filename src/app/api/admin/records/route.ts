import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { DOSSIER_THEME_KEYS, IRIS_PALETTE_KEYS } from '@/lib/themes'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// МАСТЕРСКАЯ СОЗИДАТЕЛЯ — CRUD всех записей архива без правки кода.
// Доступ: только роль ADMIN.
//
// GET  /api/admin/records?system=DND|PF2E
//   → { ok, characters, lore, locations, factions, riddles, achievements, bindings }
//     characters — ВСЕ (HERO и NPC), bindings — кто из стражей к кому привязан.
//
// POST /api/admin/records
//   { action: 'create' | 'update' | 'delete',
//     kind: 'character' | 'lore' | 'location' | 'faction' | 'riddle' | 'achievement',
//     id?, data? }
//   → { ok, record } | { ok: false, error, hint? }
//
// Любая запись, созданная/изменённая здесь, получает userModified=true —
// seed больше не перезаписывает её при обновлениях архива.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_NAME = 120
const MAX_TITLE = 120
const MAX_CATEGORY = 120
const MAX_RACE = 120
const MAX_DESC = 6000
const MAX_SIGIL = 12
const MAX_SHARD = 60
const MAX_FRAGMENT = 2000
const MAX_IMAGE = 500
const MAX_CODE = 60
const MAX_RIDDLE_TEXT = 2000
const MAX_ANSWER = 120
const MAX_ANSWERS = 24
const MAX_SUBTITLE = 120
const MAX_HINT = 300
const MAX_ACH_CODE = 60

const VALID_SYSTEMS = ['DND', 'PF2E'] as const
type System = (typeof VALID_SYSTEMS)[number]

const VALID_STATUSES = ['ALIVE', 'DEAD', 'MISSING'] as const
type Status = (typeof VALID_STATUSES)[number]

const VALID_FOLDERS = ['PANTHEON', 'SECONDARY_HEROES', 'SECRETS'] as const

const VALID_KINDS = [
  'character',
  'lore',
  'location',
  'faction',
  'riddle',
  'achievement',
] as const
type RecKind = (typeof VALID_KINDS)[number]

// ── Парсеры-валидаторы ──────────────────────────────────────────────────────
// Ошибки — через throw ApiError, чтобы не размазывать проверки по коду.

class ApiError extends Error {
  code: string
  hint?: string
  status: number
  constructor(code: string, hint: string | undefined, status = 400) {
    super(code)
    this.code = code
    this.hint = hint
    this.status = status
  }
}

/** Строка 1..max (trim). Пустая → ошибка. */
function reqStr(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string') throw new ApiError('BAD_' + field.toUpperCase(), `${field}: строка 1..${max}`)
  const s = v.trim()
  if (!s || s.length > max) throw new ApiError('BAD_' + field.toUpperCase(), `${field}: строка 1..${max} символов`)
  return s
}

/** Опциональная строка. undefined → undefined (не менять), null/'' → null (очистить). */
function optStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  return s.slice(0, max)
}

/** Обязательная на создании строка с дефолтом. */
function strOr(v: unknown, fallback: string, max: number): string {
  if (v === undefined || v === null) return fallback
  if (typeof v !== 'string') return fallback
  const s = v.trim()
  return s ? s.slice(0, max) : fallback
}

function optBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1
}

function optInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function parseStatus(v: unknown): Status {
  const s = String(v ?? 'ALIVE').toUpperCase()
  return (VALID_STATUSES as readonly string[]).includes(s) ? (s as Status) : 'ALIVE'
}

function parseSystem(v: unknown): System {
  const s = String(v ?? '').toUpperCase()
  if (!(VALID_SYSTEMS as readonly string[]).includes(s)) {
    throw new ApiError('BAD_SYSTEM', `system: ${VALID_SYSTEMS.join(', ')}`)
  }
  return s as System
}

/** Опциональная система: null/'' → null (любой мир), иначе DND|PF2E. */
function optSystem(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  const s = String(v).trim().toUpperCase()
  if (!s) return null
  if (!(VALID_SYSTEMS as readonly string[]).includes(s)) {
    throw new ApiError('BAD_SYSTEM', `system: ${VALID_SYSTEMS.join(', ')} или пусто`)
  }
  return s
}

/** Цвет досье: ключ темы или null (стандартное оформление). */
function optThemeColor(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  const s = String(v).trim()
  if (!s) return null
  if (!DOSSIER_THEME_KEYS.includes(s)) {
    throw new ApiError('BAD_THEME_COLOR', `themeColor: ${DOSSIER_THEME_KEYS.join(', ')} или пусто`)
  }
  return s
}

/** Палитра ириса (полное искажение ⟪…⟫): ключ палитры или null (авто). */
function optIrisColor(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  const s = String(v).trim()
  if (!s) return null
  if (!IRIS_PALETTE_KEYS.includes(s)) {
    throw new ApiError('BAD_IRIS_COLOR', `irisColor: ${IRIS_PALETTE_KEYS.join(', ')} или пусто`)
  }
  return s
}

/** Код награды за загадку: латиница/цифры/_ или null (без награды). */
function optAchievementCode(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  const s = String(v).trim()
  if (!s) return null
  if (!/^[A-Za-z0-9_]+$/.test(s)) {
    throw new ApiError('BAD_ACH_CODE', 'код награды: латиница, цифры и _ (напр. RIDDLE_MASTER)')
  }
  return s.toUpperCase()
}

// ── Сборка data для Prisma по типу записи ───────────────────────────────────

function buildCharacter(raw: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {}
  if (isCreate || 'name' in raw) data.name = reqStr(raw.name, 'name', MAX_NAME)
  if (isCreate || 'title' in raw) data.title = strOr(raw.title, '', MAX_TITLE)
  if (isCreate || 'category' in raw) data.category = strOr(raw.category, '', MAX_CATEGORY)
  if (isCreate || 'race' in raw) data.race = strOr(raw.race, '', MAX_RACE)
  if (isCreate || 'description' in raw) data.description = reqStr(raw.description, 'description', MAX_DESC)
  if (isCreate || 'sigil' in raw) data.sigil = strOr(raw.sigil, '✦', MAX_SIGIL)
  if (isCreate) data.system = parseSystem(raw.system)
  if (isCreate || 'kind' in raw) {
    const kind = String(raw.kind ?? 'HERO').toUpperCase() === 'NPC' ? 'NPC' : 'HERO'
    data.kind = kind
  }
  if (isCreate || 'status' in raw) data.status = parseStatus(raw.status)
  if (isCreate || 'imageUrl' in raw) data.imageUrl = optStr(raw.imageUrl, MAX_IMAGE)
  if (isCreate || 'themeColor' in raw) data.themeColor = optThemeColor(raw.themeColor)
  if (isCreate || 'irisColor' in raw) data.irisColor = optIrisColor(raw.irisColor)
  if (isCreate || 'shardWord' in raw) data.shardWord = optStr(raw.shardWord, MAX_SHARD)
  if (isCreate || 'secretFragment' in raw) data.secretFragment = optStr(raw.secretFragment, MAX_FRAGMENT)
  if (isCreate || 'isLocked' in raw) data.isLocked = optBool(raw.isLocked)
  if (isCreate || 'isCorrupted' in raw) data.isCorrupted = optBool(raw.isCorrupted)
  if (isCreate || 'mapX' in raw) data.mapX = optInt(raw.mapX, 0, -10000, 10000)
  if (isCreate || 'mapY' in raw) data.mapY = optInt(raw.mapY, 0, -10000, 10000)
  if (isCreate || 'sortOrder' in raw) data.sortOrder = optInt(raw.sortOrder, 0, -9999, 9999)
  if (isCreate || 'factionId' in raw) {
    const fid = optStr(raw.factionId, 64)
    if (fid === undefined && isCreate) data.factionId = null
    else if (fid !== undefined) data.factionId = fid // null → отвязать
  }
  return data
}

function buildLore(raw: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {}
  if (isCreate || 'title' in raw) data.title = reqStr(raw.title ?? raw.name, 'title', MAX_TITLE)
  if (isCreate || 'category' in raw) data.category = strOr(raw.category, '', MAX_CATEGORY)
  if (isCreate || 'description' in raw) data.description = reqStr(raw.description, 'description', MAX_DESC)
  if (isCreate || 'sigil' in raw) data.sigil = strOr(raw.sigil, '✦', MAX_SIGIL)
  if (isCreate) data.system = parseSystem(raw.system)
  if (isCreate || 'folder' in raw) {
    const f = raw.folder
    if (f === null || f === undefined || f === '') data.folder = null
    else {
      const s = String(f)
      if (!(VALID_FOLDERS as readonly string[]).includes(s)) {
        throw new ApiError('BAD_FOLDER', `folder: ${VALID_FOLDERS.join(', ')} или пусто`)
      }
      data.folder = s
    }
  }
  if (isCreate || 'imageUrl' in raw) data.imageUrl = optStr(raw.imageUrl, MAX_IMAGE)
  if (isCreate || 'themeColor' in raw) data.themeColor = optThemeColor(raw.themeColor)
  if (isCreate || 'irisColor' in raw) data.irisColor = optIrisColor(raw.irisColor)
  if (isCreate || 'sortOrder' in raw) data.sortOrder = optInt(raw.sortOrder, 0, -9999, 9999)
  if (isCreate || 'status' in raw) data.status = parseStatus(raw.status)
  if (isCreate || 'friendship' in raw) {
    const f = raw.friendship
    if (f === null || f === undefined || f === '') data.friendship = null
    else data.friendship = optInt(f, 0, 0, 10)
  }
  if (isCreate || 'shardWord' in raw) data.shardWord = optStr(raw.shardWord, MAX_SHARD)
  if (isCreate || 'secretFragment' in raw) data.secretFragment = optStr(raw.secretFragment, MAX_FRAGMENT)
  if (isCreate || 'isLocked' in raw) data.isLocked = optBool(raw.isLocked)
  if (isCreate || 'isCorrupted' in raw) data.isCorrupted = optBool(raw.isCorrupted)
  if (isCreate || 'mapX' in raw) data.mapX = optInt(raw.mapX, 0, -10000, 10000)
  if (isCreate || 'mapY' in raw) data.mapY = optInt(raw.mapY, 0, -10000, 10000)
  return data
}

function buildLocation(raw: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {}
  if (isCreate || 'name' in raw) data.name = reqStr(raw.name ?? raw.title, 'name', MAX_NAME)
  if (isCreate || 'type' in raw) data.type = strOr(raw.type ?? raw.category, '', MAX_CATEGORY)
  if (isCreate || 'description' in raw) data.description = reqStr(raw.description, 'description', MAX_DESC)
  if (isCreate || 'sigil' in raw) data.sigil = strOr(raw.sigil, '🗺', MAX_SIGIL)
  if (isCreate) data.system = parseSystem(raw.system)
  if (isCreate || 'themeColor' in raw) data.themeColor = optThemeColor(raw.themeColor)
  if (isCreate || 'irisColor' in raw) data.irisColor = optIrisColor(raw.irisColor)
  if (isCreate || 'shardWord' in raw) data.shardWord = optStr(raw.shardWord, MAX_SHARD)
  if (isCreate || 'secretFragment' in raw) data.secretFragment = optStr(raw.secretFragment, MAX_FRAGMENT)
  if (isCreate || 'isLocked' in raw) data.isLocked = optBool(raw.isLocked)
  if (isCreate || 'isCorrupted' in raw) data.isCorrupted = optBool(raw.isCorrupted)
  if (isCreate || 'mapX' in raw) data.mapX = optInt(raw.mapX, 0, -10000, 10000)
  if (isCreate || 'mapY' in raw) data.mapY = optInt(raw.mapY, 0, -10000, 10000)
  if (isCreate || 'sortOrder' in raw) data.sortOrder = optInt(raw.sortOrder, 0, -9999, 9999)
  return data
}

function buildFaction(raw: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {}
  if (isCreate || 'name' in raw) data.name = reqStr(raw.name, 'name', MAX_NAME)
  if (isCreate || 'description' in raw) data.description = reqStr(raw.description, 'description', MAX_DESC)
  if (isCreate || 'sigil' in raw) data.sigil = strOr(raw.sigil, '🜲', MAX_SIGIL)
  if (isCreate) data.system = parseSystem(raw.system)
  if (isCreate || 'sortOrder' in raw) data.sortOrder = optInt(raw.sortOrder, 0, -9999, 9999)
  if (isCreate || 'isCorrupted' in raw) data.isCorrupted = optBool(raw.isCorrupted)
  return data
}

function buildRiddle(raw: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {}
  if (isCreate || 'recordName' in raw) {
    data.recordName = reqStr(raw.recordName ?? raw.name, 'recordName', MAX_NAME)
  }
  if (isCreate || 'title' in raw) data.title = reqStr(raw.title ?? raw.name, 'title', MAX_TITLE)
  if (isCreate || 'sigil' in raw) data.sigil = strOr(raw.sigil, '🌑', MAX_SIGIL)
  if (isCreate || 'subtitle' in raw) data.subtitle = optStr(raw.subtitle, MAX_SUBTITLE)
  if (isCreate || 'riddle' in raw || 'description' in raw) {
    data.riddle = reqStr(raw.riddle ?? raw.description, 'riddle', MAX_RIDDLE_TEXT)
  }
  if (isCreate || 'valid' in raw || 'answers' in raw) {
    const v = raw.valid ?? raw.answers
    let answers: string[]
    if (Array.isArray(v)) {
      answers = v
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim().slice(0, MAX_ANSWER))
        .filter(Boolean)
    } else if (typeof v === 'string') {
      // строки через запятую/новую строку
      answers = v
        .split(/[,;\n]/)
        .map((s) => s.trim().slice(0, MAX_ANSWER))
        .filter(Boolean)
    } else {
      answers = []
    }
    if (!answers.length) {
      throw new ApiError('BAD_ANSWERS', 'укажите хотя бы один верный ответ (через запятую)')
    }
    data.valid = JSON.stringify(answers.slice(0, MAX_ANSWERS))
  }
  if (isCreate || 'hint' in raw) data.hint = optStr(raw.hint, MAX_HINT)
  if (isCreate || 'system' in raw) data.system = optSystem(raw.system)
  if (isCreate || 'achievementCode' in raw) {
    data.achievementCode = optAchievementCode(raw.achievementCode)
  }
  return data
}

function buildAchievement(raw: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {}
  if (isCreate || 'code' in raw) {
    const code = reqStr(raw.code ?? raw.name, 'code', MAX_CODE)
    // код ачивки — латиница/цифры/подчёркивание (как в прогрессе стражей)
    if (!/^[A-Za-z0-9_]+$/.test(code)) {
      throw new ApiError('BAD_CODE', 'код: латиница, цифры и _ (напр. FIRST_SHARD)')
    }
    data.code = code.toUpperCase()
  }
  if (isCreate || 'name' in raw) data.name = reqStr(raw.name ?? raw.title, 'name', MAX_TITLE)
  if (isCreate || 'description' in raw) {
    data.description = reqStr(raw.description, 'description', MAX_DESC)
  }
  if (isCreate || 'sigil' in raw) data.sigil = strOr(raw.sigil, '🏆', MAX_SIGIL)
  if (isCreate || 'secretFragment' in raw) data.secretFragment = optStr(raw.secretFragment, MAX_FRAGMENT)
  if (isCreate || 'system' in raw) data.system = optSystem(raw.system)
  return data
}

// ── GET: полный срез данных для панели ──────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawSystem = (searchParams.get('system') ?? 'DND').toUpperCase()

  try {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error
    const admin = auth.user
    if (!(VALID_SYSTEMS as readonly string[]).includes(rawSystem)) {
      return NextResponse.json({ ok: false, error: 'BAD_SYSTEM' }, { status: 400 })
    }
    const system = rawSystem as System

    const [characters, lore, locations, factions, riddles, achievements, bindings] =
      await Promise.all([
        // порядок — как в архиве: sortOrder (drag-n-drop), затем алфавит
        db.character.findMany({
          where: { system },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
        db.lore.findMany({
          where: { system },
          orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        }),
        db.location.findMany({
          where: { system },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
        db.faction.findMany({
          where: { system },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
        // загадки текущего мира + «любого мира»
        db.riddle.findMany({
          where: { OR: [{ system }, { system: null }] },
          orderBy: { recordName: 'asc' },
        }),
        db.achievement.findMany({
          where: { OR: [{ system }, { system: null }] },
          orderBy: { code: 'asc' },
        }),
        db.user.findMany({
          where: { characterId: { not: null } },
          select: { login: true, displayName: true, characterId: true },
        }),
      ])

    return NextResponse.json({
      ok: true,
      characters,
      lore,
      locations,
      factions,
      riddles,
      achievements,
      bindings,
    })
  } catch (e) {
    console.error('[api/admin/records GET] DB error:', e)
    return NextResponse.json({ ok: false, error: 'DB_UNAVAILABLE' }, { status: 503 })
  }
}

// ── POST: create / update / delete ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 })
  }

  const action = String(body.action ?? '')
  const kind = String(body.kind ?? '') as RecKind
  const id = typeof body.id === 'string' ? body.id : ''
  const raw = (body.data ?? {}) as Record<string, unknown>

  if (!['create', 'update', 'delete'].includes(action)) {
    return NextResponse.json({ ok: false, error: 'BAD_ACTION', hint: 'create | update | delete' }, { status: 400 })
  }
  if (!(VALID_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ ok: false, error: 'BAD_KIND', hint: VALID_KINDS.join(', ') }, { status: 400 })
  }
  if ((action === 'update' || action === 'delete') && !id) {
    return NextResponse.json({ ok: false, error: 'NO_ID' }, { status: 400 })
  }

  try {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error
    const admin = auth.user

    // ── DELETE ──
    if (action === 'delete') {
      if (kind === 'character') {
        // отвязываем стражей, чьё досье удаляем
        await db.user.updateMany({ where: { characterId: id }, data: { characterId: null } })
        await db.character.delete({ where: { id } })
      } else if (kind === 'faction') {
        // NPC фракции остаются в архиве, но без фракции
        await db.character.updateMany({ where: { factionId: id }, data: { factionId: null } })
        await db.faction.delete({ where: { id } })
      } else if (kind === 'lore') {
        await db.lore.delete({ where: { id } })
      } else if (kind === 'location') {
        await db.location.delete({ where: { id } })
      } else if (kind === 'riddle') {
        await db.riddle.delete({ where: { id } })
      } else {
        await db.achievement.delete({ where: { id } })
      }
      return NextResponse.json({ ok: true, deleted: id })
    }

    // ── CREATE / UPDATE: сборка и валидация полей ──
    const isCreate = action === 'create'
    let data: Record<string, unknown>
    switch (kind) {
      case 'character':
        data = buildCharacter(raw, isCreate)
        break
      case 'lore':
        data = buildLore(raw, isCreate)
        break
      case 'location':
        data = buildLocation(raw, isCreate)
        break
      case 'faction':
        data = buildFaction(raw, isCreate)
        break
      case 'riddle':
        data = buildRiddle(raw, isCreate)
        break
      default:
        data = buildAchievement(raw, isCreate)
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'EMPTY_DATA' }, { status: 400 })
    }

    // Ссылочная целостность: фракция NPC должна существовать и совпадать по миру
    if (kind === 'character' && typeof data.factionId === 'string' && data.factionId) {
      const faction = await db.faction.findUnique({ where: { id: data.factionId } })
      if (!faction) {
        return NextResponse.json({ ok: false, error: 'BAD_FACTION', hint: 'фракция не найдена' }, { status: 400 })
      }
      let charSystem = data.system as string | undefined
      if (!charSystem && id) {
        const existingChar = await db.character.findUnique({ where: { id }, select: { system: true } })
        charSystem = existingChar?.system
      }
      if (charSystem && faction.system !== charSystem) {
        return NextResponse.json(
          { ok: false, error: 'FACTION_SYSTEM_MISMATCH', hint: 'фракция принадлежит другому миру' },
          { status: 400 },
        )
      }
    }

    // Уникальность кода ачивки
    if (kind === 'achievement' && typeof data.code === 'string') {
      const clash = await db.achievement.findUnique({ where: { code: data.code } })
      if (clash && (isCreate || clash.id !== id)) {
        return NextResponse.json(
          { ok: false, error: 'CODE_EXISTS', hint: 'достижение с таким кодом уже есть' },
          { status: 400 },
        )
      }
    }

    // Всё, что прошло через Мастерскую, — «рукотворное»: seed не трогает его
    data.userModified = true

    if (isCreate) {
      const created =
        kind === 'character'
          ? await db.character.create({ data: data as never })
          : kind === 'lore'
            ? await db.lore.create({ data: data as never })
            : kind === 'location'
              ? await db.location.create({ data: data as never })
              : kind === 'faction'
                ? await db.faction.create({ data: data as never })
                : kind === 'riddle'
                  ? await db.riddle.create({ data: data as never })
                  : await db.achievement.create({ data: data as never })
      return NextResponse.json({ ok: true, record: created })
    }

    // UPDATE — запись должна существовать
    const existing =
      kind === 'character'
        ? await db.character.findUnique({ where: { id } })
        : kind === 'lore'
          ? await db.lore.findUnique({ where: { id } })
          : kind === 'location'
            ? await db.location.findUnique({ where: { id } })
            : kind === 'faction'
              ? await db.faction.findUnique({ where: { id } })
              : kind === 'riddle'
                ? await db.riddle.findUnique({ where: { id } })
                : await db.achievement.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })
    }

    const updated =
      kind === 'character'
        ? await db.character.update({ where: { id }, data })
        : kind === 'lore'
          ? await db.lore.update({ where: { id }, data })
          : kind === 'location'
            ? await db.location.update({ where: { id }, data })
            : kind === 'faction'
              ? await db.faction.update({ where: { id }, data })
              : kind === 'riddle'
                ? await db.riddle.update({ where: { id }, data })
                : await db.achievement.update({ where: { id }, data })
    return NextResponse.json({ ok: true, record: updated })
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ ok: false, error: e.code, hint: e.hint }, { status: e.status })
    }
    console.error('[api/admin/records POST] DB error:', e)
    return NextResponse.json({ ok: false, error: 'DB_UNAVAILABLE' }, { status: 503 })
  }
}
