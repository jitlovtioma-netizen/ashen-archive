import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/upload (multipart: file) → { ok, url }
// Загрузка изображения для досье из Мастерской. Только ADMIN.
//   • есть NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → Supabase
//     Storage, bucket "images", папка uploads/ (работает на Vercel);
//   • иначе — public/uploads/ на диске (локальная разработка).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BYTES = 4 * 1024 * 1024
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  let file: File | null = null
  try {
    const fd = await request.formData()
    const f = fd.get('file')
    file = f instanceof File ? f : null
  } catch {
    return fail('BAD_FORM')
  }
  if (!file) return fail('NO_FILE')
  if (file.size > MAX_BYTES) return fail('TOO_BIG')
  const ext = TYPES[file.type]
  if (!ext) return fail('BAD_TYPE')

  const name = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supaUrl && supaKey) {
    const { createClient } = await import('@supabase/supabase-js')
    const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } })
    const { error } = await supa.storage
      .from('images')
      .upload(`uploads/${name}`, bytes, { contentType: file.type, upsert: false })
    if (error) {
      console.error('[api/admin/upload] storage error:', error)
      return fail('FS_ERROR', 500)
    }
    const { data } = supa.storage.from('images').getPublicUrl(`uploads/${name}`)
    return NextResponse.json({ ok: true, url: data.publicUrl })
  }

  if (process.env.VERCEL) return fail('READONLY_FS', 500)
  try {
    const dir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, name), bytes)
    return NextResponse.json({ ok: true, url: `/uploads/${name}` })
  } catch (e) {
    console.error('[api/admin/upload] fs error:', e)
    return fail('FS_ERROR', 500)
  }
}
