import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

try {
  await sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT`
  console.log('✓ Added color column')

  const result = await sql`
    UPDATE categories
    SET color = 'hsl(' || (floor(random() * 360)::int)::text || ', 40%, 70%)'
    WHERE is_predefined = false AND color IS NULL
    RETURNING name, color
  `
  console.log(`✓ Assigned colors to ${result.length} existing custom categories`)
  result.forEach(r => console.log(`  ${r.name} → ${r.color}`))
} finally {
  await sql.end()
}
