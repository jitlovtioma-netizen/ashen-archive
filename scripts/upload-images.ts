// ============================================================================
// UPLOAD IMAGES: загружает все картинки из public/heroes и public/gods
// в Supabase Storage bucket "images".
//
// Запуск (один раз после создания проекта Supabase):
//   1. Создай bucket "images" (public) в Supabase Storage
//   2. Заполни .env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
//   3. bun run upload-images
//
// Скрипт идемпотентен (upsert: true) — можно запускать повторно.
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    '✘ Не заданы NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY.\n' +
      '  Скопируй .env.example в .env и заполни значения из Supabase Dashboard.'
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const BUCKET = 'images'
const PUBLIC_DIR = join(process.cwd(), 'public')

async function uploadDir(localDir: string, prefix: string) {
  const dirPath = join(PUBLIC_DIR, localDir)
  if (!existsSync(dirPath)) {
    console.log(`⊘ Папка ${localDir} не найдена — пропуск`)
    return
  }

  const files = readdirSync(dirPath).filter((f) =>
    /\.(png|jpg|jpeg|webp|gif)$/i.test(f)
  )

  console.log(`▸ Загрузка ${files.length} файлов из ${localDir}/ → ${prefix}/`)

  for (const file of files) {
    const localPath = join(dirPath, file)
    const objectPath = `${prefix}/${file}`
    const buf = readFileSync(localPath)

    const ext = file.split('.').pop()?.toLowerCase()
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
              ? 'image/gif'
              : 'application/octet-stream'

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buf, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.error(`  ✗ ${file}: ${error.message}`)
    } else {
      const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${objectPath}`
      console.log(`  ✓ ${objectPath} → ${publicUrl}`)
    }
  }
}

async function ensureBucket() {
  // Проверяем существование bucket
  const { data, error } = await supabase.storage.getBucket(BUCKET)
  if (error && error.message.includes('not found')) {
    console.log(`▸ Bucket "${BUCKET}" не найден — создаём (public)...`)
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '10MB',
    })
    if (createErr) {
      console.error('✘ Не удалось создать bucket:', createErr.message)
      process.exit(1)
    }
    console.log(`✓ Bucket "${BUCKET}" создан`)
  } else if (error) {
    console.error('✘ Ошибка проверки bucket:', error.message)
    process.exit(1)
  } else {
    console.log(`✓ Bucket "${BUCKET}" существует`)
  }
}

async function main() {
  console.log('══════════════════════════════════════════════')
  console.log('  ЗАГРУЗКА КАРТИНОК В SUPABASE STORAGE')
  console.log('══════════════════════════════════════════════')
  console.log(`  URL:   ${url}`)
  console.log(`  Bucket: ${BUCKET}`)
  console.log('────────────────────────────────────────────────')

  await ensureBucket()
  console.log('────────────────────────────────────────────────')

  await uploadDir('heroes', 'heroes')
  await uploadDir('gods', 'gods')

  console.log('────────────────────────────────────────────────')
  console.log('✓ Готово. Публичные URL картинок теперь доступны.')
  console.log('  Теперь можно запустить: bun run db:seed')
  console.log('────────────────────────────────────────────────')
}

main().catch((e) => {
  console.error('✘ Upload failed:', e)
  process.exit(1)
})
