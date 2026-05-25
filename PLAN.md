# Transaction Manager — Claude Code Implementation Plan

## How to Use This File

This file is the single source of truth for building this app. Claude Code must:

1. **Read this entire file before doing anything**
2. **Ask all clarifying questions for a phase before writing any code for it**
3. **Never assume — if something is ambiguous, ask**
4. **After each phase, summarise what was built and confirm before moving to the next**
5. **If a decision made in an earlier phase affects the current phase, flag it and re-confirm**

> The goal is zero surprises. 100 questions upfront is better than 10 bugs later.

---

## App Overview

A personal transaction manager web app (Next.js) that:
- Accepts receipt images from an Apple Shortcut (iOS) or HTTP Shortcuts app (Android) via a POST endpoint
- Parses them using GPT-4o mini vision API
- Imports bank statements (PDF — AI parsed, Excel — hybrid AI column detection + local parsing)
- Supports multi-account tracking
- Shows a Pending Review queue at `/review`
- Syncs across all devices (iPhone, iPad, desktop)
- Supports email OTP auth
- Is fully vendor-agnostic via adapter pattern throughout

---

## Confirmed Decisions

These are locked in. Claude Code must never re-ask these.

| Concern | Decision |
|---|---|
| Framework | Next.js — App Router, TypeScript, Tailwind (already set up, project exists) |
| Database | Supabase (Postgres) |
| Auth | Email OTP only via Auth.js + Resend |
| OTP expiry | 10 minutes |
| Session expiry | 7 days |
| AI vision provider | GPT-4o mini (OpenAI) |
| Low confidence handling | Auto-queue for review |
| Raw AI response | Store in DB for debugging |
| Shortcut upload | Batch — multiple images per request |
| Shortcut notification | "Receipt queued ✓" |
| Max upload file size | 10MB per image |
| Accepted image formats | JPEG, PNG, HEIC |
| Review screen | `/review` route, modal/drawer per transaction |
| Reject behaviour | Hard delete — confirmation modal first, then immediately gone, no audit trail |
| Bulk confirm | No — review one by one |
| UI component library | shadcn/ui |
| Receipt images | Not stored — parsed data only |
| PDF parsing | Client-side decrypt (pdfjs-dist) → extract text → AI parses text |
| Excel parsing | AI detects columns from headers only → local parsing of data rows |
| PDF password | Never leaves the device — decryption happens in browser only |
| Categories | Fixed list (see below) — AI suggests, user can override in review |
| Delete behaviour | Hard delete everywhere — no soft deletes, no audit trail (privacy) |
| Reject confirmation | Yes — "Delete this transaction? This cannot be undone." modal before hard delete |
| PWA | Yes — installable on iPhone/Android home screen |
| Payment method | Account + method tag (UPI / Card / Net Banking / Cash / Other) |
| Account balance | Opening balance set manually — current balance calculated from transactions |
| Investment tracking | Category transactions + manual entries — home dashboard summary card only |
| Multi-account | Yes — transactions belong to an account |
| Budget tracking | Yes — per category, monthly |
| CSV export | Yes |
| Rate limiting | Yes — on upload endpoint |
| Recurring detection | Yes — after 3 occurrences, flag as recurring |
| Split transactions | Yes — one transaction can be split across categories |

---

## Fixed Category List

AI must suggest from this list only. User can override during review.

```
Food & Dining
Transport
Shopping
Bills & Utilities
Health
Entertainment
Travel
Education
Investments & Savings
Transfers
Income
Other
```

---

## Guiding Principles

### 1. Adapter Pattern — Non-negotiable
Every external service must sit behind an interface. No SDK is ever called directly from API routes or pages.

```
/lib
  /db
    types.ts                    ← TransactionRepository, AccountRepository, BudgetRepository
    index.ts                    ← swap provider here only
    supabase.adapter.ts
  /vision
    types.ts                    ← VisionProvider
    index.ts
    openai.adapter.ts
  /auth
    types.ts                    ← AuthProvider
    index.ts
    nextauth.adapter.ts
  /email
    types.ts                    ← EmailProvider
    index.ts
    resend.adapter.ts
  /statement
    types.ts                    ← StatementParser
    index.ts
    pdf.parser.ts
    excel.parser.ts
```

Swapping any provider = change one line in the relevant `index.ts`. Nothing else breaks.

### 2. Ask Before Build
Ask all open questions per phase before writing any code. Confirmed Decisions above are already answered.

### 3. TypeScript Everywhere
Strict mode. No `any`. All shared types in `/lib/types/`.

### 4. Environment Variables
All secrets in `.env.local`. `.env.example` always kept in sync.

### 5. Privacy First
- PDF password never leaves the device
- Excel data rows never touch AI — only header row does
- No soft deletes — deleted data is gone
- No logging of sensitive fields (passwords, raw bank data)

---

## Full Folder Structure

```
/app
  /api
    /receipts
      /upload
        route.ts                ← batch image upload
    /statements
      /import
        route.ts                ← statement import (receives text, not file)
    /transactions
      route.ts                  ← GET all, POST manual
      /[id]
        route.ts                ← PATCH, DELETE
    /accounts
      route.ts                  ← GET, POST
    /budgets
      route.ts                  ← GET, POST, PATCH
    /settings
      /upload-token
        route.ts                ← returns UPLOAD_SECRET (session protected)
    /export
      /csv
        route.ts
  /review
    page.tsx
  /transactions
    page.tsx
  /import
    page.tsx                    ← PDF + Excel import UI
  /budgets
    page.tsx
  /settings
    page.tsx
    /shortcut
      page.tsx
  /login
    page.tsx
  layout.tsx
  page.tsx                      ← dashboard / home

/lib
  /db
    types.ts
    index.ts
    supabase.adapter.ts
  /vision
    types.ts
    index.ts
    openai.adapter.ts
  /auth
    types.ts
    index.ts
    nextauth.adapter.ts
  /email
    types.ts
    index.ts
    resend.adapter.ts
  /statement
    types.ts
    index.ts
    pdf.parser.ts
    excel.parser.ts
    bank-configs.ts             ← per-bank Excel column maps
    dedup.ts                    ← deduplication logic
  /types
    transaction.ts
    account.ts
    budget.ts
    receipt.ts
    statement.ts

/components
  /review
    ReviewCard.tsx
    ReviewDrawer.tsx
    DeleteConfirmModal.tsx
  /transactions
    TransactionList.tsx
    TransactionFilters.tsx
    ManualEntryDrawer.tsx
    SplitTransactionDrawer.tsx
  /import
    PDFImporter.tsx
    ExcelImporter.tsx
    ImportPreviewTable.tsx
  /budgets
    BudgetCard.tsx
  /settings
    ShortcutSetup.tsx

/public
  manifest.json                 ← PWA manifest
  sw.js                         ← service worker
```

---

## Database Schema

Run all migrations before Phase 2 implementation. Confirm with user before running.

```sql
-- Accounts
CREATE TABLE accounts (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('savings', 'current', 'credit', 'wallet', 'other')),
  bank        TEXT,
  currency    TEXT NOT NULL DEFAULT 'INR',
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories (fixed list, seeded)
CREATE TABLE categories (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

INSERT INTO categories (id, name) VALUES
  ('food', 'Food & Dining'),
  ('transport', 'Transport'),
  ('shopping', 'Shopping'),
  ('bills', 'Bills & Utilities'),
  ('health', 'Health'),
  ('entertainment', 'Entertainment'),
  ('travel', 'Travel'),
  ('education', 'Education'),
  ('investments', 'Investments & Savings'),
  ('transfers', 'Transfers'),
  ('income', 'Income'),
  ('other', 'Other');

-- Transactions
CREATE TABLE transactions (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  account_id        TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  type              TEXT NOT NULL CHECK(type IN ('debit', 'credit', 'transfer')),
  amount            NUMERIC NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'INR',
  date              DATE NOT NULL,
  time              TIME,
  merchant          TEXT,
  description       TEXT,
  upi_ref           TEXT,
  ref_no            TEXT,
  bank              TEXT,
  category_id       TEXT REFERENCES categories(id),
  source            TEXT NOT NULL CHECK(source IN ('receipt_ocr', 'statement_import', 'manual')),
  raw_ai_response   TEXT,
  confidence        TEXT CHECK(confidence IN ('high', 'medium', 'low')),
  import_hash       TEXT UNIQUE,               -- for deduplication
  is_recurring      BOOLEAN DEFAULT FALSE,
  recurrence_group  TEXT,                      -- groups recurring transactions
  reviewed          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transaction splits
CREATE TABLE transaction_splits (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  transaction_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  category_id     TEXT REFERENCES categories(id),
  amount          NUMERIC NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Budgets
CREATE TABLE budgets (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id TEXT NOT NULL REFERENCES categories(id),
  amount      NUMERIC NOT NULL,
  period      TEXT NOT NULL DEFAULT 'monthly',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_reviewed   ON transactions(reviewed);
CREATE INDEX idx_transactions_date       ON transactions(date);
CREATE INDEX idx_transactions_type       ON transactions(type);
CREATE INDEX idx_transactions_account    ON transactions(account_id);
CREATE INDEX idx_transactions_category   ON transactions(category_id);
CREATE INDEX idx_transactions_hash       ON transactions(import_hash);
CREATE INDEX idx_transactions_recurring  ON transactions(is_recurring);
```

---

## Core Types

```ts
// /lib/types/account.ts
export type AccountType = 'savings' | 'current' | 'credit' | 'wallet' | 'other'
export type Account = {
  id: string
  name: string
  type: AccountType
  bank: string | null
  currency: string
  color: string | null
  created_at: string
}

// /lib/types/transaction.ts
export type TransactionType = 'debit' | 'credit' | 'transfer'
export type TransactionSource = 'receipt_ocr' | 'statement_import' | 'manual'
export type Confidence = 'high' | 'medium' | 'low'

export type Transaction = {
  id: string
  account_id: string | null
  type: TransactionType
  amount: number
  currency: string
  date: string
  time: string | null
  merchant: string | null
  description: string
  upi_ref: string | null
  ref_no: string | null
  bank: string | null
  category_id: string | null
  source: TransactionSource
  raw_ai_response: string | null
  confidence: Confidence | null
  import_hash: string | null
  is_recurring: boolean
  recurrence_group: string | null
  reviewed: boolean
  created_at: string
  splits?: TransactionSplit[]
}

export type TransactionSplit = {
  id: string
  transaction_id: string
  category_id: string | null
  amount: number
  note: string | null
}

// /lib/types/budget.ts
export type Budget = {
  id: string
  category_id: string
  amount: number
  period: 'monthly'
  created_at: string
}

// /lib/types/receipt.ts
export type ParsedReceipt = {
  type: TransactionType
  amount: number
  currency: string
  date: string
  time: string | null
  merchant: string | null
  description: string
  upi_ref: string | null
  bank: string | null
  category_id: string | null
  confidence: Confidence
}

// /lib/types/statement.ts
export type ParsedStatementRow = {
  date: string
  description: string
  amount: number
  type: TransactionType
  ref_no: string | null
  balance: number | null
}
```

---

## Adapter Interfaces

```ts
// /lib/db/types.ts
export interface TransactionRepository {
  insert(tx: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction>
  bulkInsert(txs: Omit<Transaction, 'id' | 'created_at'>[]): Promise<{ inserted: number; skipped: number }>
  getPending(): Promise<Transaction[]>
  getAll(filters?: TransactionFilters): Promise<Transaction[]>
  update(id: string, data: Partial<Transaction>): Promise<Transaction>
  delete(id: string): Promise<void>
  getHashes(): Promise<string[]>                    // for dedup
  detectRecurring(): Promise<void>                  // run after bulk import
}

export interface AccountRepository {
  getAll(): Promise<Account[]>
  insert(account: Omit<Account, 'id' | 'created_at'>): Promise<Account>
  update(id: string, data: Partial<Account>): Promise<Account>
  delete(id: string): Promise<void>
}

export interface BudgetRepository {
  getAll(): Promise<Budget[]>
  insert(budget: Omit<Budget, 'id' | 'created_at'>): Promise<Budget>
  update(id: string, data: Partial<Budget>): Promise<Budget>
  delete(id: string): Promise<void>
}

// /lib/vision/types.ts
export interface VisionProvider {
  parseReceipt(imageBase64: string, mimeType: string): Promise<ParsedReceipt>
  detectExcelColumns(headers: string[]): Promise<Record<string, string>>
}

// /lib/statement/types.ts
export interface StatementParser {
  parseText(text: string, bank: string): Promise<ParsedStatementRow[]>
}
```

---

## Deduplication Logic

Lives in `/lib/statement/dedup.ts`. Used by both PDF and Excel import flows.

```
Layer 1 — Exact ref_no match
  Same ref_no + date + amount → definite duplicate → skip silently

Layer 2 — Hash match
  hash = SHA256(date + amount + type + normalize(description))
  normalize = lowercase, trim, collapse spaces, remove special chars
  If hash exists in DB → duplicate → skip silently

Layer 3 — Near-duplicate warning
  Same date + same amount + similar description (but no ref_no / hash match)
  → flag in import preview: "Possible duplicate — review before importing"
  → user decides, not auto-skipped
```

---

## AI Prompts

### Receipt Vision Prompt
```
You are a financial receipt parser for an Indian user.
Analyze this image and respond ONLY with a valid JSON object. No markdown, no explanation.

Valid categories: food, transport, shopping, bills, health, entertainment, travel, education, investments, transfers, income, other

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
  "category_id": string | null,
  "confidence": "high" | "medium" | "low",
  "payment_method": "upi" | "card" | "net_banking" | "cash" | "other" | null
}

Rules:
- debit = money leaving the account
- credit = money coming in
- transfer = between own accounts
- amount must be a positive number, no currency symbols
- Set unknown fields to null
- Never guess amount — if unreadable, set confidence to "low"
- date must be YYYY-MM-DD
- payment_method: use 'upi' if upi_ref exists, 'card' if card digits visible, else null
```

### PDF Statement Text Prompt
```
You are a bank statement parser for an Indian user.
Below is raw text extracted from a bank statement PDF.
Return ONLY a JSON array of transactions. No markdown, no explanation.

Each object:
{
  "date": "YYYY-MM-DD",
  "description": string,
  "amount": number,
  "type": "debit" | "credit",
  "ref_no": string | null,
  "balance": number | null
}

Rules:
- amount is always positive
- debit = money going out, credit = money coming in
- Skip header rows, opening/closing balance rows, summary rows
- Return [] if no transactions found

Raw text:
{{EXTRACTED_TEXT}}
```

### Excel Column Detection Prompt
```
You are a bank statement column mapper.
Below are column headers from an Indian bank statement Excel file.
Return ONLY a JSON object mapping these semantic keys to the actual header strings.

{
  "date": string | null,
  "description": string | null,
  "debit": string | null,
  "credit": string | null,
  "ref_no": string | null,
  "balance": string | null
}

Set a key to null if no matching column exists.

Headers: {{HEADERS}}
```

---

## Bank Configs (Excel fallback if AI detection fails)

```ts
// /lib/statement/bank-configs.ts
export const BANK_CONFIGS = [
  {
    bank: 'HDFC',
    dateCol: 'Date',
    dateFormat: 'DD/MM/YY',
    debitCol: 'Withdrawal Amt.',
    creditCol: 'Deposit Amt.',
    descriptionCol: 'Narration',
    refCol: 'Chq./Ref.No.',
    balanceCol: 'Closing Balance',
  },
  {
    bank: 'ICICI',
    dateCol: 'Transaction Date',
    dateFormat: 'DD-MM-YYYY',
    debitCol: 'Withdrawal Amount (INR )',
    creditCol: 'Deposit Amount (INR )',
    descriptionCol: 'Transaction Remarks',
    refCol: null,
    balanceCol: 'Balance (INR )',
  },
  {
    bank: 'Axis',
    dateCol: 'Tran Date',
    dateFormat: 'DD-MM-YYYY',
    debitCol: 'Debit',
    creditCol: 'Credit',
    descriptionCol: 'Particulars',
    refCol: null,
    balanceCol: 'Balance',
  },
  {
    bank: 'Kotak',
    dateCol: 'Txn Date',
    dateFormat: 'DD-MM-YYYY',
    debitCol: 'Debit Amount',
    creditCol: 'Credit Amount',
    descriptionCol: 'Description',
    refCol: null,
    balanceCol: null,
  },
  {
    bank: 'SBI',
    dateCol: 'Txn Date',
    dateFormat: 'DD MMM YYYY',
    debitCol: 'Debit',
    creditCol: 'Credit',
    descriptionCol: 'Description',
    refCol: 'Ref No./Cheque No.',
    balanceCol: 'Balance',
  },
]
```

---

## Environment Variables

```env
# Database (Supabase)
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth (Auth.js)
AUTH_SECRET=
AUTH_URL=

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=

# Vision (OpenAI)
OPENAI_API_KEY=
VISION_PROVIDER=openai

# Upload security
UPLOAD_SECRET=
UPLOAD_RATE_LIMIT=50        # max uploads per hour per token
```

---

## Phases

---

### Phase 1 — Project Foundation

**Goal:** Verify existing project, scaffold folder structure, adapter skeletons, env setup.

**Steps:**
1. Ask user for `tree -L 3` output and `package.json` dependencies
2. Ask what is currently in local storage (shape of existing data)
3. Create full `/lib` folder with all interfaces (no implementations)
4. Create all type files in `/lib/types/`
5. Set up `.env.local` and `.env.example`
6. Install: `zod`, `shadcn/ui`

**Open questions:**
- [ ] Share `tree -L 3` output
- [ ] Share `package.json` dependencies
- [ ] What is currently in local storage? Share the data shape.

**Done when:** Project runs, all interfaces exist, `.env.example` complete.

---

### Phase 2 — Database Layer

**Goal:** All repositories working against Supabase.

**Steps:**
1. Guide user to create Supabase project
2. Install `@supabase/supabase-js`
3. Run full migration SQL (schema above) — confirm with user first
4. Implement `SupabaseTransactionRepository`, `SupabaseAccountRepository`, `SupabaseBudgetRepository`
5. Wire all into `/lib/db/index.ts`
6. Seed categories table
7. Test script: insert account → insert transaction → fetch → delete

**Open questions:**
- [ ] Has Supabase project been created? If yes, share project URL.
- [ ] Confirm schema field by field — anything missing or to rename?
- [ ] Does existing local storage data need to be migrated? If yes, share the shape.

**Done when:** Test script passes. Categories seeded. All repos functional.

---

### Phase 3 — Auth Layer (Email OTP)

**Goal:** Email OTP login on all devices, 7-day sessions.

**Steps:**
1. Install `next-auth@beta`, `@auth/supabase-adapter`, `resend`
2. Configure Auth.js with Email provider (OTP, 10 min expiry)
3. Implement `ResendEmailProvider` and `NextAuthProvider` adapters
4. Protect all routes — redirect to `/login` without session
5. Build `/login` page (email input → OTP input → redirect)

**Open questions:**
- [ ] Has Resend account been created? API key available?
- [ ] What email address should OTPs be sent from?
- [ ] Is there a domain, or using localhost/Vercel preview URL for now?

**Done when:** Can log in via OTP on desktop and iPhone Safari. All routes protected.

---

### Phase 4 — Vision Parsing Layer

**Goal:** `vision.parseReceipt()` returns validated `ParsedReceipt`. `vision.detectExcelColumns()` returns column map.

**Steps:**
1. Install `openai`
2. Implement `OpenAIVisionProvider` with both methods
3. Add Zod schemas for `ParsedReceipt` and column map response
4. Handle: unreadable image, non-receipt image, API error, invalid JSON response
5. Wire into `/lib/vision/index.ts`
6. Test with sample UPI screenshot

**Open questions:**
- [ ] Is OpenAI API key available? If not, guide user to platform.openai.com.

**Done when:** `parseReceipt()` returns valid result for UPI screenshot. `detectExcelColumns()` correctly maps HDFC headers.

---

### Phase 5 — Upload API Endpoint + Rate Limiting

**Goal:** `POST /api/receipts/upload` — batch image upload, parsed and queued.

**Steps:**
1. Build route with native Next.js `formData()` parsing
2. Auth: validate `X-Upload-Token` header
3. Rate limiting: max 50 uploads/hour per token (in-memory, reset hourly)
4. For each image in batch:
   - Validate type (JPEG/PNG/HEIC) and size (≤10MB)
   - Convert to base64
   - Call `vision.parseReceipt()`
   - Generate `import_hash`
   - Call `db.insert()` with `reviewed: false`
5. Return `{ queued: N, errors: [] }`

**Open questions:**
- [ ] Process batch images sequentially or in parallel? (parallel = faster, more quota usage)
- [ ] If one image in a batch fails, should the rest still process?

**Done when:** Can POST 3 images via curl, all appear in Supabase as `reviewed: false`.

---

### Phase 6 — Statement Import (PDF + Excel)

**Goal:** `/import` page — import PDF or Excel bank statements, deduplicated, bulk queued.

#### PDF Flow (server-assisted)
1. User selects bank + uploads PDF + types password
2. `pdfjs-dist` decrypts and extracts text **in the browser**
3. Password goes out of scope immediately after decryption
4. Clean text POSTed to `/api/statements/import`
5. Server calls `vision.parseText()` (GPT-4o mini)
6. Dedup check against existing hashes
7. Bulk insert as `reviewed: false`, `source: 'statement_import'`

#### Excel Flow (fully client-side data)
1. User selects bank + uploads Excel file
2. `SheetJS` reads file in browser
3. Header row sent to `vision.detectExcelColumns()` — only headers, no data
4. Column map returned
5. Data rows parsed locally using column map
6. Dedup check (fetch hashes from server, compare locally)
7. Show preview: "43 new, 3 duplicates skipped, 2 unparseable"
8. User confirms → POST clean JSON to `/api/statements/import`
9. Server bulk inserts

**Open questions:**
- [ ] Should import be limited to one file at a time, or allow multiple?
- [ ] Should the preview table be paginated (for large statements)?
- [ ] What should happen to unparseable rows — show them, skip silently, or let user fix?

**Done when:**
- PDF import queues all transactions from a real bank statement
- Excel import never sends data rows to any external service
- Duplicate transactions are skipped correctly

---

### Phase 7 — Pending Review UI (`/review`)

**Goal:** Review queue — confirm, edit (drawer), or reject each pending transaction.

**Steps:**
1. Fetch all `reviewed: false` on load
2. Transaction card: type badge, amount, merchant, date, confidence badge, account, category
3. Three actions: Confirm ✓, Edit (drawer), Reject ✗
4. Edit drawer: all fields editable including account, category, splits
5. Confirm → `reviewed: true`
6. Reject → confirmation modal ("Delete this transaction? This cannot be undone.") → hard delete
7. Split transaction option in edit drawer
8. Empty state: "All caught up ✓"
9. Count badge in nav: "Review (3)"

**Open questions:**
- [ ] Colour coding for transaction types? (e.g. red = debit, green = credit)
- [ ] Should the review page auto-refresh for new items, or manual refresh only?
- [ ] Card layout preference — compact list or larger cards?

**Done when:** Full review flow works on iPhone Safari. Splits work. Reject confirmation fires before delete.

---

### Phase 8 — Transaction List (`/transactions`)

**Goal:** All confirmed transactions, filterable, searchable, exportable.

**Steps:**
1. Fetch all `reviewed: true`
2. Filters: date range, type, category, account
3. Search: merchant or description
4. Summary: total debits, total credits, net for current filter
5. Pagination (50 per page)
6. CSV export: `GET /api/export/csv` with same filters applied

**Open questions:**
- [ ] List or table layout?
- [ ] Date range — presets (This month / Last month / All time) or full date picker?
- [ ] Should CSV export respect active filters, or always export everything?

**Done when:** Transactions visible, filterable, searchable. CSV downloads correctly.

---

### Phase 9 — Accounts

**Goal:** Multi-account support — create and manage accounts, assign to transactions.

**Steps:**
1. `/settings` page with accounts section (or dedicated `/accounts` page — ask user)
2. Create account form: name, type, bank, color
3. Account selector in transaction edit drawer and manual entry
4. Account filter on `/transactions`
5. Import flow — bank selector auto-suggests matching account

**Open questions:**
- [ ] Accounts managed from `/settings` or a dedicated `/accounts` page?
- [ ] Should there be a default account pre-selected on import/upload?

**Done when:** Multiple accounts created. Transactions correctly assigned. Filter works.

---

### Phase 10 — Budget Tracking

**Goal:** Monthly budgets per category with spend tracking.

**Steps:**
1. `/budgets` page — list all budgets with progress bars
2. Create/edit budget: category + monthly amount
3. Spend calculated from confirmed transactions in current month
4. Visual indicator: green (<70%), amber (70–90%), red (>90%)
5. Summary on dashboard home page

**Open questions:**
- [ ] Should budgets reset automatically each month, or be manually reset?
- [ ] Should the dashboard show all budgets or just over-budget ones?

**Done when:** Budget progress updates correctly as transactions are confirmed.

---

### Phase 11 — Recurring Transaction Detection

**Goal:** Automatically flag recurring transactions after 3 occurrences.

**Steps:**
1. `detectRecurring()` runs after every bulk import and manual entry
2. Logic: same merchant + same approximate amount (±5%) + same day-of-month pattern → flag as recurring
3. Groups linked via `recurrence_group` UUID
4. Recurring badge shown on transaction cards
5. Filter for recurring transactions on `/transactions`

**Open questions:**
- [ ] Should the user be notified when a new recurring transaction is detected?
- [ ] Should there be a way to manually mark/unmark a transaction as recurring?

**Done when:** After importing 3 months of statements, recurring transactions are correctly flagged.

---

### Phase 12 — Split Transactions

**Goal:** Split a single transaction across multiple categories.

**Steps:**
1. "Split" option in transaction edit drawer
2. Add split rows: category + amount
3. Validation: splits must sum to total transaction amount
4. Splits stored in `transaction_splits` table
5. On `/transactions` list — show split indicator
6. CSV export includes splits as separate rows

**Open questions:**
- [ ] Should a split transaction show as one row (expandable) or multiple rows in the list?
- [ ] Should AI suggest splits based on merchant? (e.g. Swiggy Instamart → Food + Household)

**Done when:** Can split a ₹2,400 transaction into ₹1,800 Food + ₹600 Shopping. Both appear in CSV export.

---

### Phase 13 — Manual Transaction Entry

**Goal:** Add transactions without a receipt or statement.

**Steps:**
1. "Add Transaction" button on `/transactions` → drawer
2. Fields: type, amount, date, time, merchant, description, category, account
3. `source: 'manual'`, `reviewed: true` on insert

**Open questions:**
- [ ] Should manual entry support splits at creation time, or only via edit after?

**Done when:** Manual transaction appears immediately in confirmed list.

---

### Phase 14 — Settings & Shortcut Setup

**Goal:** Settings hub + Shortcut Setup page for iOS and Android.

**Steps:**
1. `/settings` page — links to sub-sections
2. `/settings/shortcut` page:
   - Endpoint URL with copy button
   - Upload token (masked, reveal on tap, copy button)
   - Full iOS Shortcut setup instructions (step by step)
   - Full Android HTTP Shortcuts setup instructions
   - Troubleshooting section
   - ℹ️ note: "Your token is never stored in plain text"
3. Token fetched via session-protected `GET /api/settings/upload-token` — never in client bundle

**Security:** `UPLOAD_SECRET` only ever returned via authenticated API route. Never in page props, never in client JS bundle.

**Open questions:**
- [ ] Any other settings sections needed (e.g. account management, category management)?

**Done when:** Can copy token and endpoint URL on iPhone Safari and use them to configure the Shortcut.

---

### Phase 15 — PWA

**Goal:** App installable on iPhone and Android home screen. Works offline for review queue.

**Steps:**
1. Add `manifest.json` (name, icons, theme color, display: standalone)
2. Generate app icons (ask user for icon or use placeholder)
3. Register service worker
4. Cache: `/review` page, `/transactions` page, static assets
5. Offline queue: if confirm/reject fired offline, queue action locally and sync on reconnect
6. Test: install on iPhone Safari, install on Android Chrome

**Open questions:**
- [ ] Is there an app icon/logo, or should a placeholder be used?
- [ ] App name for home screen?
- [ ] Theme color preference?

**Done when:** App installable on iPhone. `/review` loads offline. Actions sync on reconnect.

---


## Additional Confirmed Decisions (Latest Session)

| Concern | Decision |
|---|---|
| PWA data caching | TanStack Query (in-memory, stale-while-revalidate) + Supabase Realtime for push updates |
| Service worker scope | Static assets only (JS/CSS/fonts/shell) — no API response caching |
| Offline actions | IndexedDB queue for confirm/reject only — synced on reconnect |
| SW updates | Prompt user with banner — never force refresh |
| Account balance | User sets opening balance manually — app calculates current balance from transactions |
| Payment method | Account + method tag (UPI / Card / Net Banking / Cash) |
| Investment tracking | Both — Investments & Savings category transactions + manual investment entries |
| Investment display | Home dashboard summary card only (no separate page) |

---

## Updated: Additional Schema Changes

```sql
-- Add opening_balance to accounts
ALTER TABLE accounts ADD COLUMN opening_balance NUMERIC NOT NULL DEFAULT 0;

-- Add payment_method to transactions
ALTER TABLE transactions ADD COLUMN payment_method TEXT
  CHECK(payment_method IN ('upi', 'card', 'net_banking', 'cash', 'other'));

-- Investment entries (manual, separate from transactions)
CREATE TABLE investment_entries (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,          -- "Zerodha SIP", "HDFC FD", "PPF"
  amount      NUMERIC NOT NULL,
  date        DATE NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investment_entries_date ON investment_entries(date);
```

**Account balance calculation:**
```
current_balance = opening_balance
                + SUM(amount WHERE type = 'credit' AND account_id = X)
                - SUM(amount WHERE type = 'debit' AND account_id = X)
```
Calculated at query time — never stored, always accurate.

**Total invested calculation (home dashboard):**
```
total_invested = SUM(amount WHERE category_id = 'investments' AND type = 'debit' AND reviewed = true)
               + SUM(amount FROM investment_entries)
```
Deduplicated by design — manual entries are separate from transactions so no double counting.

---

## Updated: Home Dashboard (`/`)

The home page shows:

```
┌─────────────────────────────────────────┐
│  Net Balance                            │
│  ₹ X  (sum across all accounts)         │
├─────────────────────────────────────────┤
│  Accounts                               │
│  HDFC Savings     ₹ 45,230  [savings]  │
│  ICICI Credit     ₹ -8,400  [credit]   │
│  Kotak Salary     ₹ 92,100  [savings]  │
├─────────────────────────────────────────┤
│  This Month                             │
│  Debits   ₹ 24,500                     │
│  Credits  ₹ 85,000                     │
│  Net      ₹ +60,500                    │
├─────────────────────────────────────────┤
│  Investments                            │
│  Total Invested   ₹ 1,24,000           │
│  (transactions + manual entries)        │
├─────────────────────────────────────────┤
│  Budgets (over 70% only)                │
│  Food & Dining  ████████░░  80%        │
│  Transport      ██████████  102% ⚠️    │
└─────────────────────────────────────────┘
```

---

## Updated: Phase 9 — Accounts (revised)

**Additional steps:**
- Add `opening_balance` field to account creation form
- Show calculated current balance on account card (opening + transaction delta)
- Account card shows: name, bank, type, current balance, color indicator
- Balance recalculates automatically as transactions are confirmed/deleted

---

## Updated: Phase 13 — Manual Transaction Entry (revised)

**Additional fields:**
- `payment_method` selector: UPI / Card / Net Banking / Cash / Other
- AI should also suggest `payment_method` from receipt context where obvious
  (e.g. "UPI" if upi_ref exists, "Card" if card number visible)

---

## New: Phase 16 — Investment Tracking (Home Dashboard)

**Goal:** Track total invested amount on home dashboard via two sources.

**Steps:**
1. Manual investment entry form (accessible from home dashboard or `/transactions`):
   - Fields: name (e.g. "Zerodha SIP"), amount, date, note
   - Stored in `investment_entries` table
2. Home dashboard investment card:
   - Fetches sum of `Investments & Savings` category transactions (confirmed only)
   - Fetches sum of all `investment_entries`
   - Displays combined total
   - Breakdown on tap/expand: "From transactions: ₹X | Manual entries: ₹Y"
3. TanStack Query caches both queries — single fetch per session

**Open questions to ask before starting:**
- [ ] Should manual investment entries appear in the `/transactions` list, or only on the dashboard?
- [ ] Should there be a way to edit or delete manual investment entries?
- [ ] Should the investment card show a date range (e.g. "this year" vs "all time")?

**Done when:**
- Home dashboard shows correct total invested
- Adding a manual entry or confirming an investment transaction updates the card

---

## New: Phase 17 — TanStack Query + Supabase Realtime Setup

**Goal:** Zero redundant DB reads. Instant cross-device sync.

**Steps:**
1. Install `@tanstack/react-query`, set up `QueryClientProvider` in root layout
2. Wrap all data fetches in `useQuery` with appropriate `staleTime`:
   - Transactions: `staleTime: 5 mins`
   - Pending review: `staleTime: 0` (always fresh — most critical data)
   - Budgets: `staleTime: 10 mins`
   - Accounts: `staleTime: 30 mins`
   - Investment total: `staleTime: 10 mins`
3. Set up Supabase Realtime subscriptions:
   - `transactions` table → invalidate transactions + review query cache on any change
   - `investment_entries` table → invalidate investment total cache
   - `accounts` table → invalidate accounts cache
4. On reconnect after offline → flush IndexedDB action queue → invalidate all caches

**Caching architecture:**
```
Service Worker     → Cache First: JS/CSS/fonts/app shell only
TanStack Query     → In-memory: all API data, stale-while-revalidate
Supabase Realtime  → Push invalidation: keeps TanStack cache fresh
IndexedDB          → Offline action queue only (confirm/reject/update)
```

**SW update flow:**
- New deployment detected → show subtle top banner: "Update available — Refresh to get latest"
- Never auto-refresh — user controls timing

**Open questions to ask before starting:**
- [ ] Should Supabase Realtime be enabled from day one, or added after core flows work?
- [ ] Should there be a visible "last synced" indicator anywhere in the UI?

**Done when:**
- Navigating between pages fires zero additional DB reads after initial load
- Confirming a transaction on one device reflects on another within 2 seconds
- Offline confirm/reject syncs correctly on reconnect


---

## Phase 8 — COMPLETE (revised scope)

**Pagination removed** — no pagination on transaction list.  
**CSV export deferred** — moved to a later phase, not blocking Phase 8 sign-off.

### What was built
- Home page (`/`) is the transaction list — month picker, filter chips, grouped by date
- Filters: type (Debit/Credit/Transfer), category, account
- Desktop 3-column layout: left sidebar (accounts + filters) | center (transaction list) | right (stats)
- Desktop SELECTION summary section in left sidebar: shows sum of filtered transactions when any filter is active
- Clear filters button next to FILTERS label on desktop sidebar
- Mobile filter sheet with type chips, category chips, account chips, and "Clear all"
- Auto-mark `reviewed: true` when a transaction is saved from the Home edit drawer with all required fields filled

---

## Phase 9 — COMPLETE

### Confirmed Decisions (Phase 9)

| Concern | Decision |
|---|---|
| Accounts location | Dedicated `/accounts` page + nav tab |
| Account mandatory | Yes — required on all transactions (orange dot indicator if missing) |
| Account color | Not implemented (removed from scope) |
| Bank field | Free text |
| Desktop account display | Left sidebar on Home, before filters — shows name, bank, current balance |
| Mobile account display | Only on `/accounts` page (not on home) |
| Account filter | Added to existing filter UI (chips on mobile, dropdown on desktop) |
| Existing transactions | Orange dot indicator when `account_id === null` |
| Inline add account | Yes — same pattern as custom category (inline mini-form in modal) |
| Balance retroactive linking | Does NOT affect balance — only transactions created after account creation count |
| Credit card balance | Stored as negative opening balance, displayed as positive "Amount to be Settled" |
| CC settlement flow | Transfer transaction (from=savings, to=CC), category=Settlement |

### Migrations run

```sql
-- 006_accounts.sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('savings', 'current', 'credit', 'wallet', 'other')),
  bank TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  opening_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);

-- 007_settlement_category.sql
INSERT INTO categories (name, is_predefined) VALUES ('Settlement', true)
  ON CONFLICT (name) DO UPDATE SET is_predefined = true;

-- 008_transfer_to_account.sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account_id);
```

### Balance calculation rules (implemented in `lib/utils.ts`)

```
current_balance = opening_balance
  + SUM(amount WHERE type='credit'   AND account_id = X AND tx.created_at > account.created_at)
  - SUM(amount WHERE type='debit'    AND account_id = X AND tx.created_at > account.created_at)
  - SUM(amount WHERE type='transfer' AND account_id = X AND tx.created_at > account.created_at)  ← money leaves source
  + SUM(amount WHERE type='transfer' AND to_account_id = X AND tx.created_at > account.created_at) ← money arrives at dest
```

Retroactively linking an existing transaction to an account does NOT change the balance.  
Only new transactions (created after the account) count.

### Files created / modified

| File | Change |
|---|---|
| `lib/types/account.ts` | New — `Account`, `AccountWithBalance`, `AccountType`, `ACCOUNT_TYPE_LABELS` |
| `lib/types/transaction.ts` | Added `account_id`, `to_account_id` fields |
| `lib/db/accounts.ts` | New — `SupabaseAccountRepository` |
| `lib/db/cached-queries.ts` | Added `getCachedAccounts()` with `cacheTag('accounts')` |
| `lib/utils.ts` | Added `calcAccountBalance`, `toAccountsWithBalance` |
| `lib/categories.ts` | Added `'Settlement'` to predefined categories |
| `app/actions/accounts.ts` | New — `createAccount`, `updateAccount`, `deleteAccount` (returns new Account) |
| `app/page.tsx` | Fetches accounts, computes balances, passes to HomeClient |
| `app/HomeClient.tsx` | Account section in desktop sidebar, account filter, selectedAccount state |
| `app/review/page.tsx` | Fetches accounts, passes to ReviewClient |
| `app/review/ReviewClient.tsx` | Passes accounts to ReviewEditDrawer |
| `app/review/ReviewEditDrawer.tsx` | Account selector + inline add, TO ACCOUNT for transfers |
| `app/accounts/page.tsx` | New — server component, fetches accounts + transactions |
| `app/accounts/AccountsClient.tsx` | New — account cards, add/edit sheet, delete with confirm |
| `components/TransactionModal.tsx` | Account selector + inline add, TO ACCOUNT for transfers, settlement UX |
| `components/TransactionItem.tsx` | Orange dot when `account_id === null` |
| `components/BottomNav.tsx` | Tabs: Home, Stats, Accounts, Settings (Review removed from mobile) |
| `components/TopNav.tsx` | Added Accounts tab |

### Settlement UX (TransactionModal)

When user selects **Settlement** category:
- Auto-switches type to **Transfer**
- **FROM account** filtered to non-credit accounts only (savings / current / wallet / other)
- **TO account** filtered to credit card accounts only
- Invalid prior account selections cleared automatically
- **Merchant field** auto-filled with the TO account name, locked read-only
- **Notes field** auto-filled with "Credit Card Settlement" (remains editable)

---

## What Claude Code Must Never Do

- Call any external SDK directly from API routes or page components — always go through `/lib` adapters
- Hardcode any secret, key, or provider-specific string outside adapter files and `.env`
- Skip asking open questions to save time
- Start a phase without the previous phase signed off by the user
- Use `any` in TypeScript
- Send Excel data rows to any AI — headers only
- Send the PDF password to the server or log it anywhere
- Re-ask anything in the Confirmed Decisions table

---

## Phase Sign-off Checklist

**Before starting each phase:**
- [ ] All open questions asked and answered
- [ ] Previous phase confirmed complete by user

**After completing each phase:**
- [ ] Summarise what was built
- [ ] List implementation decisions made
- [ ] Ask: "Confirm this phase is complete before I move to the next?"

---

## Appendix A — iOS Shortcut Setup (Manual Steps)

### What you need
- Endpoint URL from Settings → Shortcut Setup
- Upload token from Settings → Shortcut Setup

### Steps

1. Open the **Shortcuts** app → tap **+**
2. Tap **Add Action** → search **"Receive"** → select **"Receive input from Share Sheet"** → set type to **Images**
3. Tap **+** → search **"Repeat with each"** → set to repeat with **Shortcut Input**
4. Inside the repeat block → tap **+** → search **"Get contents of URL"**
   - URL: your endpoint URL
   - Method: **POST**
   - Request Body: **Form**
   - Add field: Key = `file`, Value = **Repeat Item**, Type = **File**
5. Still in "Get contents of URL" → tap **Headers** → add: Key = `X-Upload-Token`, Value = your token
6. Outside the repeat block → tap **+** → search **"Show Notification"** → Title: `Receipt queued ✓`
7. Tap the Shortcut name → rename to **"Queue Receipt"**
8. Tap **ⓘ** → toggle **"Show in Share Sheet"** → Share Sheet Types → **Images**
9. Test: Photos → select receipt → Share → Queue Receipt → check `/review`

---

## Appendix B — Android Setup (HTTP Shortcuts)

### App
[HTTP Shortcuts](https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts) — free, open source

### Steps

1. Install **HTTP Shortcuts** from Play Store
2. Tap **+** → **Regular Shortcut**
3. Name: `Queue Receipt`, Method: **POST**, URL: your endpoint URL
4. **Request Body** tab → Type: **Multipart/Form Data** → add parameter: Name = `file`, Type = **Image**, Value = share input variable
5. **Headers** tab → add: `X-Upload-Token` → your token
6. **Scripting** tab → success: `showToast("Receipt queued ✓")`
7. Save → three dots → **Add to Home Screen**
8. Shortcut settings → enable **"Show in share menu"**
9. Test: Gallery → select receipt → Share → Queue Receipt → check `/review`
