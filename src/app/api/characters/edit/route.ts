import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/characters/edit
// Body: { requester, characterId, patch: { description?, title?, status? } }
//
// Редактирование досье персонажа. Права:
//   • ВЛАДЕЛЕЦ — страж, к которому персонаж привязан (user.characterId);
//   • АДМИН — Созидатель может править любое досье.
// Правки пишутся в общую базу — их увидят ВСЕ стражи архива.

const MAX_DESCRIPTION = 6000
const MAX_TITLE = 120
const VALID_STATUSES = ['ALIVE', 'DEAD', 'MISSING']

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 })
  }

  const requester = typeof body.requester === 'string' ? body.requester.trim() : ''
  const characterId = typeof body.characterId === 'string' ? body.characterId : ''
  const patch = (body.patch ?? {}) as Record<string, unknown>

  if (!requester) {
    return NextResponse.json({ ok: false, error: 'NO_LOGIN' }, { status: 400 })
  }
  if (!characterId) {
    return NextResponse.json({ ok: false, error: 'NO_CHARACTER' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { login: requester } })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNKNOWN_USER' }, { status: 404 })
  }

  const character = await db.character.findUnique({ where: { id: characterId } })
  if (!character) {
    return NextResponse.json({ ok: false, error: 'UNKNOWN_CHARACTER' }, { status: 404 })
  }

  // Права: владелец досье или админ
  const isOwner = user.characterId === character.id
  const isAdmin = user.role === 'ADMIN'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }

  // Владелец не может править досье чужого мира (админ может — он странствует)
  if (!isAdmin && character.system !== user.system) {
    return NextResponse.json({ ok: false, error: 'SYSTEM_MISMATCH' }, { status: 400 })
  }

  const data: Record<string, string> = {}

  if ('description' in patch) {
    if (typeof patch.description !== 'string') {
      return NextResponse.json({ ok: false, error: 'BAD_DESCRIPTION' }, { status: 400 })
    }
    const description = patch.description.trim()
    if (description.length < 3 || description.length > MAX_DESCRIPTION) {
      return NextResponse.json(
        { ok: false, error: 'BAD_DESCRIPTION', hint: `3..${MAX_DESCRIPTION} символов` },
        { status: 400 },
      )
    }
    data.description = description
  }

  if ('title' in patch && patch.title !== undefined && patch.title !== null) {
    if (typeof patch.title !== 'string') {
      return NextResponse.json({ ok: false, error: 'BAD_TITLE' }, { status: 400 })
    }
    const title = patch.title.trim()
    if (title.length < 1 || title.length > MAX_TITLE) {
      return NextResponse.json(
        { ok: false, error: 'BAD_TITLE', hint: `1..${MAX_TITLE} символов` },
        { status: 400 },
      )
    }
    data.title = title
  }

  if ('status' in patch && patch.status !== undefined && patch.status !== null) {
    if (typeof patch.status !== 'string' || !VALID_STATUSES.includes(patch.status)) {
      return NextResponse.json(
        { ok: false, error: 'BAD_STATUS', hint: VALID_STATUSES.join(', ') },
        { status: 400 },
      )
    }
    data.status = patch.status
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'EMPTY_PATCH' }, { status: 400 })
  }

  const updated = await db.character.update({
    where: { id: character.id },
    data,
  })

  return NextResponse.json({
    ok: true,
    character: {
      id: updated.id,
      name: updated.name,
      title: updated.title,
      category: updated.category,
      race: updated.race,
      description: updated.description,
      status: updated.status,
      system: updated.system,
    },
  })
}
