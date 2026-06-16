import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// SecureStore has a 2048-byte key length limit — chunk large session values.
const CHUNK_SIZE = 1800
const CHUNK_KEY_PREFIX = '_chunk_'

async function setLargeItem(key: string, value: string): Promise<void> {
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value)
    return
  }
  const chunks = Math.ceil(value.length / CHUNK_SIZE)
  await SecureStore.setItemAsync(`${CHUNK_KEY_PREFIX}${key}_count`, String(chunks))
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(
      `${CHUNK_KEY_PREFIX}${key}_${i}`,
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    )
  }
}

async function getLargeItem(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(`${CHUNK_KEY_PREFIX}${key}_count`)
  if (!countStr) {
    return SecureStore.getItemAsync(key)
  }
  const count = parseInt(countStr, 10)
  const chunks: string[] = []
  for (let i = 0; i < count; i++) {
    const chunk = await SecureStore.getItemAsync(`${CHUNK_KEY_PREFIX}${key}_${i}`)
    if (!chunk) return null
    chunks.push(chunk)
  }
  return chunks.join('')
}

async function deleteLargeItem(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${CHUNK_KEY_PREFIX}${key}_count`)
  if (countStr) {
    const count = parseInt(countStr, 10)
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${CHUNK_KEY_PREFIX}${key}_${i}`)
    }
    await SecureStore.deleteItemAsync(`${CHUNK_KEY_PREFIX}${key}_count`)
  } else {
    await SecureStore.deleteItemAsync(key)
  }
}

const secureStoreAdapter = {
  getItem: getLargeItem,
  setItem: setLargeItem,
  removeItem: deleteLargeItem,
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
