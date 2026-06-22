import { getLearnedMappings, saveLearnedMapping, type LearnedMapping } from '../repositories/learnedMappingRepository'
import type { Transaction, TransactionType } from '@paisa-buddy/shared/types/transaction'

export type SuggestionSource = 'learned' | 'keyword' | 'unknown'

export type CategorySuggestion = {
  category: string | null
  displayName: string | null
  transactionType: TransactionType | null
  source: SuggestionSource
  mapping: LearnedMapping | null
}

const KEYWORD_RULES: Array<{ keywords: string[]; category: string; type?: TransactionType }> = [
  { keywords: ['zomato', 'swiggy', 'kfc', 'dominos'], category: 'Food' },
  { keywords: ['zerodha', 'groww', 'upstox'], category: 'Investment' },
  { keywords: ['netflix', 'prime', 'hotstar'], category: 'Entertainment' },
  { keywords: ['hpcl', 'bpcl', 'iocl', 'petrol'], category: 'Transport' },
  { keywords: ['salary', 'sal credit'], category: 'Income', type: 'credit' },
  { keywords: ['rent', 'house rent'], category: 'Rent' },
  { keywords: ['apple services', 'icloud', 'spotify', 'subscription'], category: 'Subscriptions' },
]

export function keywordSuggestion(text: string | null | undefined): Pick<CategorySuggestion, 'category' | 'transactionType' | 'source'> {
  const normalized = (text ?? '').toLowerCase()
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return { category: rule.category, transactionType: rule.type ?? null, source: 'keyword' }
    }
  }
  return { category: null, transactionType: null, source: 'unknown' }
}

export async function suggestForImportRows<T extends {
  normalized_lookup_key?: string | null
  parsed_display_name?: string | null
  description?: string | null
  type?: TransactionType
}>(rows: T[]): Promise<Array<T & { suggestion: CategorySuggestion }>> {
  const mappings = await getLearnedMappings(rows.map((row) => row.normalized_lookup_key ?? ''))
  return rows.map((row) => {
    const mapping = row.normalized_lookup_key ? mappings.get(row.normalized_lookup_key) ?? null : null
    if (mapping) {
      return {
        ...row,
        suggestion: {
          category: mapping.category_id,
          displayName: mapping.display_name,
          transactionType: mapping.transaction_type,
          source: 'learned',
          mapping,
        },
      }
    }

    const keyword = keywordSuggestion(`${row.parsed_display_name ?? ''} ${row.description ?? ''}`)
    return {
      ...row,
      suggestion: {
        category: keyword.category,
        displayName: null,
        transactionType: keyword.transactionType,
        source: keyword.source,
        mapping: null,
      },
    }
  })
}

export async function loadSuggestionsForGroups<T extends {
  key: string
  displayName: string
  transactions: Transaction[]
}>(groups: T[]): Promise<Array<T & { suggestion: string | null; suggestionSource: SuggestionSource }>> {
  const mappings = await getLearnedMappings(groups.map((g) => g.key))
  return groups.map((group) => {
    const mapping = mappings.get(group.key)
    if (mapping) {
      return {
        ...group,
        displayName: mapping.display_name || group.displayName,
        suggestion: mapping.category_id,
        suggestionSource: 'learned',
      }
    }

    const keyword = keywordSuggestion(
      `${group.displayName} ${group.transactions.map((tx) => tx.description).join(' ')}`,
    )
    return {
      ...group,
      suggestion: keyword.category,
      suggestionSource: keyword.source,
    }
  })
}

export async function saveSuggestion(
  key: string,
  category: string,
  displayName?: string | null,
  transactionType?: TransactionType | null,
): Promise<void> {
  await saveLearnedMapping({
    normalizedLookupKey: key,
    categoryId: category,
    displayName,
    transactionType,
  })
}
