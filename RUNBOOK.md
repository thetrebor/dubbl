# Dubbl Runbook

> Auto-generated 2026-06-30 by pi.dev agent. Validated by Codex.

---

## Quick Reference

| Item | Value |
|---|---|
| **Production URL** | `https://invoice.robertmaefs.com` |
| **Tunnel** | Cloudflare → `localhost:3456` |
| **Org** | Robert Maefs Consulting, LLC (`066c214d-...`) |
| **Docker** | `docker-compose.prod.yml` |
| **DB** | PostgreSQL 16 Alpine (container: `dubbl-postgres-1`) |
| **Stack** | Next.js 16 + Drizzle ORM + NextAuth |
| **API Key** | `~/.pi/tokens/tokens.json` → `dubbl.api_key` |
| **Sandcastle** | `.sandcastle/site-manifest.yaml` |

---

## 0. Agent Operating Model

Agents should preserve the same invariants a careful human operator would preserve:
the UI should remain the primary workflow surface, accounting mutations should pass
through application code, and every user-facing capability should be represented in
the agent control plane.

### Operation Preference Order

Use the highest-level interface that can complete the task safely:

1. **Kuri/browser UI** — default for routine business workflows and UI-sensitive
   tasks: creating, editing, sending, voiding, paying invoices, configuring
   settings, and verifying layout.
2. **MCP tools** — preferred programmatic control plane for repeatable agent
   actions. Use MCP when the tool exists and the task does not require visual
   confirmation.
3. **REST API** — acceptable for scripted operations, diagnostics, and gaps in
   MCP coverage. Use the public application API, not private database writes.
4. **Direct PostgreSQL** — read-only diagnostics only. Do not mutate production
   data directly with SQL unless the user explicitly authorizes an emergency
   repair and the repair includes a backup, a written rollback plan, and a
   follow-up application-level fix.

Raw database edits are strongly discouraged because they bypass period locks,
role checks, audit logging, journal-entry side effects, numbering sequences,
status transitions, notifications, and validation. If an operation seems easier
as SQL, that is usually evidence that the UI, REST API, or MCP tool is missing a
capability that should be added.

### Feature Completion Rule

When adding or changing a user-facing feature, carry it through all applicable
control surfaces before calling the work complete:

- **UI:** the visible workflow renders, is reachable for the intended record
  status, and handles loading, empty, success, and failure states.
- **REST API:** the endpoint validates input, enforces org scope and roles,
  preserves accounting invariants, emits audit logs where appropriate, and
  returns enough structured data for the UI to refresh without guessing.
- **MCP/control plane:** add or update tools in `lib/mcp/tools/` when agents
  should be able to perform or inspect the same operation. Register new tool
  modules in `lib/mcp/tools/index.ts`.
- **Docs/runbook:** update this file or user docs when an operator procedure,
  endpoint, or MCP workflow changes.
- **Verification:** inspect the rendered UI or running artifact for the specific
  marker/control involved, not only local source or build output.

If MCP coverage is intentionally deferred, document the gap in the PR or final
handoff with the operation name, why it was deferred, and which UI/API path is
the temporary source of truth.

### UI Operation Expectations

For UI-driven tasks, prefer Kuri or browser automation over API shortcuts when
the task is meant to validate the user experience. A good UI operation should:

- Sign in as the `agent@robertmaefs.com` service account through the site
  manifest.
- Navigate through visible routes and controls instead of constructing private
  state.
- Capture a screenshot or other visual evidence after material UI changes.
- Check browser console errors when a page fails, hangs, or silently ignores an
  action.
- Confirm the resulting record through the UI or application API after the
  visible workflow completes.

---

## 1. Safe Deploy Process

### ⚠️ Pre-Deploy Rules (from AGENTS.md)

- **Never** run `npm run build` / `next build` for verification — use `npx tsc --noEmit`
- **Never** run `drizzle-kit push` against production
- **Never** write directly to the database — use UI, MCP, or REST API
- All schema changes require `npx drizzle-kit generate` + committed migration files

### Standard Deploy Flow

```bash
# 1. PRE-FLIGHT
cd /Users/TheTrebor/Projects/dubbl
git fetch origin
git status                         # no unintended changes
git log main..HEAD --oneline       # review incoming commits

# 2. TYPE-CHECK (NOT full build)
npx tsc --noEmit

# 3. REVIEW MIGRATIONS (if schema changed)
ls -la drizzle/                    # any new migration files?
git diff main -- drizzle/          # review migration SQL

# 4. BACKUP DATABASE
mkdir -p backups
docker exec dubbl-postgres-1 pg_dump -U dubbl dubbl \
  > backups/dubbl-$(date +%Y%m%d-%H%M).sql

# 5. BUILD & DEPLOY
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web

# 6. VERIFY
sleep 5
curl -s -o /dev/null -w "%{http_code}" https://invoice.robertmaefs.com/api/health
# Expected: 200

docker logs --tail 20 dubbl-web-1
# Check for: "Ready in" / no crash loop

# 7. VISUAL VERIFICATION (requires Kuri session — see §4)
# kuri_screenshot_site page="dashboard" project="/Users/TheTrebor/Projects/dubbl"
```

### Rollback

```bash
# If deploy fails:
docker compose -f docker-compose.prod.yml up -d web   # restart (rebuilds if needed) 
docker compose -f docker-compose.prod.yml restart web # just restart existing
# Restore DB if needed:
# docker exec -i dubbl-postgres-1 psql -U dubbl dubbl < backups/dubbl-DATE.sql
```

### Migration Execution

```bash
# After reviewing drizzle/ migration files:
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL=postgresql://dubbl:${POSTGRES_PASSWORD}@postgres:5432/dubbl \
  web npx drizzle-kit migrate
```

---

## 2. Operating Invoices & Bills

All operations use the REST API with the `dk_live_*` key.

### Authentication

```bash
API_KEY="dk_live_Ot1n-2-BdIizx1WQ-vwbtmwS8HYUaAuy"
BASE="https://invoice.robertmaefs.com"
AUTH="Authorization: Bearer $API_KEY"

curl -s -H "$AUTH" "$BASE/api/v1/organization"
```

### 💰 Critical: Integer Cents

All monetary **outputs** are in integer cents: `$12.50 = 1250`, `$4,220.50 = 422050`.

**Inputs** for create endpoints (`POST`): `unitPrice` is in **decimal dollars** (e.g. `12.50`). The system converts internally.

### Invoices

```bash
# List recent invoices
curl -s -H "$AUTH" "$BASE/api/v1/invoices?limit=20&page=1" | python3 -m json.tool

# Filter by status
curl -s -H "$AUTH" "$BASE/api/v1/invoices?status=sent&limit=50"

# Filter by contact
curl -s -H "$AUTH" "$BASE/api/v1/invoices?contactId=fbc8d158-1de5-47bf-95d6-c816e5f84ae1"

# Get single invoice with line items
curl -s -H "$AUTH" "$BASE/api/v1/invoices/1d709cb7-05bc-4b26-beb1-92a6d205886f"

# Create invoice
curl -s -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "contactId": "07b49adc-7c94-4592-993f-8949cd54fe13",
    "issueDate": "2026-06-30",
    "dueDate": "2026-07-30",
    "reference": "Consulting",
    "lines": [{
      "description": "Software development",
      "quantity": 10,
      "unitPrice": 150.00,
      "accountId": "<revenue-account-uuid>"
    }]
  }' "$BASE/api/v1/invoices"
```

### Bills (Accounts Payable)

```bash
# List bills
curl -s -H "$AUTH" "$BASE/api/v1/bills?limit=20"

# Get single bill
curl -s -H "$AUTH" "$BASE/api/v1/bills/<bill-id>"

# Create bill
curl -s -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "contactId": "<supplier-uuid>",
    "issueDate": "2026-06-30",
    "dueDate": "2026-07-30",
    "reference": "Supplier invoice #123",
    "lines": [{
      "description": "Office supplies",
      "quantity": 1,
      "unitPrice": 89.99,
      "accountId": "<expense-account-uuid>"
    }]
  }' "$BASE/api/v1/bills"
```

### Contacts

```bash
# List all contacts
curl -s -H "$AUTH" "$BASE/api/v1/contacts?limit=200"

# Filter customers only
curl -s -H "$AUTH" "$BASE/api/v1/contacts?type=customer"

# Search
curl -s -H "$AUTH" "$BASE/api/v1/contacts?search=Jordan"
```

### Chart of Accounts

```bash
# List all accounts
curl -s -H "$AUTH" "$BASE/api/v1/accounts?limit=200"

# Revenue accounts (for invoice line items)
curl -s -H "$AUTH" "$BASE/api/v1/accounts" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for a in d.get('accounts',[]):
    if a['type']=='revenue':
        print(f\"  {a['code']} | {a['name']} | {a['id']}\")
"

# Expense accounts (for bill line items)
# Same query, filter type=='expense'
```

### Reports

```bash
# Available report endpoints (check source for exact paths)
# /api/v1/reports/*
# P&L, balance sheet, AR aging, AP aging, trial balance, tax summary
```

---

## 3. Answering Questions

### Data Questions → MCP or REST API

For "how many," "who owes what," "what's the total" — prefer MCP tools when
available, otherwise query the REST API directly. Direct SQL is read-only
diagnostics and should not be the normal answer path.

### Visual Verification → Kuri

Requires an active Kuri session (signed into Dubbl). Once signed in:

```bash
kuri_screenshot_site page="dashboard" project="/Users/TheTrebor/Projects/dubbl"
kuri_screenshot_site page="sales" project="/Users/TheTrebor/Projects/dubbl"
kuri_screenshot_site page="purchases" project="/Users/TheTrebor/Projects/dubbl"
```

### Debugging

| Symptom | Investigation |
|---|---|
| Page not loading | `kuri_console_errors` + `docker logs dubbl-web-1` |
| API returns 401 | Check API key hasn't expired, org ID header |
| Amounts look wrong | Verify decimal vs. cents confusion |
| Docker down | `docker compose -f docker-compose.prod.yml ps` |

---

## 4. Kuri Setup

### Prerequisites

- Kuri server running (`kuri-start` or `KURI_ALLOW_PRIVATE=1 kuri`)
- Active session signed into `https://invoice.robertmaefs.com`

### Site Manifest

Located at `.sandcastle/site-manifest.yaml`. Available pages:

| Page | URL |
|---|---|
| `dashboard` | `/dashboard` |
| `sales` | `/sales` |
| `purchases` | `/purchases` |
| `contacts` | `/contacts` |
| `reports` | `/reports` |
| `accounting` | `/accounting` |
| `settings` | `/settings` |
| `documents` | `/documents` |
| `projects` | `/projects` |
| `tax` | `/tax` |

### Kuri Auth (Automated)

The site manifest at `.sandcastle/site-manifest.yaml` is configured with `form-login` auth using the agent service account (`agent@robertmaefs.com`). `kuri_screenshot_site` handles sign-in automatically.

```bash
# One-shot screenshot — handles auth, navigation, and capture
kuri_screenshot_site page="dashboard" project="/Users/TheTrebor/Projects/dubbl"
kuri_screenshot_site page="sales" project="/Users/TheTrebor/Projects/dubbl"
```

### Service Accounts

| Account | Email | Role | Auth Method |
|---|---|---|---|
| **Agent** | `agent@robertmaefs.com` | admin | Password (Kuri sessions) |
| **API Key** | `dk_live_...` | owner (via creator) | Bearer token (REST API) |
| **Owner** | `me@robertmaefs.com` | owner | Password (human use) |

---

## 5. Architecture

```
Internet → Cloudflare Tunnel → localhost:3456 (Mac Studio)
                                    ↓
                            dubbl-web-1 (Next.js :3000)
                                    ↓
                            dubbl-postgres-1 (PostgreSQL :5432)
```

### Key Files

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` | Production stack |
| `Dockerfile` | Multi-stage Next.js build |
| `Dockerfile.cron` | Cron job runner |
| `lib/db/schema/` | Database schema (Drizzle ORM) |
| `lib/mcp/tools/` | MCP server tools (22 categories) |
| `app/api/v1/` | REST API endpoints |
| `app/api/mcp/` | MCP HTTP transport |
| `app/(dashboard)/` | Internal dashboard pages |
| `app/portal/` | Customer-facing portal |
| `drizzle/` | Migration files |

### Docker Networks

| Container | Network | Port |
|---|---|---|
| `dubbl-web-1` | `dubbl_default` | `0.0.0.0:3456→3000` |
| `dubbl-postgres-1` | `dubbl_default` | `127.0.0.1:5432` |

---

## 6. Safety Rules

1. **Never write to PostgreSQL directly** — always through UI, MCP, or REST API
2. **All amounts in integer cents** (except create input `unitPrice` which is decimal)
3. **Never `drizzle-kit push` in production** — use migration files only
4. **Never full build for verification** — `npx tsc --noEmit` instead
5. **Check period locks** before modifying past transactions
6. **API key is org-scoped** — only accesses Robert Maefs Consulting, LLC
7. **Back up DB before every deploy**
8. **Carry user-facing features into MCP/control plane** when agents should operate them

---

## 7. Service Accounts

Two interfaces for agent operations:

| Account | Credential | Stored In | Use |
|---|---|---|---|
| Agent user | `agent@robertmaefs.com` / `chiliPepperz42@` | `tokens.json` → `dubbl.agent_password` | Kuri browser sign-in |
| API key | `dk_live_Ot1n-2-BdIizx1WQ-...` | `tokens.json` → `dubbl.api_key` | REST API queries |

The API key inherits the **owner** role because it was created by `me@robertmaefs.com`. The agent user has **admin** role — sufficient for all invoice/bill operations.

## 8. Current State (as of 2026-06-30)

| Metric | Value |
|---|---|
| Total invoices | 118 |
| Total bills | 1 |
| Total contacts | 9 (7 customers, 2 suppliers) |
| Chart of accounts | Active |
| Last invoice | INV-00239 (sent, $4,220.50) |
| Last deploy | Running `dubbl-web-1` |

---

## 9. Common Tasks

### Add a new contact

```bash
curl -s -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"New Client","email":"client@example.com","type":"customer"}' \
  "$BASE/api/v1/contacts"
```

### Check who owes money (AR aging)

```bash
# List overdue + sent invoices
curl -s -H "$AUTH" "$BASE/api/v1/invoices?status=overdue&limit=50"
curl -s -H "$AUTH" "$BASE/api/v1/invoices?status=sent&limit=50"
```

### Record a payment against an invoice

```bash
curl -s -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "amount": 422050,
    "date": "2026-07-01",
    "method": "bank_transfer",
    "status": "completed"
  }' \
  "$BASE/api/v1/invoices/1d709cb7-05bc-4b26-beb1-92a6d205886f/pay"
```

### Send an invoice to a customer

```bash
curl -s -H "$AUTH" -X POST \
  "$BASE/api/v1/invoices/1d709cb7-05bc-4b26-beb1-92a6d205886f/send"
```

### Void an invoice

```bash
curl -s -H "$AUTH" -X POST \
  "$BASE/api/v1/invoices/1d709cb7-05bc-4b26-beb1-92a6d205886f/void"
```

---

*Runbook maintained by pi.dev. Last updated: 2026-06-30.*
