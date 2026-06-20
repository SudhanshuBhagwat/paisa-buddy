import * as SecureStore from 'expo-secure-store'

const STORE_KEY = 'pb_cat_suggestions_v1'
type SuggestionMap = Record<string, string>

async function load(): Promise<SuggestionMap> {
  try {
    const json = await SecureStore.getItemAsync(STORE_KEY)
    return json ? (JSON.parse(json) as SuggestionMap) : {}
  } catch {
    return {}
  }
}

export async function saveSuggestion(key: string, category: string): Promise<void> {
  try {
    const map = await load()
    map[key] = category
    const entries = Object.entries(map)
    const trimmed = Object.fromEntries(entries.slice(-300))
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(trimmed))
  } catch {}
}

export async function loadSuggestionsForGroups<T extends { key: string }>(
  groups: T[],
): Promise<(T & { suggestion: string | null })[]> {
  const map = await load()
  return groups.map((g) => ({ ...g, suggestion: map[g.key] ?? null }))
}
