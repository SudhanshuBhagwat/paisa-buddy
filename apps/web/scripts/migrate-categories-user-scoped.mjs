import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL, { max: 1 })

try {
  // Find the existing user_id from user_settings (single user app)
  const users = await sql`SELECT user_id FROM user_settings LIMIT 1`
  if (users.length === 0) {
    console.error('No user found in user_settings — aborting')
    process.exit(1)
  }
  const userId = users[0].user_id
  console.log(`Found user: ${userId}`)

  // 1. Drop FK from transactions.category → categories.name (predefined cats leaving DB)
  await sql`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_fkey`
  console.log('✓ Dropped transactions_category_fkey FK')

  // 2. Delete predefined categories (they live in code now)
  const deleted = await sql`DELETE FROM categories WHERE is_predefined = true RETURNING name`
  console.log(`✓ Deleted ${deleted.length} predefined categories from DB`)

  // 2. Add user_id column (nullable first so we can backfill)
  await sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id TEXT`
  console.log('✓ Added user_id column')

  // 3. Assign existing custom categories to the user
  const assigned = await sql`
    UPDATE categories SET user_id = ${userId} WHERE user_id IS NULL RETURNING name
  `
  console.log(`✓ Assigned ${assigned.length} existing custom categories to user`)
  assigned.forEach(r => console.log(`  ${r.name}`))

  // 4. Make user_id NOT NULL now that backfill is done
  await sql`ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL`
  console.log('✓ Made user_id NOT NULL')

  // 5. Drop the old unique constraint on name (was global)
  await sql`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key`
  console.log('✓ Dropped old unique constraint (name)')

  // 6. Add new unique constraint on (user_id, name)
  await sql`ALTER TABLE categories ADD CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name)`
  console.log('✓ Added unique constraint (user_id, name)')

  // 7. Drop is_predefined column (table only holds custom categories now)
  await sql`ALTER TABLE categories DROP COLUMN IF EXISTS is_predefined`
  console.log('✓ Dropped is_predefined column')

  console.log('\nFinal table contents:')
  const rows = await sql`SELECT name, user_id, color FROM categories ORDER BY name`
  rows.forEach(r => console.log(`  ${r.name} | ${r.user_id} | ${r.color}`))
} finally {
  await sql.end()
}
