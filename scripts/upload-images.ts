// ============================================================================
// UPLOAD IMAGES: загружает все картинки из public/heroes, public/gods
// и видео из public/videos в Supabase Storage bucket "images".
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

// MIME-типы для всех поддерживаемых расширений
function getContentType(ext: string): string {
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    case 'mp4': return 'video/mp4'
    case 'webm': return 'video/webm'
    case 'ogg': return 'video/ogg'
    default: return 'application/octet-stream'
  }
}

async function uploadDir(localDir: string, prefix: string, isVideo = false) {
  const dirPath = join(PUBLIC_DIR, localDir)
  if (!existsSync(dirPath)) {
    console.log(`⊘ Папка ${localDir} не найдена — пропуск`)
    return
  }

  // Для картинок: png/jpg/jpeg/webp/gif, для видео: mp4/webm/ogg
  const extRegex = isVideo
    ? /\.(mp4|webm|ogg)$/i
    : /\.(png|jpg|jpeg|webp|gif)$/i

  const files = readdirSync(dirPath).filter((f) => extRegex.test(f))

  console.log(`▸ Загрузка ${files.length} ${isVideo ? 'видео' : 'файлов'} из ${localDir}/ → ${prefix}/`)

  for (const file of files) {
    const localPath = join(dirPath, file)
    const objectPath = `${prefix}/${file}`
    const buf = readFileSync(localPath)

    const ext = file.split('.').pop()?.toLowerCase() || ''
    const contentType = getContentType(ext)

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
      fileSizeLimit: '50MB', // увеличено для видео
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
    // Обновляем лимит размера если нужно (для видео)
    const { error: updateErr } = await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: '50MB',
    })
    if (updateErr) {
      console.log(`  ⚠ Не удалось обновить лимит размера: ${updateErr.message}`)
    } else {
      console.log(`  ✓ Лимит размера: 50MB`)
    }
  }
}

async function main() {
  console.log('══════════════════════════════════════════════')
  console.log('  ЗАГРУЗКА МЕДИА В SUPABASE STORAGE')
  console.log('══════════════════════════════════════════════')
  console.log(`  URL:   ${url}`)
  console.log(`  Bucket: ${BUCKET}`)
  console.log('────────────────────────────────────────────────')

  await ensureBucket()
  console.log('────────────────────────────────────────────────')

  await uploadDir('heroes', 'heroes')
  await uploadDir('gods', 'gods')
  await uploadDir('videos', 'videos', true)

  console.log('────────────────────────────────────────────────')
  console.log('✓ Готово. Публичные URL теперь доступны.')
  console.log('  Картинки: /heroes/*.png, /gods/*.png')
  console.log('  Видео:    /videos/*.mp4')
  console.log('  Теперь можно запустить: bun run db:seed')
  console.log('────────────────────────────────────────────────')
}

main().catch((e) => {
  console.error('✘ Upload failed:', e)
  process.exit(1)
})
