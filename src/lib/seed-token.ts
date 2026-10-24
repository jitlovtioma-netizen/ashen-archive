import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// SEED-TOKEN — короткоживущие подписанные ссылки на скачивание seed.zip.
//
// Архив содержит БД с паролями, поэтому просто положить его в public/
// нельзя (а в v5.7.1 это стало и технически невозможно: dev-вотчер Next.js
// стирает файлы из public/ — «фантом», см. scripts/make-seed-zip.mjs).
// Вместо этого:
//   1. админ просит ссылку: GET /api/admin/make-seed?issue=1
//      → { url: "/api/seed?t=<login>.<exp>.<hmac>" } (живает 15 минут);
//   2. браузер скачивает по ней: GET /api/seed?t=…
//      → проверка подписи HMAC + срока + что login всё ещё админ.
//
// Подпись HMAC-SHA256 секретом из seed-archive/.seed-secret (создаётся
// при первом выпуске токена; в сам архив НЕ попадает и в git НЕ входит).
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_TTL_MS = 15 * 60 * 1000

function secretPath(): string {
  return join(process.cwd(), 'seed-archive', '.seed-secret')
}

let cachedSecret: Buffer | null = null

function getSecret(): Buffer {
  if (cachedSecret && cachedSecret.length >= 32) return cachedSecret
  const p = secretPath()
  if (existsSync(p)) {
    const raw = readFileSync(p, 'utf-8').trim()
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      cachedSecret = Buffer.from(raw, 'hex')
      return cachedSecret
    }
  }
  // секрета ещё нет (первый запуск) — генерируем и прячем рядом с архивом
  const fresh = randomBytes(32).toString('hex')
  const dir = join(process.cwd(), 'seed-archive')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(p, fresh, { mode: 0o600 })
  cachedSecret = Buffer.from(fresh, 'hex')
  return cachedSecret
}

function hmac(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

/** Выпустить токен для админа `login` (живёт TOKEN_TTL_MS). */
export function issueSeedToken(login: string): { url: string; exp: number } {
  const exp = Date.now() + TOKEN_TTL_MS
  const payload = `${login}.${exp}`
  const token = `${payload}.${hmac(payload)}`
  return { url: `/api/seed?t=${encodeURIComponent(token)}`, exp }
}

/**
 * Проверить токен. Возвращает login владельца или null
 * (просрочен / подпись не сходится / кривой формат).
 */
export function verifySeedToken(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [login, expRaw, sig] = parts
  const exp = Number(expRaw)
  if (!login || !Number.isFinite(exp) || exp < Date.now()) return null
  const expected = hmac(`${login}.${expRaw}`)
  if (expected.length !== sig.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
  } catch {
    return null
  }
  return login
}
