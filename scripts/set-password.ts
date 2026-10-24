// Смена пароля стража напрямую в БД (по DATABASE_URL из .env).
//   bun scripts/set-password.ts <login> <новый пароль>
// Пароль сохраняется хешем (scrypt) — в том же формате, что и src/lib/auth.ts.
import { randomBytes, scryptSync } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const [login, password] = process.argv.slice(2)
if (!login || !password) {
  console.error('Использование: bun scripts/set-password.ts <login> <новый пароль>')
  process.exit(1)
}

const db = new PrismaClient()
const salt = randomBytes(16)
const hash = `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`

try {
  await db.user.update({ where: { login }, data: { password: hash } })
  console.log(`✓ Пароль для «${login}» обновлён`)
} catch {
  console.error(`✗ Пользователь «${login}» не найден`)
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
