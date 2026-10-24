import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@prisma/client'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// АВТОРИЗАЦИЯ — сессия в подписанной httpOnly-cookie + хеши паролей (scrypt).
//
// Раньше сервер верил полю `requester` из запроса: кто знал логин админа,
// получал все его права. Теперь личность берётся ТОЛЬКО из cookie, которую
// выдаёт /api/auth/login после проверки пароля. Поле `requester` в старых
// клиентских запросах просто игнорируется.
//
// Секрет подписи: SESSION_SECRET (рекомендуется задать в Vercel). Если его
// нет — выводится из DATABASE_URL, который и так секретный, чтобы деплой
// не ломался до настройки переменной.
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = 'ashen_session'
const SESSION_TTL_S = 60 * 60 * 24 * 30 // 30 дней

let cachedSecret: Buffer | null = null
function secret(): Buffer {
  if (cachedSecret) return cachedSecret
  const raw =
    process.env.SESSION_SECRET ||
    createHash('sha256').update(`ashen-session:${process.env.DATABASE_URL ?? 'dev'}`).digest('hex')
  cachedSecret = Buffer.from(raw)
  return cachedSecret
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** Токен сессии: base64url(login).exp.signature */
function makeToken(login: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S
  const payload = `${Buffer.from(login).toString('base64url')}.${exp}`
  return `${payload}.${sign(payload)}`
}

function readToken(token: string | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [loginB64, expRaw, sig] = parts
  if (!safeEqual(sign(`${loginB64}.${expRaw}`), sig)) return null
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null
  const login = Buffer.from(loginB64, 'base64url').toString()
  return login || null
}

export function setSessionCookie(res: NextResponse, login: string): void {
  res.cookies.set(SESSION_COOKIE, makeToken(login), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_S,
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

/** Пользователь текущей сессии (свежий из БД) или null. */
export async function getSessionUser(req: NextRequest): Promise<User | null> {
  const login = readToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (!login) return null
  return db.user.findUnique({ where: { login } })
}

type Guard = { user: User; error?: undefined } | { user?: undefined; error: NextResponse }

/** Требует вход. Возвращает пользователя или готовый ответ 401. */
export async function requireUser(req: NextRequest): Promise<Guard> {
  const user = await getSessionUser(req)
  if (!user) {
    return { error: NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }) }
  }
  return { user }
}

/** Требует роль ADMIN. Возвращает пользователя или готовый ответ 401/403. */
export async function requireAdmin(req: NextRequest): Promise<Guard> {
  const g = await requireUser(req)
  if (g.error) return g
  if (g.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 }) }
  }
  return g
}

// ── Пароли ───────────────────────────────────────────────────────────────────
// Формат хеша: scrypt$<salt hex>$<hash hex>. Строка без префикса считается
// старым открытым паролем — она принимается один раз и сразу перехешируется.

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>
const HASH_PREFIX = 'scrypt$'

export function isHashed(stored: string): boolean {
  return stored.startsWith(HASH_PREFIX)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `${HASH_PREFIX}${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isHashed(stored)) return safeEqual(password, stored)
  const [, saltHex, hashHex] = stored.split('$')
  if (!saltHex || !hashHex) return false
  const hash = await scryptAsync(password, Buffer.from(saltHex, 'hex'), 64)
  const expected = Buffer.from(hashHex, 'hex')
  return hash.length === expected.length && timingSafeEqual(hash, expected)
}

/** Публичная часть пользователя для клиента. */
export function publicUser(u: User) {
  return {
    login: u.login,
    displayName: u.displayName,
    system: u.system,
    role: u.role === 'ADMIN' ? ('ADMIN' as const) : ('USER' as const),
    characterId: u.characterId ?? null,
  }
}
