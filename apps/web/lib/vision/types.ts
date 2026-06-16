import type { ParsedReceipt } from '@paisa-buddy/shared/types/receipt'

export interface OwnerContext {
  displayName?: string | null
  upiIds?: string[]
}

export interface VisionProvider {
  parseReceipt(
    imageBase64: string,
    mimeType: string,
    owner?: OwnerContext,
  ): Promise<ParsedReceipt>
}
