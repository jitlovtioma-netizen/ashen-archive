import { createClient } from '@supabase/supabase-js'

// ============================================================================
// Supabase server-side client.
// Используется ТОЛЬКО в server-side коде (API routes, seed, scripts).
// В клиентских компонентах этот файл не импортировать — там нужен public anon
// key с отдельным клиентом (если потребуется).
//
// SERVICE_ROLE_KEY обходит RLS — никогда не коммить и не свети в браузере.
// ============================================================================

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  // Не падаем при импорте (чтобы seed работал локально без Supabase как fallback),
  // но экспортируем null и проверяем в точках использования.
  console.warn(
    '⚠️  Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). ' +
      'Storage functions will be unavailable.'
  )
}

export const supabase =
  url && serviceKey ? createClient(url, serviceKey) : null

// Хелпер: публичный URL объекта в bucket "images"
export function publicImageUrl(path: string): string {
  if (!url) return `/${path}` // fallback на /public
  return `${url}/storage/v1/object/public/images/${path}`
}
