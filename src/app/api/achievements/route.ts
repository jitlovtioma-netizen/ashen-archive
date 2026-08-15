import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/achievements
// Возвращает массив всех достижений (определения).
export async function GET() {
  const rows = await db.achievement.findMany({ orderBy: { code: 'asc' } })
  return Response.json(rows)
}
