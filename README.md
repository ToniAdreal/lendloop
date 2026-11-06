# LendLoop

**Borrow what you need. Lend what you don't.**

LendLoop is a (fictional) neighbourhood tool-lending app: neighbours list
tools they own, borrow each other's tools for a date range, and an automation
layer (n8n) sends request notifications and daily overdue reminders.

Built with **Next.js (App Router) + TypeScript**, **Clerk** for auth,
**Convex** as the realtime backend/database, and **n8n** for automation.

---

## Quick start

You need three free accounts (Clerk, Convex) and Docker for n8n. Everything
is configured through environment variables, see `.env.example` for the full
annotated list.

### 1. Install and configure the app

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` with your values:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk dashboard → your instance URL (e.g. `https://x.clerk.accounts.dev`). In Clerk, also create a JWT template named **convex**. |
| `NEXT_PUBLIC_CONVEX_URL` | Created by `npx convex dev` below (`.convex.cloud` URL) |
| `CONVEX_SITE_URL` | Same host as above but `.convex.site`, used by n8n |
| `N8N_WEBHOOK_URL` | Production webhook URL of the imported n8n workflow |
| `N8N_WEBHOOK_SECRET` | Invented by you: `openssl rand -hex 32` |
| `LENDLOOP_SHARED_SECRET` | Invented by you, different from the above |

### 2. Start Convex and seed demo data

```bash
npx convex dev          # creates/links a deployment, pushes schema + functions,
                        # regenerates convex/_generated with full types
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-instance.clerk.accounts.dev
npx convex env set N8N_WEBHOOK_URL http://localhost:5678/webhook/lendloop/request-events
npx convex env set N8N_WEBHOOK_SECRET <same value as .env.local>
npx convex env set LENDLOOP_SHARED_SECRET <same value as .env.local>
npx convex run seed:seed   # 10 demo tools, one active loan, one pending request
```

> Note: `convex/_generated/` is checked into this repo with lightweight stubs
> (built on `anyApi`) so the project compiles before a deployment exists.
> `npx convex dev` regenerates it with fully-typed references; no source
> changes are needed.

### 3. Run the app

```bash
npm run dev    # http://localhost:3000
```

The landing page is public and shows the read-only catalogue of available
tools (name + category only). Sign up via Clerk, and you land on the
dashboard: browse all tools, list your own, request loans, respond to
incoming requests.

**Becoming an admin:** sign up, then in the Convex dashboard set your row in
the `users` table to `role: "admin"` (deliberately manual, no self-service
promotion). The Admin tab then appears: remove any listing, view all loans,
toggle "Trusted Lender".

### 4. Start n8n and import the workflows

```bash
cp .env.example .env     # n8n only needs N8N_* , LENDLOOP_SHARED_SECRET,
                         # N8N_WEBHOOK_SECRET and CONVEX_SITE_URL from it
docker compose up -d     # n8n on http://localhost:5678
```

In n8n: create the owner account, then **Import from File** for each of:

1. `n8n/error-workflow.json` ("LendLoop - Error Handler")
2. `n8n/request-notification.json` ("LendLoop - Request Notification")
3. `n8n/overdue-reminders.json` ("LendLoop - Overdue Reminders")

Then, in workflows 2 and 3, open **Settings → Error Workflow** and select the
error handler (their exports carry the placeholder
`REPLACE_WITH_LENDLOOP_ERROR_WORKFLOW_ID`). Activate all three.

By default both notification paths are **mock channels that log** instead of
emailing. Each workflow also contains a real SMTP email node, disabled and
carrying a placeholder credential; configure a genuine credential and flip
the nodes when you want real mail.

### 5. Production build check

```bash
npm run build
```

Works with the dummy values from `.env.example`; data-backed pages are
force-dynamic, so no live backend is needed at build time.

---

## Architecture

```
                ┌──────────────┐   Clerk JWT    ┌──────────────────┐
  Browser ─────►│  Next.js app │───────────────►│  Convex backend  │
   (public page │  App Router  │◄───────────────│  queries/mutations│
    + dashboard)└──────────────┘   realtime data └──────┬───────────┘
                                                        │ scheduler
                                                        │ HMAC-signed
                                                        │ webhook action
                                                        ▼
                                                 ┌──────────────┐
                                                 │     n8n      │
                                                 │ 1. request   │
                                                 │    notifications
                                                 │ 2. daily     │── HMAC ──► GET  /overdue-loans
                                                 │    overdue   │── HMAC ──► POST /reminders/writeback
                                                 │    reminders │            (Convex HTTP actions)
                                                 │ 3. error     │
                                                 │    workflow  │
                                                 └──────────────┘
```

- **Next.js** renders the public landing page and the authenticated
  dashboard. All lending rules live in Convex; the UI is a thin client.
- **Clerk** handles sign-up/sign-in. `middleware.ts` protects everything
  except `/`, `/sign-in`, `/sign-up`. On first sign-in, `UserSync` calls
  `users.syncUser`, which upserts the profile row that RBAC reads.
- **Convex** (`convex/`)
  - `schema.ts`, users, tools, borrowRequests, automationEvents, reminders.
  - `tools.ts`, public catalogue projection + listing CRUD.
  - `requests.ts`, the loan lifecycle: create → pending → approved/declined →
    returned, with overlap checks both at request time and approval time.
  - `webhooks.ts`, an internal action, scheduled by the request mutations,
    that POSTs an HMAC-signed event to n8n and logs the outcome.
  - `http.ts`, HTTP actions for n8n: `GET /overdue-loans` and
    `POST /reminders/writeback`, both HMAC-authenticated with a 5-minute
    timestamp window. The write-back is idempotent on `idempotencyKey`.
  - `automation.ts`, the per-loan automation activity feed shown in the UI.
- **n8n** (`n8n/`)
  1. **Request notification**, webhook-triggered, verifies the Convex HMAC
     signature, then notifies (mock-log by default, SMTP node included but
     disabled).
  2. **Overdue reminders**, daily schedule; signs a GET to the Convex
     overdue endpoint, composes one reminder per borrower, and writes the
     result back through the idempotent endpoint. A same-day re-run is a
     no-op thanks to the `loanId:date` idempotency key.
  3. **Error handler**, error-trigger workflow referenced by 1 and 2; logs a
     normalized alert (email alert node included, disabled).

### Signature schemes

| Hop | Signed content | Header |
| --- | --- | --- |
| Convex → n8n webhook | raw JSON body | `x-lendloop-signature` |
| n8n → Convex GET | `` `${timestamp}.GET./overdue-loans` `` | `x-lendloop-signature` + `x-lendloop-timestamp` |
| n8n → Convex POST | `` `${timestamp}.${rawBody}` `` | same |

All are hex HMAC-SHA256. Secrets live only in environment variables; the
exported workflow JSON contains no secrets, only `$env` references and
credential placeholders.

---

## Security and data-minimization decisions

- **RBAC is enforced inside Convex functions**, never just by hiding UI:
  owners can edit/delete only their own listings and respond only to requests
  on their tools; borrowers act only on their own requests; admin functions
  (`removeAny`, `listAllLoans`, `listAllUsers`, `setTrustedLender`) call
  `requireAdmin` server-side. The per-loan automation feed re-checks that the
  viewer is the borrower, the owner, or an admin.
- **The public catalogue leaks nothing**: `tools.listPublic` projects to
  `{ name, category }` for currently-available tools only. No owner names,
  ids, descriptions, or request history leave the backend.
- **Email addresses are need-to-know**: `borrowerEmail` exists on a request
  solely so reminders can be delivered. It is stripped from owner-facing and
  borrower-facing list queries, excluded from webhook payloads, and returned
  only by the HMAC-authenticated overdue endpoint, which returns exactly the
  fields the reminder step needs.
- **Webhooks are authenticated both ways** (HMAC + timestamp window on the
  HTTP endpoints, constant-time comparison) so a leaked URL alone is useless.
- **Idempotent write-back** makes n8n retries safe; duplicate reminder
  records cannot accumulate.
- **Overlap safety**: an approval that would double-book a tool is rejected
  server-side even if two requests race.
- **No secrets in the repo**: `.env.example` ships only well-formed dummy
  values; n8n exports use `$env` references and placeholder credentials.
- Demo seed users (`seed_*` Clerk ids, `@lendloop.example` addresses) are
  fictional, cannot sign in, and should be deleted before real use.

## What I would change for production

- **Real email delivery**: wire the SMTP/transactional provider (or an
  official email node credential) and resolve lender addresses server-side
  instead of the placeholder recipient in the notification workflow.
- **Generated Convex types**: commit the real `convex/_generated` output and
  drop the `anyApi` stubs; add `convex-test` coverage for the RBAC matrix
  and the overlap rules, plus a CI build.
- **Rate limits and abuse controls**: cap requests per user/day, add Clerk
  bot protection, and add an admin moderation queue + audit log for listing
  removals.
- **Reminders at scale**: page the overdue endpoint, move from a daily sweep
  to per-loan scheduled jobs, and add borrower-visible reminder preferences.
- **Loan ergonomics**: pickup/return confirmation from both sides (two-party
  close-out), photo condition check on return, deposits/insurance hooks.
- **Ops**: host n8n behind HTTPS with basic auth/OIDC, rotate the shared
  secrets, ship workflow + function logs to a real alerting channel, and pin
  the n8n image to a version instead of `latest`.
- **Data lifecycle**: retention policy for automation logs, and account
  deletion that cascades a user's listings and requests (GDPR-style export
  and erase).

## Repo layout

```
app/            Next.js routes (landing, sign-in/up, dashboard)
components/     Client components (catalogue, dashboard tabs, providers)
convex/         Schema, functions, HTTP endpoints, webhook action, seed
n8n/            Importable workflow exports (no secrets)
docker-compose.yml   Self-hosted n8n
.env.example    Every required variable, annotated
```
