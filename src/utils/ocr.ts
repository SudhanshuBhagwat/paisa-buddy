import { extractTextFromImage } from 'expo-text-extractor';
import type { OcrResult, TransactionType } from '@/types/transaction';

export async function extractReceiptData(imageUri: string): Promise<OcrResult> {
  const lines = await extractTextFromImage(imageUri);
  return parseReceiptText(lines);
}

// ─── Parsing ────────────────────────────────────────────────────────────────

function parseReceiptText(lines: string[]): OcrResult {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  const lower = clean.join(' ').toLowerCase();

  return {
    type: detectType(lower),
    amountRupees: extractAmount(clean),
    vendor: extractVendor(clean),
    date: extractDate(clean),
  };
}

// ─── Type detection ──────────────────────────────────────────────────────────

const EXPENSE_WORDS = [
  'debited', 'debit', ' dr ', 'dr.', 'paid to', 'you paid',
  'payment', 'purchase', 'sent to', 'transferred to', 'withdrawn', 'charged',
];
const INCOME_WORDS = [
  'credited', 'credit', ' cr ', 'cr.', 'received from', 'you received',
  'transferred from', 'added to', 'deposit', 'refund', 'cashback',
];

function detectType(lower: string): TransactionType | null {
  const exp = EXPENSE_WORDS.filter((w) => lower.includes(w)).length;
  const inc = INCOME_WORDS.filter((w) => lower.includes(w)).length;
  if (exp === 0 && inc === 0) return null;
  return exp >= inc ? 'expense' : 'income';
}

// ─── Amount extraction ───────────────────────────────────────────────────────

function extractAmount(lines: string[]): number | null {
  const text = lines.join(' ');

  // Priority 1: currency symbol before number — ₹1,234.56 / Rs. 1234 / INR 500
  const before = text.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (before) return toNumber(before[1]);

  // Priority 2: currency symbol after number — 1234.56₹
  const after = text.match(/([\d,]+(?:\.\d{2}))\s*(?:₹|Rs\.?|INR)/i);
  if (after) return toNumber(after[1]);

  // Priority 3: standalone line that is purely a currency amount
  for (const line of lines) {
    const m = line.match(/^₹?\s*([\d,]+\.\d{2})$/);
    if (m) return toNumber(m[1]);
  }

  return null;
}

function toNumber(str: string): number | null {
  const n = parseFloat(str.replace(/,/g, ''));
  return isFinite(n) && n > 0 ? n : null;
}

// ─── Vendor extraction ───────────────────────────────────────────────────────

const VENDOR_MARKERS = [
  /(?:paid to|payee|recipient|merchant)\s*[:\-]?\s*(.+)/i,
  /(?:received from)\s*[:\-]?\s*(.+)/i,
  /\bto\s*[:\-]\s*(.+)/i,
  /\bfrom\s*[:\-]\s*(.+)/i,
];

function extractVendor(lines: string[]): string | null {
  // Check explicit marker patterns on each line
  for (const line of lines) {
    for (const pattern of VENDOR_MARKERS) {
      const m = line.match(pattern);
      if (m) {
        const candidate = m[1].trim();
        if (candidate.length > 1 && candidate.length < 60) return candidate;
      }
    }
  }

  // Extract meaningful part from UPI ID (e.g. swiggy@sbi → Swiggy)
  for (const line of lines) {
    const upi = line.match(/([A-Za-z][A-Za-z0-9.\-_]{1,})\@[a-z]+/i);
    if (upi) {
      return titleCase(upi[1].replace(/[._-]/g, ' '));
    }
  }

  // First line that looks like a name
  for (const line of lines) {
    if (isVendorLike(line)) return line.trim();
  }

  return null;
}

function isVendorLike(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 50) return false;
  if (/^[\d₹,.%\-\/\+\(\)]+$/.test(t)) return false; // pure numbers/symbols
  if (/^\d{1,2}[\/\-]\d{1,2}/.test(t)) return false;  // looks like date
  if (/^(transaction|txn|ref|utr|upi|id|date|time|amount|balance|avl|a\/c|account|bank|ifsc)/i.test(t)) return false;
  return /[A-Z]/.test(t); // has at least one uppercase letter
}

function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Date extraction ─────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function extractDate(lines: string[]): string | null {
  const text = lines.join(' ');

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy4 = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmy4) {
    const [, d, m, y] = dmy4;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD MMM YYYY  /  DD MMM, YYYY  /  DD MMM'YY
  const named = text.match(
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,'\s]+(\d{2,4})\b/i
  );
  if (named) {
    const [, d, mon, y] = named;
    const month = MONTH_MAP[mon.slice(0, 3).toLowerCase()];
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${month}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YY or DD-MM-YY
  const dmy2 = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})\b/);
  if (dmy2) {
    const [, d, m, y] = dmy2;
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // ISO: YYYY-MM-DD
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  return null;
}
