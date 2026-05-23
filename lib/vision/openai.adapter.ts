import 'server-only'
import OpenAI from 'openai'
import { z } from 'zod'
import type { VisionProvider, OwnerContext } from './types'
import type { ParsedReceipt } from '../types/receipt'

const PROMPT = `You are a financial receipt parser for an Indian user.
Analyze this image and respond ONLY with a valid JSON object, no markdown, no explanation.

{
  "type": "debit" | "credit" | "transfer",
  "amount": number,
  "currency": "INR",
  "date": "YYYY-MM-DD",
  "time": "HH:MM" | null,
  "merchant": string | null,
  "description": string,
  "upi_ref": string | null,
  "bank": string | null,
  "category_hint": string | null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- debit = money leaving the account
- credit = money coming in
- transfer = between own accounts
- amount must be a number, no currency symbols
- If a field is unclear or not visible, set it to null
- Never guess the amount — if unreadable, set confidence to "low"
- date must be in YYYY-MM-DD format`

// AI returns amounts in rupees (e.g. 120.50); we store paise (12050)
const RawAIResponseSchema = z.object({
  type: z.enum(['debit', 'credit', 'transfer']),
  amount: z.number().positive(),
  currency: z.string().default('INR'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'time must be HH:MM')
    .nullable(),
  merchant: z.string().nullable(),
  description: z.string(),
  upi_ref: z.string().nullable(),
  bank: z.string().nullable(),
  category_hint: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
})

let _openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
    _openai = new OpenAI({ apiKey })
  }
  return _openai
}

export class OpenAIVisionProvider implements VisionProvider {
  async parseReceipt(
    imageBase64: string,
    mimeType: string,
    owner?: OwnerContext,
  ): Promise<ParsedReceipt> {
    const lines: string[] = []
    if (owner?.displayName) {
      lines.push(`The account owner's name is "${owner.displayName}".`)
    }
    if (owner?.upiIds && owner.upiIds.length > 0) {
      lines.push(`The account owner's UPI IDs are: ${owner.upiIds.join(', ')}.`)
    }
    if (lines.length > 0) {
      lines.push('If the owner (by name or UPI ID) is the sender/payer → type is "debit". If they are the receiver/payee → type is "credit".')
    }
    const prompt = lines.length > 0 ? `${PROMPT}\n\n${lines.join(' ')}` : PROMPT

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 512,
      temperature: 0,
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) throw new Error('Vision API returned empty response')

    let rawJson: unknown
    try {
      rawJson = JSON.parse(content)
    } catch {
      throw new Error(`Vision API response was not valid JSON: ${content.slice(0, 100)}`)
    }

    const parsed = RawAIResponseSchema.safeParse(rawJson)
    if (!parsed.success) {
      throw new Error(`Vision API response failed validation: ${parsed.error.message}`)
    }

    const raw = parsed.data
    return {
      type: raw.type,
      amount: Math.round(raw.amount * 100), // rupees → paise
      currency: raw.currency,
      date: raw.date,
      time: raw.time,
      merchant: raw.merchant,
      description: raw.description,
      upi_ref: raw.upi_ref,
      bank: raw.bank,
      category_hint: raw.category_hint,
      confidence: raw.confidence,
    }
  }
}
