import { getDb } from '../db/database'
import { generateId } from '../lib/id'

export type ReviewSession = {
  id: string
  import_session_id: string | null
  current_group_id: string | null
  current_item_id: string | null
  review_progress: number
  total_count: number
  review_status: 'active' | 'completed'
  created_at: string
  updated_at: string
}

export async function getActiveReviewSession(): Promise<ReviewSession | null> {
  const db = getDb()
  return db.getFirstAsync<ReviewSession>(
    "SELECT * FROM review_sessions WHERE review_status = 'active' ORDER BY updated_at DESC LIMIT 1",
  )
}

export async function ensureActiveReviewSession(totalCount: number, importSessionId?: string | null): Promise<ReviewSession> {
  const db = getDb()
  const active = await getActiveReviewSession()
  const now = new Date().toISOString()
  if (active) {
    await db.runAsync(
      `UPDATE review_sessions
       SET total_count = MAX(total_count, ?),
           import_session_id = COALESCE(import_session_id, ?),
           updated_at = ?
       WHERE id = ?`,
      [totalCount, importSessionId ?? null, now, active.id],
    )
    return { ...active, total_count: Math.max(active.total_count, totalCount), import_session_id: active.import_session_id ?? importSessionId ?? null, updated_at: now }
  }

  const id = generateId()
  await db.runAsync(
    `INSERT INTO review_sessions
      (id, import_session_id, review_progress, total_count, review_status, created_at, updated_at)
     VALUES (?, ?, 0, ?, 'active', ?, ?)`,
    [id, importSessionId ?? null, totalCount, now, now],
  )
  return {
    id,
    import_session_id: importSessionId ?? null,
    current_group_id: null,
    current_item_id: null,
    review_progress: 0,
    total_count: totalCount,
    review_status: 'active',
    created_at: now,
    updated_at: now,
  }
}

export async function updateReviewSessionProgress(input: {
  id: string
  currentGroupId?: string | null
  currentItemId?: string | null
  reviewProgress: number
  totalCount: number
}): Promise<void> {
  const db = getDb()
  await db.runAsync(
    `UPDATE review_sessions
     SET current_group_id = ?,
         current_item_id = ?,
         review_progress = ?,
         total_count = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      input.currentGroupId ?? null,
      input.currentItemId ?? null,
      input.reviewProgress,
      input.totalCount,
      new Date().toISOString(),
      input.id,
    ],
  )
}

export async function completeReviewSession(id: string): Promise<void> {
  const db = getDb()
  await db.runAsync(
    "UPDATE review_sessions SET review_status = 'completed', updated_at = ? WHERE id = ?",
    [new Date().toISOString(), id],
  )
}
