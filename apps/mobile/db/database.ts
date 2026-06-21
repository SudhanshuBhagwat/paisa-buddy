import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'
import { runMigrations } from './migrations'

let _db: SQLiteDatabase | null = null

export async function openDatabase(): Promise<SQLiteDatabase> {
  if (_db) return _db
  const db = await openDatabaseAsync('paisa_buddy.db')
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  await runMigrations(db)
  _db = db
  return db
}

export function getDb(): SQLiteDatabase {
  if (!_db) throw new Error('DB not initialized. Call openDatabase() first.')
  return _db
}
