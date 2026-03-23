# Superhuman-cpa-OS Scaffold Design — superhuman-cpa-OS-tax

**Date:** 2026-03-18
**Project:** Superhuman-cpa-OS Tax — AI-native done-for-you tax preparation service
**Replaces:** grove.tax

---

## 1. Product Overview

An AI-native, done-for-you tax preparation platform for individual filers. The platform is multi-sided: taxpayers submit their information through multiple channels, credentialed tax professionals (pros) review and sign returns, and Superhuman-cpa-OS staff manage operations. The AI handles the bulk of preparation work; IRS Circular 230 defines the nodes where a credentialed professional must be in the loop.

**In scope (v1):** All 1040-series returns and associated schedules/forms at TurboTax parity (see Section 12). Business entity returns (1120, 1065) are deferred.

**Business model:** Per-return fee. Subscription-ready (orders table supports future migration).

**Multi-tenancy:** The data model and routing support multiple firms operating the service under their own branding (white-label). Superhuman-cpa-OS itself is the default tenant.

---

## 2. Architecture

### 2.1 Structure

Domain-split monorepo. One repository, five independently deployable services, one shared types package. Build tooling: Bun workspaces (root `package.json` with `workspaces: ["packages/*", "services/*"]`).

```
superhuman-cpa-OS-tax/
  package.json              — Bun workspace root
  packages/
    types/                  — shared TypeScript types, Zod schemas, DB row types
  services/
    frontend/               — React + Vite + Tailwind (taxpayer, pro, staff UIs)
    api/                    — Bun HTTP: auth, intake CRUD, returns, billing, SSE proxy
    ai-worker/              — Bun: Claude SDK, streaming, voice, document OCR
    practitioner/           — Bun HTTP: Circular 230 workflow, pro task queue
    db/                     — migrations only (SQL files + migration runner CLI)
  agent-context/
    init/scaffold-task.md
    domain/circular-230-rules.md
    domain/supported-forms.md  — canonical list of supported 1040 schedules and forms
  k8s/
  docs/
  .github/
```

**Note on `services/db/`:** Migrations-only package — no runnable process. Contains raw SQL migration files and a Bun CLI (`migrate.ts`). PostgreSQL runs as a separate K8s deployment. Migrations run as a K8s Job before each deploy.

### 2.2 Request Flow

**Sync path (CRUD, auth):**
```
browser → frontend → api → db
```

**AI path (streaming):**
```
browser → api: POST /ai/start-session → { sessionId }
browser → api: GET /ai/stream/:sessionId (SSE)
api → ai-worker: POST /sessions/:sessionId/start (internal HTTP)
ai-worker → api: SSE stream (api proxies to browser)
ai-worker → api: POST /internal/* (all state writes)
api → db
```

**Pro workflow path:**
```
pro browser → frontend → api (proxy) → practitioner: POST /tasks/:id/resolve
practitioner → api: POST /internal/returns/:id/status (status advance)
practitioner → ai-worker: POST /sessions/resume/:returnId
api → db
```

**Key rule:** All database writes go through `api`. `ai-worker` and `practitioner` call `api` internal endpoints to persist all state changes.

### 2.3 Internal API Routes

`api` exposes two route namespaces:

**Public routes** (browser-facing, JWT-authenticated):
- `POST /ai/start-session`, `GET /ai/stream/:sessionId`
- `GET /notifications/stream`
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `POST /documents/presign`, `POST /documents/confirm`
- `GET /returns`, `POST /returns`, `GET /returns/:id`
- `GET /pro/tasks`, `POST /pro/tasks/:id/accept`, `POST /pro/tasks/:id/resolve`
- `POST /admin/users/:id/verify-ptin` (staff only)
- `POST /call-sessions/:id/link-return` (staff only)
- `POST /call-sessions/:id/create-return` (staff only)
- `POST /webhooks/twilio/call-complete`
- `POST /webhooks/twilio/sms-status` — delivery status callback for outbound SMS

**Internal routes** (`X-Internal-Secret` authenticated, not browser-accessible):
- `POST /internal/returns/:id/fields` — set a return field
- `POST /internal/returns/:id/flag-for-pro-review` — create pro_tasks + set pending_pro_review
- `POST /internal/returns/:id/status` — advance status (restricted by caller identity)
- `PATCH /internal/documents/:id` — update extracted_data after OCR
- `PATCH /internal/call-sessions/:id` — update call_sessions fields (extracted_data, status, intake_session_id)
- `POST /internal/notifications` — create and deliver a notification (email, in-app, or SMS)
- `POST /internal/threads/message` — create thread + thread_messages row
- `POST /internal/users/:id/activate` — set users.status = active

### 2.4 Inter-Service Transport

Internal HTTP within the K8s cluster (cluster DNS). All inter-service calls include:
- `X-Internal-Secret: $INTER_SERVICE_SECRET` — shared secret for service authentication
- `X-Caller: api|ai-worker|practitioner` — identity of the calling service

All services validate `X-Internal-Secret` on **inbound** internal calls, including `ai-worker` (which receives OCR triggers and resume callbacks from `api` and `practitioner` respectively).

`api` uses `X-Caller` to enforce which services may trigger which status transitions. Retry logic: exponential backoff, max 3 attempts. Stalled jobs recoverable via DB polling.

### 2.5 DB Write Ownership

| Service | Status transitions permitted via `api` |
|---------|---------------------------------------|
| `ai-worker` | `intake → ai_prep`, `ai_prep → pending_pro_review` |
| `practitioner` | `pending_pro_review → review`, `review → signed` |
| `api` (staff) | `signed → filed` |

`api` rejects transitions outside this matrix based on `X-Caller` header.

**Resumed AI sessions:** operate under the same constraints as the original — can set fields, create notifications, request documents, and call `flag_for_pro_review` again if another gate is hit. Cannot advance to `signed` or `filed`.

### 2.6 Key Design Decisions

- **Single DB writer:** All state writes go through `api` internal endpoints.
- **SSE proxy:** `api` proxies the ai-worker SSE stream. Auth enforcement stays at the `api` boundary.
- **Single `api` replica in v1:** Notification fan-out and SSE connections use in-process state. Multi-replica scaling (with Redis pub/sub) is deferred.
- **Shared types:** All services import from `packages/types`.
- **Firm-scoped routing:** All public routes are firm-aware via `X-Firm-ID` header or subdomain resolution. `api` resolves firm on every request and scopes all DB queries accordingly.

---

## 3. Multi-Tenancy (Firms)

Superhuman-cpa-OS Tax supports multiple firms operating the service — each with their own branded experience, their own pros, and their own taxpayer data. Superhuman-cpa-OS itself is a firm (`slug: "superhuman-cpa-OS"`).

### 3.1 Firms Table

**firms**
- `id` uuid pk
- `name` text — display name (e.g., "Superhuman-cpa-OS Tax", "Acme Tax Partners")
- `slug` text unique — used for subdomain routing (e.g., `acme.superhuman-cpa-OS.tax`)
- `branding` jsonb — logo URL, primary color, custom domain (nullable)
- `status` active|suspended
- `created_at` timestamptz

### 3.2 Firm Scoping

- `users.firm_id` → firms — every user belongs to exactly one firm
- `tax_returns.firm_id` → firms — every return is scoped to a firm
- Superhuman-cpa-OS staff (firm_id = Superhuman-cpa-OS firm) have platform-wide visibility; firm-level staff see only their firm
- `api` middleware resolves the firm from the request (subdomain or `X-Firm-ID` header) and injects `firm_id` into all DB queries
- Cross-firm data access is rejected at the middleware layer

### 3.3 Firm Routing

Requests are associated with a firm by one of two mechanisms:
- **Subdomain:** `acme.superhuman-cpa-OS.tax` → resolved to `firms` row by slug
- **Header:** `X-Firm-ID: <uuid>` — used for internal and API clients

Unauthenticated requests (register, login) resolve firm from the subdomain/header before creating or authenticating the user.

---

## 4. User Roles

| Role | Description | Circular 230 |
|------|-------------|--------------|
| `taxpayer` | End customer. Submits info, pays, receives filed return. | No credentials required |
| `pro` | Credentialed tax professional (CPA, EA, attorney) with PTIN. Reviews, advises, signs. | Accountable under Circular 230 |
| `staff` | Internal ops. Manages assignments, escalations, call assist, QA. Superhuman-cpa-OS staff are platform-wide; firm staff are firm-scoped. | No credentials required |

**Pro registration and activation flow:**
1. Pro registers via standard form → `users.status = pending_ptin_verification`
2. Pro can log in and sees a "pending verification" screen; no dashboard or task queue access
3. Staff calls `POST /admin/users/:id/verify-ptin` from staff dashboard. `api` validates staff JWT, then calls `practitioner POST /users/:id/verify-ptin` as a backend step. `practitioner` calls `api POST /internal/users/:id/activate`.
4. Pro's next page load lands on the pro dashboard

---

## 5. Data Model

### Core Tables

**firms** — see Section 3.1

**users**
- `id` uuid pk
- `firm_id` → firms
- `email` text
- `role` taxpayer|pro|staff
- `status` active|pending_ptin_verification|suspended
- `phone_number` text (nullable — required for SMS notifications)
- `passkey_credential` jsonb (nullable — set after passkey enrollment)
- `password_hash` text (nullable — fallback credential)
- `created_at` timestamptz
- unique constraint: `(firm_id, email)`

**tax_returns**
- `id` uuid pk
- `firm_id` → firms
- `taxpayer_id` → users
- `pro_id` → users (nullable — assigned by staff)
- `tax_year` int
- `base_form` 1040|1040-SR|1040-NR|1040-NR-EZ — the primary return type
- `schedules` text[] — active schedules/forms for this return (e.g., `["schedule-c", "schedule-d", "form-8949"]`); drives which fields Claude must collect and which required-field checks apply
- `status` intake|ai_prep|pending_pro_review|review|signed|filed
- `payment_status` unpaid|paid|refunded (denormalized; `orders` is source of truth)
- `data` jsonb — all extracted fields across all active schedules
- `filing_deadline` date
- `created_at` timestamptz

**intake_sessions**
- `id` uuid pk
- `return_id` → tax_returns
- `channel` chat|voice|wizard|upload|phone
- `messages` jsonb — array of Anthropic message objects: `[{ role: "user"|"assistant", content: string | ContentBlock[] }]`. Tool call turns (tool_use and tool_result blocks) stored in full for session resume.
- `status` open|complete|abandoned
- `created_at` timestamptz

**documents**
- `id` uuid pk
- `return_id` → tax_returns
- `doc_type` w2|1099-nec|1099-misc|1099-b|1099-div|1099-int|1099-r|k1|schedule-c-records|receipt|other
- `storage_key` text — DO Spaces object key
- `extracted_data` jsonb — OCR output (written via `PATCH /internal/documents/:id`)
- `verified` bool default false
- `created_at` timestamptz

**pro_tasks** (Circular 230 gates)
- `id` uuid pk
- `return_id` → tax_returns
- `pro_id` → users (nullable — null = unassigned; visible to all pros and staff in the unassigned queue)
- `gate_type` review|sign|advice|represent
- `status` pending|in_review|approved|rejected
- `notes` text
- `completed_at` timestamptz
- `created_at` timestamptz

**orders** — invoice header, one per return
- `id` uuid pk
- `firm_id` → firms
- `return_id` → tax_returns
- `taxpayer_id` → users
- `total_cents` int — sum of order_items; denormalized for display
- `status` pending|paid|partially_refunded|refunded
- `payment_intent_id` text
- `created_at` timestamptz

**order_items** — one row per product on the order
- `id` uuid pk
- `order_id` → orders
- `product_type` tax_preparation|audit_protection|refund_transfer|refund_advance
- `amount_cents` int
- `status` pending|paid|refunded|voided
- `metadata` jsonb — product-specific fields (e.g., `{ "coverage_years": 3 }` for audit protection, `{ "bank_partner": "tpg", "advance_amount_cents": 50000 }` for bank products)
- `created_at` timestamptz

New product types are additive: add an enum value, handle it in billing logic, no schema migration required beyond that.

### Communications Tables

**threads**
- `id` uuid pk
- `firm_id` → firms
- `return_id` → tax_returns (nullable)
- `channel` chat|async|email|phone|sms
- `participants` uuid[] — exactly two human users: one `taxpayer` + one `pro` or `staff`. AI messages (`sender_id = null`) are exempt — the participant list tracks inbox access, not message authorship. Staff-to-staff and pro-to-staff threads are out of scope for v1.
- `subject` text (nullable)
- `status` open|resolved
- `created_at` timestamptz

**thread_messages**
- `id` uuid pk
- `thread_id` → threads
- `sender_id` → users (nullable — null = AI-authored)
- `ai_assisted` bool default false
- `body` text
- `read_at` timestamptz (nullable)
- `created_at` timestamptz

**notifications**
- `id` uuid pk
- `firm_id` → firms
- `recipient_id` → users
- `return_id` → tax_returns (nullable)
- `type` status_change|doc_request|nudge|filing_confirm|reminder…
- `channel` email|in_app|sms
- `payload` jsonb — structured data for rendering (e.g., `{ return_year: 2024, status: "review" }`); frontend and SMS templates map `type + payload` to message text
- `sent_at` timestamptz (nullable)
- `read_at` timestamptz (nullable)
- `created_at` timestamptz

**call_sessions** (first-class intake channel)
- `id` uuid pk
- `intake_session_id` → intake_sessions (set post-call; links to phone intake_sessions row)
- `return_id` → tax_returns (nullable)
- `taxpayer_id` → users
- `agent_id` → users (staff or pro on the call)
- `twilio_sid` text (set at call creation by Twilio webhook)
- `status` scheduled|active|completed
- `transcript` text (nullable)
- `extracted_data` jsonb — fields captured during call
- `ai_assist_log` jsonb — `[{ timestamp, prompt, transcript_excerpt }]`
- `duration_seconds` int
- `recording_url` text (nullable)
- `created_at` timestamptz

### Return Lifecycle

```
intake → ai_prep → pending_pro_review → review → signed → filed
```

| From | To | Authority |
|------|----|-----------|
| `intake` | `ai_prep` | `ai-worker` → `api` |
| `ai_prep` | `pending_pro_review` | `ai-worker` → `api` |
| `pending_pro_review` | `review` | `practitioner` → `api` |
| `review` | `signed` | `practitioner` → `api` |
| `signed` | `filed` | `api` (staff-initiated) |

---

## 6. Supported 1040 Forms & Schedules

Superhuman-cpa-OS Tax v1 targets TurboTax parity for individual returns. The canonical list is maintained in `agent-context/domain/supported-forms.md` and referenced by `ai-worker` to determine which fields Claude must collect for a given return.

**Base returns:** 1040, 1040-SR, 1040-NR, 1040-NR-EZ

**Schedules:**

| Schedule | Purpose |
|----------|---------|
| Schedule A | Itemized deductions |
| Schedule B | Interest and dividend income |
| Schedule C | Self-employment / sole proprietor income |
| Schedule D | Capital gains and losses |
| Schedule E | Supplemental income (rentals, royalties, pass-through K-1s) |
| Schedule F | Farming income |
| Schedule SE | Self-employment tax |

**Common supplemental forms:**

| Form | Purpose |
|------|---------|
| Form 1099-NEC / 1099-MISC | Non-employee compensation |
| Form 1099-B | Broker proceeds |
| Form 1099-DIV | Dividends |
| Form 1099-INT | Interest income |
| Form 1099-R | Retirement distributions |
| Form 1099-G | Government payments (unemployment, state refunds) |
| Schedule K-1 (1065) | Partnership income |
| Schedule K-1 (1120-S) | S-corporation income |
| Schedule K-1 (1041) | Estate/trust income |
| Form 8949 | Capital asset sales detail |
| Form 4562 | Depreciation and amortization |
| Form 8863 | Education credits |
| Form 8962 | ACA premium tax credit reconciliation |
| Form 2441 | Child and dependent care |
| Form 8812 | Child tax credit |
| Form 5695 | Residential energy credits |
| Form 1116 | Foreign tax credit |
| Form 2555 | Foreign earned income exclusion |

**Extensibility:** `tax_returns.schedules` is a `text[]` array. Adding support for a new form requires: (1) adding it to `supported-forms.md`, (2) defining its required fields in `packages/types`, and (3) updating the `ai-worker` field validation logic. No schema migration is needed for the return itself — `tax_returns.data` is a jsonb bag that grows with new fields.

---

## 7. AI Orchestration

### 7.1 Intake Pipeline

All channels except phone feed into a multi-turn Claude session per return, backed by `intake_sessions`. Phone intake uses stateless AI assist prompts (Section 8); its output merges into the return post-call.

**Channels:**
- **Chat:** taxpayer text → Claude session
- **Voice AI:** audio → Whisper → text → Claude session
- **Document upload:** OCR pipeline (Section 11); output merged into return fields directly
- **Wizard:** structured JSON → Claude session
- **Phone:** stateless AI prompts during call; post-call merge (not a Claude session)

### 7.2 Claude Tool Set

| Tool | Purpose | Calls |
|------|---------|-------|
| `set_return_field` | Fill a return field, cite source | `api POST /internal/returns/:id/fields` |
| `add_schedule` | Add a schedule/form to `tax_returns.schedules` | `api POST /internal/returns/:id/schedules` |
| `request_document` | Ask taxpayer to upload a doc | `api POST /internal/notifications` (type=doc_request) |
| `flag_for_pro_review` | Trigger Circular 230 gate | `api POST /internal/returns/:id/flag-for-pro-review` |
| `advance_return_status` | Move return to `ai_prep` only | `api POST /internal/returns/:id/status` (validates required fields for all active schedules first) |
| `send_message` | Send async inbox message | `api POST /internal/threads/message` |
| `create_notification` | Trigger email, in-app, or SMS alert | `api POST /internal/notifications` |

**`add_schedule` tool:** Claude calls this when the taxpayer's situation reveals a new applicable schedule (e.g., "I freelanced this year" → adds `schedule-c`). This updates `tax_returns.schedules` and expands the required-field checklist Claude must satisfy before advancing.

**`advance_return_status` validation:** `ai-worker` checks that `tax_returns.data` contains all required fields for every schedule in `tax_returns.schedules` before advancing. Missing fields → Claude asks for them.

**OCR field writes (outside Claude session):** `ai-worker` calls `api PATCH /internal/documents/:id` to save OCR output, then calls `api POST /internal/returns/:id/fields` directly for each confirmed value.

### 7.3 SSE Session Lifecycle

```
1. Browser: POST /ai/start-session → { sessionId }
2. Browser: GET /ai/stream/:sessionId (SSE to api)
3. api → ai-worker: POST /sessions/:sessionId/start
4. ai-worker streams SSE → api proxies → browser
```

**SSE event types:** `token`, `field_update ({ field, value, source })`, `schedule_added ({ schedule })`, `session_paused ({ reason, gate_type })`, `session_complete`, `session_error ({ message })`

**Stream error handling:** If `ai-worker` crashes or drops, `api` sends `session_error` and closes the browser connection. Client retries via `POST /ai/start-session` with `{ returnId }` to resume from `intake_sessions.messages`.

**Token refresh and SSE:** Browser calls `POST /auth/refresh` before expiry. SSE connections authenticate at connection start; mid-stream expiry does not terminate the connection.

### 7.4 flag_for_pro_review — Pause and Resume

**Pause:**
1. `ai-worker` calls `api POST /internal/returns/:id/flag-for-pro-review { reason, gate_type }`
2. `api` creates `pro_tasks` row with `pro_id = tax_returns.pro_id` (nullable — if null, task enters the unassigned queue)
3. `api` sets `tax_returns.status = pending_pro_review`
4. `ai-worker` sends `session_paused` SSE event, closes stream
5. `api` notifies assigned pro via email + in-app + SMS (if `pro_id` null, notifies staff to assign)

**Resume:**
1. Pro resolves via `POST /pro/tasks/:id/resolve` → `api` → `practitioner`
2. `practitioner` calls `api` to advance to `review`
3. `practitioner` calls `ai-worker POST /sessions/resume/:returnId` with resolution notes
4. `ai-worker` loads `intake_sessions.messages`, appends synthetic user message with pro notes, starts new Claude session

### 7.5 Circular 230 Enforcement

**Layer 1:** Claude's system prompt contains the Circular 230 ruleset; must call `flag_for_pro_review` on gray-area detection.

**Layer 2:** `api` accepts status advances to `review`/`signed`/`filed` only from `X-Caller: practitioner`. All others receive `403`.

---

## 8. Practitioner Service

Internal-only. Browser calls reach it via `api` after JWT validation.

**Authentication:** `X-Internal-Secret` on all inbound calls. Outbound calls include `X-Internal-Secret` + `X-Caller: practitioner`.

**API surface:**
- `GET /tasks?pro_id=` — list pro_tasks (firm-scoped)
- `POST /tasks/:id/accept` — sets `in_review`
- `POST /tasks/:id/resolve` — approve/reject; triggers `api` status advance + `ai-worker` resume
- `POST /returns/:id/advance` — validates gate, calls `api POST /internal/returns/:id/status`
- `POST /users/:id/verify-ptin` — calls `api POST /internal/users/:id/activate`

---

## 9. Communications Layer

| Channel | Description |
|---------|-------------|
| Chat | Real-time text via AI SSE stream or thread messages |
| Async message | Threaded inbox. One taxpayer + one pro/staff per thread. |
| Email | Transactional via Resend |
| SMS | Transactional reminders and alerts via Twilio SMS |
| Voice AI | Taxpayer ↔ Claude directly. Audio → Whisper → Claude session. |
| Phone | Human agent + stateless AI assist prompts per transcript chunk. |

**Deferred:** Voice AI ↔ Phone handoff.

### SMS

SMS is delivered via Twilio (same account used for phone calls). `api` sends outbound SMS when a `notifications` row with `channel = sms` is created. Message body is rendered server-side from `type + payload` using a template map. Delivery status is updated via `POST /webhooks/twilio/sms-status`.

`users.phone_number` must be set for SMS delivery. If null, `api` falls back to email.

### In-App Notifications

`GET /notifications/stream` — separate persistent SSE from AI stream. `api` holds connections in-process and pushes on `channel = in_app` notification creation. Single replica in v1.

### Phone Intake

Stateless Claude calls per transcript chunk generate real-time prompts for the human agent.

**Post-call processing:**
1. Twilio webhook POSTs to `api POST /webhooks/twilio/call-complete`
2. `api` calls `ai-worker POST /process-call { callSessionId }` (internal, authenticated)
3. `ai-worker` fetches recording from DO Spaces, runs Whisper transcription, extracts fields
4. `ai-worker` calls `api PATCH /internal/call-sessions/:id { extracted_data, transcript, status: "completed" }`
5. If `return_id` is set: `ai-worker` calls `api POST /internal/returns/:id/fields`; `api` creates `intake_sessions` row and sets `call_sessions.intake_session_id`

**Null return — post-call merge:** Staff calls `POST /call-sessions/:id/link-return { returnId }` or `POST /call-sessions/:id/create-return`.

### AI Role in Communications

- Drafts async messages (`ai_assisted=true`, human reviews before send)
- Generates nudge notifications and SMS reminders for stalled returns
- Stateless prompt generation for call assist panel
- Post-call transcript transcription and extraction via Whisper

---

## 10. Authentication

- **Passkey-first** — WebAuthn; `users.passkey_credential` jsonb
- **Email/password fallback** — bcrypt; `users.password_hash`
- **JWT** — access token (15min) + refresh token (7 days); HTTP-only cookies; payload `{ userId, role, status, firmId }`
- **Token refresh** — `POST /auth/refresh`; client refreshes before expiry and before new SSE sessions
- **Firm scoping** — JWT payload includes `firmId`; `api` middleware enforces firm isolation on all DB queries
- **Role-scoped routing** — `api` middleware checks `role` on every request
- **Status gate** — `pro` with `status != active` → `403`. Taxpayer/staff not gated.

---

## 11. Testing

- **Vitest** — unit tests against real SQLite fixtures; no mocks
- **Playwright** — headless Chromium E2E: taxpayer intake, pro review/sign-off, staff call assist
- **Circular 230 gate suite** — Vitest: `api` rejects wrong-caller transitions; `practitioner` rejects advances without correct gate
- **Multi-tenancy suite** — Vitest: cross-firm data access is rejected at the middleware layer; firm isolation enforced on all queries

---

## 12. Deployment

| Layer | Technology |
|-------|-----------|
| CI/CD | GitHub Actions — typecheck + Vitest + Playwright on PR; deploy on `main` |
| Hosting | DigitalOcean Kubernetes — single `api` replica in v1 |
| Storage | DigitalOcean Spaces — documents, recordings |
| Edge | Cloudflare — DNS, CDN, DDoS; subdomain routing for firms |
| Email | Resend |
| SMS / Phone | Twilio |

### K8s Deployments

| Deployment | Notes |
|-----------|-------|
| `frontend` | Nginx |
| `api` | Public-facing; single replica in v1 |
| `ai-worker` | Internal only |
| `practitioner` | Internal only |
| `db` | PostgreSQL + persistent volume |
| `db-migrate` (Job) | Runs `migrate.ts` before each deploy |

### Document Upload Path

1. `POST /documents/presign` → `{ uploadUrl, storageKey }` (5min TTL)
2. Browser uploads directly to DO Spaces
3. `POST /documents/confirm { storageKey, returnId, docType }`
4. `api` creates `documents` row, calls `ai-worker POST /ocr { documentId }`
5. `ai-worker` runs OCR, calls `api PATCH /internal/documents/:id { extracted_data }`
6. `ai-worker` calls `api POST /internal/returns/:id/fields` for each confirmed value

### Environment Variables

| Variable | Used by |
|----------|---------|
| `INTER_SERVICE_SECRET` | All services |
| `ANTHROPIC_API_KEY` | `ai-worker` |
| `RESEND_API_KEY` | `api` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | `api` (SMS + webhooks), `ai-worker` (call processing) |
| `DATABASE_URL` | `api`, `db-migrate` |
| `DO_SPACES_KEY` / `DO_SPACES_SECRET` / `DO_SPACES_BUCKET` | `api` (presign), `ai-worker` (OCR + call recordings) |
| `JWT_SECRET` | `api` |

---

## 13. Future Features (Deferred)

- Business entity returns (1120, 1065)
- Voice AI ↔ Phone handoff
- Subscription billing
- IRS e-filing integration
- Bank product partner integrations (TPG, Refund Advantage, Civista) — `order_items` model is ready, bank API wiring is deferred
- Third-party integrations: Plaid, payroll APIs
- Multi-replica `api` with Redis pub/sub for notification fan-out
