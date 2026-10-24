// ============================================================================
// DB DIAGNOSTICS — превращает ошибку Prisma в понятную подсказку.
//
// Зачем: при деплое на Vercel + Supabase самая частая поломка — все API
// отдают HTTP 500, а в UI только «Не удалось получить данные». Причины
// типовые (schema=sqlite при postgres-URL, нет DATABASE_URL, недоступна
// база, нет таблиц) — этот хелпер возвращает готовую инструкцию, которую
// видно прямо в ответе API (открой /api/stats?system=DND в браузере)
// и в логах Vercel.
// ============================================================================

export function dbHint(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "")

  // Провайдер схемы не совпадает с протоколом ссылки.
  // Пример: schema=sqlite + DATABASE_URL=postgresql://... (или наоборот).
  if (msg.includes("must start with the protocol")) {
    return (
      "Провайдер Prisma не совпадает с DATABASE_URL. " +
      'На Vercel+Supabase в prisma/schema.prisma должно быть provider = "postgresql" ' +
      "(см. README.md, раздел «Деплой»)."
    )
  }

  // Переменная окружения не задана вовсе.
  if (msg.includes("Environment variable not found")) {
    return (
      "Не задана переменная DATABASE_URL. Vercel → Settings → Environment " +
      "Variables → добавь Supabase pooler-ссылку (порт 6543, " +
      "?pgbouncer=true&connection_limit=1) и сделай Redeploy."
    )
  }

  // База недоступна (P1000/P1001) — неверный хост/порт/пароль или пулер.
  if (msg.includes("P1001") || msg.includes("Can't reach") || msg.includes("reach database")) {
    return (
      "База недоступна: проверь DATABASE_URL. Для Vercel нужен Supabase " +
      "transaction pooler (порт 6543) с ?pgbouncer=true&connection_limit=1."
    )
  }

  // Таблицы не созданы (P2021/P2022) — забыли prisma db push + сид.
  if (msg.includes("P2021") || msg.includes("P2022") || msg.includes("does not exist")) {
    return (
      "В базе нет таблиц. Локально: bun run db:use-postgres, в .env — direct-ссылка " +
      "Supabase (5432), затем bunx prisma db push && bun run db:seed && " +
      "bun run prisma/bind-characters.ts (см. README.md)."
    )
  }

  // Supabase pooler + prepared statements (нет pgbouncer=true).
  if (msg.includes("prepared statement") || msg.includes("P2034")) {
    return (
      "Конфликт prepared statements: добавь в DATABASE_URL параметры " +
      "?pgbouncer=true&connection_limit=1 (Supabase pooler + Prisma)."
    )
  }

  return "Неизвестная ошибка БД — смотри полный текст в логах (Vercel → Deployment → Logs)."
}
