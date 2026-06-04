# Paisa Buddy

A personal finance tracker built for Indians. Capture expenses by photographing receipts from your iPhone, review and categorise them, and get a clear monthly picture of where your money goes.

---

## Features

**Receipt capture via iOS Shortcut**
Share a photo from your camera roll directly to the app. The shortcut sends it to a token-authenticated endpoint, OpenAI Vision parses the receipt, and the transaction lands in your review queue — no manual entry needed.

**Review queue**
Every imported receipt waits for your confirmation before it counts. Edit amounts, fix categories, assign accounts, and approve or reject — all from one screen.

**Manual transactions**
Add debits, credits, and transfers by hand using the quick-add form or the iOS Shortcut's text-based quick-add endpoint.

**Accounts & running balances**
Create savings, current, credit card, wallet, or other accounts with an opening balance. Balances are maintained by a PostgreSQL trigger on every confirmed transaction — no full-table scans needed.

**Monthly home view**
The home screen shows the current month's transactions with income, spending, and balance summaries. Navigate to any month via the month picker; each navigation is a server-side fetch so only that month's data leaves the database.

**Stats with donut charts**
The stats tab breaks down expenses, income, and transfers by category as interactive SVG donut charts. Tap a slice to inspect the category name, amount, and percentage.

**Category management**
Eleven predefined categories ship out of the box. Add custom categories as needed; they're shared across the app and show transaction counts on the settings page.

**Settings & token management**
Manage UPI IDs, display name, and your upload token from the settings hub. Rotate the upload token at any time — the old one stops working immediately.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `use cache`, Server Actions) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase |
| Query layer | postgres.js (raw SQL, no ORM) |
| Auth | NextAuth v5 (JWT, email OTP) |
| Email | Resend |
| AI / Vision | OpenAI GPT-4o Vision |
| Styling | Tailwind CSS |
| Deployment | Vercel (`bom1` — Mumbai) |

---

## Project Structure

```
app/
  page.tsx              # Home — current month transactions
  review/               # Review queue for unreviewed transactions
  stats/                # Monthly stats with donut charts
  accounts/             # Account management
  settings/             # Settings hub
    shortcut/           # iOS Shortcut setup + token management
  api/
    receipts/upload/    # Token-auth endpoint — receipt OCR
    transactions/quick/ # Token-auth endpoint — quick-add
components/             # Shared UI components
lib/
  db/                   # Repository layer (postgres.js adapters)
    postgres/           # PostgreSQL implementations
  auth/                 # Auth helpers (require-user, require-setup)
  types/                # Domain types (Transaction, Account, etc.)
migrations/             # Ordered SQL migrations (001 → 017)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A [Supabase](https://supabase.com) project (free tier works)
- An [OpenAI](https://platform.openai.com) API key
- A [Resend](https://resend.com) account for email OTP

### 1. Clone and install

```bash
git clone https://github.com/SudhanshuBhagwat/paisa-buddy.git
cd paisa-buddy
pnpm install
```

### 2. Environment variables

Create `.env.local`:

```env
# Database — use the pooler URL for the app
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# NextAuth
AUTH_SECRET=<generate with: npx auth secret>
AUTH_URL=http://localhost:3000/

# Email (Resend)
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM=your@domain.com

# Vision (OpenAI)
OPENAI_API_KEY=<your-openai-api-key>
VISION_PROVIDER=openai
```

### 3. Run migrations

Apply all migrations in order using the direct connection (port 5432, not the pooler):

```bash
for f in migrations/*.sql; do
  psql "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" -f "$f"
done
```

### 4. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your email.

---

## iOS Shortcut Setup

The app includes a step-by-step setup guide at **Settings → Shortcut Setup**. In short:

1. Copy your endpoint URL and upload token from the settings page.
2. In the iOS Shortcuts app, create a shortcut that:
   - Receives **Images** from the Share Sheet
   - Loops over each image
   - Calls **Get Contents of URL** — POST to your endpoint, body type Form, field `file` = the image
   - Adds header `X-Upload-Token: <your-token>`
3. Enable **Show in Share Sheet** on the shortcut.

Share any receipt photo → tap the shortcut → it appears in your review queue.

---

## Database Migrations

Migrations live in `migrations/` as plain SQL files numbered sequentially. They are idempotent where possible (`IF NOT EXISTS`, `CREATE OR REPLACE`).

| Migration | Description |
|---|---|
| 001 | Initial schema — transactions, categories |
| 002 | Auth — OTP tokens, users |
| 006 | Accounts table |
| 009 | User-scoped data — `user_id` on all tables |
| 011–012 | Row Level Security with portable `current_setting()` |
| 013–014 | `set_user_context` helper + `SET LOCAL ROLE` fix |
| 015 | Upload token column on `user_settings` |
| 016 | `current_balance` on accounts, backfilled from history |
| 017 | Trigger to maintain `current_balance` on transaction changes |

---

## Architecture Notes

**Token-authenticated routes** — `/api/receipts/upload` and `/api/transactions/quick` use a per-user upload token (`X-Upload-Token` header) instead of a session cookie. This lets the iOS Shortcut and other automation tools call the API without a browser session.

**Running account balance** — `accounts.current_balance` is maintained by a `SECURITY DEFINER` trigger (`trg_account_balance`) that fires on every `INSERT`, `UPDATE`, and `DELETE` to the `transactions` table. This eliminates the need to sum all historical transactions on page load.

**Server-side caching** — Data fetches use Next.js `use cache` with `cacheTag` for fine-grained invalidation. Tags (`transactions`, `accounts`, `categories`, `user-settings`) are invalidated in Server Actions after mutations. Month-scoped queries keep payloads small.

**Row Level Security** — All user tables have RLS enabled. App queries run via `withUserContext`, which opens a transaction, calls `set_user_context(userId)` (sets `ROLE authenticated` and `app.user_id`), and lets RLS policies enforce per-user isolation automatically.

---

## License

MIT
