// Правки данных v5.8 (по DATABASE_URL из .env).
// Досье Кали:
//   • текст в ирисе + «Цикл», отношения «неизвестно»;
//   • статус «пропала» вместо «запечатана»;
//   • новый арт: если заданы NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY,
//     картинка public/heroes/kali.jpg заливается в Supabase Storage (bucket images).
// Запись помечается userModified, чтобы seed её больше не трогал.
// Тей-Мегьдос: убрать ссылку на несуществующий арт tey.png.
//   bun scripts/data-fixes.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  KALI_CATEGORY,
  KALI_DESCRIPTION,
  KALI_FRIENDSHIP,
  KALI_IMAGE,
  KALI_STATUS,
} from '../prisma/kali'

async function imageUrl(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return `/${KALI_IMAGE}`
  const { createClient } = await import('@supabase/supabase-js')
  const supa = createClient(url, key, { auth: { persistSession: false } })
  const bytes = readFileSync(join(process.cwd(), 'public', KALI_IMAGE))
  const { error } = await supa.storage
    .from('images')
    .upload(KALI_IMAGE, bytes, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Не удалось загрузить арт в Supabase: ${error.message}`)
  console.log('✓ Арт загружен в Supabase Storage')
  return `${url}/storage/v1/object/public/images/${KALI_IMAGE}`
}

const db = new PrismaClient()
try {
  const res = await db.lore.updateMany({
    where: { title: 'Кали', system: 'DND' },
    data: {
      description: KALI_DESCRIPTION,
      friendship: KALI_FRIENDSHIP,
      category: KALI_CATEGORY,
      status: KALI_STATUS,
      imageUrl: await imageUrl(),
      userModified: true,
    },
  })
  console.log(res.count ? `✓ Досье Кали обновлено (${res.count})` : '✗ Досье Кали не найдено')

  const tey = await db.lore.updateMany({
    where: { title: 'Тей-Мегьдос', imageUrl: { contains: 'tey.png' } },
    data: { imageUrl: null },
  })
  console.log(tey.count ? '✓ Тей-Мегьдос: битая ссылка на арт убрана' : '= Тей-Мегьдос: править нечего')
} finally {
  await db.$disconnect()
}
