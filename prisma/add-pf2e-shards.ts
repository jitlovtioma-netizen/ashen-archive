// ============================================================================
// МИГРАЦИЯ v4.6: три новых осколка памяти PF2E
//
// Добавляет осколки без пересева базы (прод-Supabase не трогаем сидом):
//   • Асмодей  (Божества)      → «контракт»  (Осколок Контракта)
//   • Фаразма  (Божества)      → «смерть»    (Осколок Смерти)
//   • Ароден   (Основной Лор)  → «надежда»   (Осколок Надежды)
//
// После этого в Голарионе 6 осколков; вкладка «Секреты» PF2E открывается
// с 5 собранных (шестой — бонус). ИЗМЕНЕНИЙ СХЕМЫ НЕТ — db:push не нужен.
//
// Идемпотентно: повторный запуск ничего не ломает.
// Запуск: bun run db:add-pf2e-shards   (в папке проекта, с .env прод-базы)
// ============================================================================

import { db } from '../src/lib/db'

const SHARDS: Array<{ title: string; system: string; shardWord: string }> = [
  { title: 'Асмодей', system: 'PF2E', shardWord: 'контракт' },
  { title: 'Фаразма', system: 'PF2E', shardWord: 'смерть' },
  { title: 'Ароден — Бог Человечества', system: 'PF2E', shardWord: 'надежда' },
]

async function main() {
  console.log('▸ Добавление осколков памяти PF2E (Асмодей/Фаразма/Ароден)...')
  let changed = 0

  for (const s of SHARDS) {
    const lore = await db.lore.findFirst({
      where: { title: s.title, system: s.system },
    })
    if (!lore) {
      console.warn(`  ⚠ запись не найдена: «${s.title}» (${s.system}) — пропущена`)
      continue
    }
    if (lore.shardWord === s.shardWord) {
      console.log(`  • уже установлен: «${s.title}» → ${s.shardWord}`)
      continue
    }
    if (lore.shardWord) {
      console.warn(
        `  ⚠ у «${s.title}» уже есть другой осколок «${lore.shardWord}» — не трогаю`,
      )
      continue
    }
    await db.lore.update({
      where: { id: lore.id },
      data: { shardWord: s.shardWord },
    })
    console.log(`  ✓ «${s.title}» → осколок «${s.shardWord}»`)
    changed++
  }

  const rows = await db.lore.findMany({
    where: { system: 'PF2E', shardWord: { not: null } },
    select: { title: true, shardWord: true },
  })
  console.log(`\n▸ Итог: изменено записей ${changed}. Осколки PF2E в базе (${rows.length}):`)
  rows
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    .forEach((r) => console.log(`    🧩 ${r.title} → «${r.shardWord}»`))
  console.log('▸ Готово.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
