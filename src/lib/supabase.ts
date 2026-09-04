// ============================================================================
// Storage helper — локальный режим (sandbox без Supabase).
// В деплое на Vercel здесь был createClient из @supabase/supabase-js.
// В песочнице картинки лежат в /public, поэтому отдаём локальные пути.
// ============================================================================

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

// Supabase-клиент недоступен в sandbox-режиме — экспортируем null.
// Если когда-то понадобится реальный клиент — установи @supabase/supabase-js
// и раскомментируй код ниже.
export const supabase = null

// Хелпер: публичный URL объекта. Если Supabase не настроен — отдаём /public-путь.
export function publicImageUrl(path: string): string {
  if (!SUPA_URL) return `/${path}`
  return `${SUPA_URL}/storage/v1/object/public/images/${path}`
}
