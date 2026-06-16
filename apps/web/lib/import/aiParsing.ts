import 'server-only'
import OpenAI from 'openai'
import { z } from 'zod'

export const STATEMENT_PROMPT = `Extract all transactions from this bank statement. Return ONLY a JSON array, no markdown, no explanation.

[{"date":"YYYY-MM-DD","amount":number,"type":"debit|credit","description":string,"reference":string|null}]

Rules:
- date: normalize to YYYY-MM-DD
- amount: positive number in rupees (no symbols, no commas), e.g. 1234.56
- type: "debit" for money leaving the account, "credit" for money received
- description: narration/particulars exactly as in the statement
- reference: UPI ref / transaction ID / cheque number if present, else null
- EXCLUDE summary rows (Opening Balance, Closing Balance, Total, etc.)
- Include ALL transaction rows in chronological order`

const TxSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  amount: z.number().positive(),
  type: z.enum(['debit', 'credit']),
  description: z.string(),
  reference: z.string().nullable(),
})

export type ParsedAITransaction = z.infer<typeof TxSchema>

let _openai: OpenAI | null = null
function getClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
    _openai = new OpenAI({ apiKey })
  }
  return _openai
}

/** Parse a bank statement from plain text (e.g. extracted from an encrypted PDF). */
export async function parseStatementText(text: string): Promise<ParsedAITransaction[]> {
  const completion = await getClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `${STATEMENT_PROMPT}\n\nBank statement text:\n\n${text}`,
      },
    ],
    temperature: 0,
    max_tokens: 16384,
  })

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) throw new Error('Empty response from AI')

  let rawJson: unknown
  try {
    const match = content.match(/\[[\s\S]*\]/)
    rawJson = JSON.parse(match ? match[0] : content)
  } catch {
    throw new Error(`AI returned non-JSON: ${content.slice(0, 200)}`)
  }

  const parsed = z.array(TxSchema).safeParse(rawJson)
  if (!parsed.success) throw new Error(`AI response structure invalid: ${parsed.error.message}`)
  return parsed.data
}

/** Parse a bank statement from a PDF supplied as base64. */
export async function parseStatementPdf(
  base64: string,
  filename: string,
): Promise<ParsedAITransaction[]> {
  const fileContentPart = {
    type: 'file' as const,
    file: { filename, file_data: `data:application/pdf;base64,${base64}` },
  }

  const completion = await getClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [{ type: 'text' as const, text: STATEMENT_PROMPT }, fileContentPart as any],
      },
    ],
    temperature: 0,
    max_tokens: 16384,
  })

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) throw new Error('Empty response from AI')

  let rawJson: unknown
  try {
    const match = content.match(/\[[\s\S]*\]/)
    rawJson = JSON.parse(match ? match[0] : content)
  } catch {
    throw new Error(`AI returned non-JSON: ${content.slice(0, 200)}`)
  }

  const parsed = z.array(TxSchema).safeParse(rawJson)
  if (!parsed.success) throw new Error(`AI response structure invalid: ${parsed.error.message}`)
  return parsed.data
}
