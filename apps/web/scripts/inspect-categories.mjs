import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
try {
  const cols = await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'categories' ORDER BY ordinal_position`
  console.log('Columns:', cols)
  const constraints = await sql`SELECT conname, contype FROM pg_constraint WHERE conrelid = 'categories'::regclass`
  console.log('Constraints:', constraints)
  const rows = await sql`SELECT * FROM categories`
  console.log('Rows:', rows)
} finally {
  await sql.end()
}
