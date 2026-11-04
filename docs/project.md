# Project: Askwell

An AI support chat widget for any website. A business adds its product info (text or PDF), copies one `<script>` tag, and gets a chat bot that answers visitor questions from that info.

This file is the source of truth for **what** we build. `docs/plan.md` says **in what order**. Tasks, owners and status live in JSM HQ.

---

## 1. Users

| User         | What they do                                                                                          | Where        |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------ |
| **Owner**    | Signs up, creates a project, adds knowledge, customizes the widget, reads conversations, pays for Pro | Dashboard    |
| **Visitor**  | Opens the chat on the owner's website, asks questions, gets answers                                   | Widget       |
| **Prospect** | Learns what the product does, sees pricing, signs up                                                  | Landing page |

---

## 2. Core flow

The whole product in one flow. When this works end to end, the product is done.

1. Open the landing page. The app's own chat widget is in the corner.
2. Ask it a product question. It answers from its knowledge.
3. Sign up. Create a project. Upload a product PDF in Knowledge.
4. Copy the script tag from Install. Paste it into a plain HTML page. The widget appears.
5. Ask a question on that page. The answer comes from the PDF.
6. Open Conversations. The chat is there.
7. Open Customize. Paywall.
8. Upgrade to Pro with a Razorpay test-mode payment. Customize unlocks.
9. Change the button color. Reload the HTML page. The new color shows.

---

## 3. Stack

| Layer            | Tool                                         | Notes                                                                                   |
| ---------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| App              | Next.js (App Router) + TypeScript + Tailwind | Landing (`/`), dashboard (`/dashboard`), widget panel (`/embed`), API routes (`/api/*`) |
| Widget loader    | Vanilla TypeScript, bundled to one file      | Runs on the customer's site. Button + iframe. Under 5 kb.                               |
| Database         | Supabase Postgres + pgvector                 | Two projects: dev (shared by developers and Vercel previews) and production. The app talks to it only through `supabase-js` and the Data API (§7). |
| Data access      | `supabase-js`, Postgres functions (`rpc()`)  | Owner client (the owner's Clerk token, RLS applies) and a server-only service client (secret key). Plan and quota limits run inside Postgres functions. |
| Migrations + types | Supabase CLI                               | SQL files in `supabase/migrations`; types generated into `packages/db/types.ts` (`pnpm db:types`). Tests run on pglite with Supabase's roles stubbed, never a local Supabase stack. |
| File storage     | Supabase Storage (`supabase-js`)             | Private `knowledge` bucket (10 MB, PDF/Markdown/TXT), created by a migration. The browser uploads straight to Storage with a one-time signed URL. |
| Hosting          | Vercel                                       | Preview deployment per PR; production from `main`. Request bodies are capped at 4.5 MB, so files never pass through our routes. |
| Auth             | Clerk                                        | Sign in / sign up UI, sessions, middleware. Supabase accepts Clerk session tokens (third-party auth), so RLS reads the user ID from `auth.jwt()->>'sub'`. |
| Payments         | Razorpay Subscriptions (test mode first)      | A monthly Pro subscription charged in INR, in Razorpay Checkout: UPI, Indian cards, eNACH, and international cards once Razorpay enables them on the account. Razorpay webhook with signature check. No Stripe, no Clerk Billing. |
| AI               | Groq (chat) + Ollama on our own server (embeddings), through the Vercel AI SDK | Chat: Groq `openai/gpt-oss-20b`, falling back to other Groq models when one is throttled (set `GROQ_CHAT_MODEL` to change it), so a visitor waits seconds, not a minute. Embeddings: `nomic-embed-text` on our Ollama server (768 dims, zero-padded to the 1536-wide column; cosine results are unchanged), reached over HTTPS with a Bearer key. |
| Security         | Arcjet                                       | On the public widget routes: a fixed-window rate limit per route + public key + IP, and prompt injection detection on chat messages before any AI call. Fails open: an Arcjet error or timeout lets the request through and is logged. The monthly message quota stays in Postgres. |
| Analytics        | PostHog                                      | Product analytics, session replay, error tracking, AI tracing                           |

**Constraint:** every tool must work on its free tier for the whole build. Don't add a paid service or a paid-only feature.

---

## 4. Environments

| Environment | What it is | Who deploys |
| --- | --- | --- |
| Production | Vercel production (from `main`) + the Supabase prod project | Product owner only: merges to `main`, runs any migration, then promotes the build |
| Preview | A Vercel preview deployment per PR + the Supabase dev project | Automatic on every push to a PR |
| Local | `pnpm dev` + the Supabase dev project | Each developer |

| Rule | Detail |
| --- | --- |
| Shared dev database | Every developer agent and every preview share the dev project. Never apply an unmerged migration to it. Test new migrations on pglite (`packages/db/supabase-pglite.ts`). No local Supabase or Docker database. |
| Migrations | Run only after their PR merges: agents apply them to dev through the Supabase MCP (scoped to the dev project), recording the file's version. The product owner applies all of them to prod when production goes live. Every migration is additive ("expand and contract"): the live version keeps working while it runs. Drops and renames come in a later PR, once no deployed code uses the old shape. |
| Production rollout | Production goes live once, in Phase 6: the product owner creates the Supabase prod project, applies every migration, sets Vercel's production variables, and promotes the build. Until then, a merge to `main` builds production but nothing is promoted. Vercel's automatic production promotion is off. |
| Dev data is throwaway | Only migration files reach production. Never copy data from dev. |
| Never deploy production | Only the product owner merges to `main` and promotes production |

---

## 5. Plans

|                                | Free         | Pro                  |
| ------------------------------ | ------------ | -------------------- |
| Projects                       | 1            | 5                    |
| Messages / month (per project) | 100          | 2,000                |
| Knowledge sources (per project, files + pasted text) | 3 | 25 |
| Button color                   | Default      | Any                  |
| Button position                | Bottom right | Any corner           |
| Button label                   | Default      | Custom               |
| Open animation                 | Fade         | Fade / slide / scale |
| Header text                    | Default      | Custom               |
| "Powered by" badge             | Shown        | Hidden               |

**Rule:** the server decides the plan. The widget and dashboard never decide what is allowed. Plan limits live in one place: `packages/shared`.

**Name:** the app name lives in one constant, `APP_NAME` in `packages/shared`. Landing page, dashboard, widget badge, and page titles read it from there.

---

## 6. Features

### 6.1 Landing page

Search and sharing: the home page has a descriptive title and description, a canonical URL, Open Graph and Twitter tags with a generated 1200x630 share image, and JSON-LD (Organization, WebSite, SoftwareApplication with the Free and Pro offers, FAQPage built from the visible FAQ). The favicon, 48 px icon and Apple icon are generated from the logo mark. Public pages are listed in `lib/site.ts` (`PUBLIC_PATHS`) and appear in `sitemap.xml`; the app, API and chat panel are blocked in `robots.txt`.

Policy pages: `/terms`, `/privacy`, `/refunds` (cancellation and refunds) and `/contact`, linked from the footer. Their text lives in `lib/legal.ts`. `NEXT_PUBLIC_CONTACT_EMAIL` (optional) shows an email address on the Contact page.

| Item      | Detail                                                                                      |
| --------- | ------------------------------------------------------------------------------------------- |
| Sections  | Hero, how it works (3 steps), live demo (the real widget), pricing, install snippet, footer |
| Widget    | Runs the app's own widget with a project about Askwell itself                               |
| CTA       | "Start free" → sign up                                                                      |
| Done when | Page is responsive, pricing matches section 5, widget opens and answers                     |

### 6.2 Auth

| Item        | Detail                                                                         |
| ----------- | ------------------------------------------------------------------------------ |
| Provider    | Clerk                                                                          |
| Methods     | Email + password, Google                                                       |
| Pages       | Clerk sign in, sign up                                                         |
| Protection  | Clerk middleware on `/dashboard/*` and owner API routes                        |
| Account row | On first sign-in, create an `accounts` row for the Clerk user ID (plan `free`) |
| Done when   | Sign up → land in dashboard; sign out → redirect to sign in                    |

### 6.3 Projects

| Item      | Detail                                                                    |
| --------- | ------------------------------------------------------------------------- |
| Actions   | List, create, rename, delete                                              |
| On create | Generate `public_key` (`pk_` + random), create default widget config      |
| Limit     | Free: 1 project. Pro: 5. Checked on the server.                           |
| Done when | Owner sees only their own projects; the second project on Free is refused |

### 6.4 Knowledge

| Item       | Detail                                                                                  |
| ---------- | --------------------------------------------------------------------------------------- |
| Input      | Paste text with a title, upload a file, or give a website address                       |
| File types | PDF, Markdown, TXT. Max 10 MB (`MAX_KNOWLEDGE_FILE_BYTES`); the bucket enforces the same size and types. |
| Upload     | 1. `upload-url` reserves the source as `uploading` (counts toward the limit) and returns a one-time signed URL. 2. The browser uploads straight to Storage. 3. `finalize` claims the source once (`uploading` → `processing`), checks the real size and PDF bytes, then processes it. A refused file is deleted. A reservation not finalized within 2 hours is reclaimed. |
| Processing | Extract text (PDF: `unpdf`) → split into chunks → embeddings → store in pgvector |
| Actions    | List sources with status (`uploading` shows as processing), delete a source (deletes its file and chunks) |
| Limit      | Free: 3 sources per project. Pro: 25. Files and pasted texts count toward the same limit. |
| Answers builder | The owner picks a kind of business (shop, services, restaurant, courses, software, other), answers its plain questions, and may add their own. `PUT /api/projects/:id/answers` saves the pairs as the project's one "Business answers" source: created the first time, replaced after that (one source slot). The pairs are kept in `knowledge_sources.answers` (jsonb, set only on this source, written by the service client only) so the owner can reopen and edit them. Indexed as "Question: … Answer: …" blocks. |
| Unanswered questions | Visitor questions whose reply was the fixed "I don't have that information" message (last 100), grouped, most asked first, up to 10, hidden once the owner has a saved question with the same wording. "Answer this" adds the question to the builder. Read with the owner client. |
| Interview prompt | A copyable message for any AI chat that interviews the owner one question at a time and writes a document to paste into "Paste text". |
| Try it | The widget panel (`/embed?key=…`) inside the page. Its messages count toward the monthly limit. |
| Done when  | Uploading a PDF creates chunks; a related question retrieves them                       |

### 6.5 Widget

Two parts: a small loader script + an iframe.

**Loader** (`apps/widget` → `widget.js`, runs on the customer's site)

| Item      | Detail                                                                                       |
| --------- | -------------------------------------------------------------------------------------------- |
| Install   | `<script src=".../widget.js" data-key="pk_..."></script>`                                    |
| On load   | Read `data-key` → fetch config → render the button with config styles                        |
| On click  | Open an iframe pointing at `/embed?key=pk_...`, with the configured animation                |
| Messages  | `postMessage` with the iframe: close, resize, unread. Check `event.origin` on every message. |
| Options   | Optional `data-*` on the script tag: `data-offset-x`, `data-offset-y`, `data-mobile-offset-y` (px, to clear the site's own UI), `data-open-on-load` (open the chat when the page loads), `data-lang` (panel language; default is the page's `<html lang>`, then the browser's) |
| JS API    | `window.Askwell.open()`, `.close()`, `.toggle()` for the site's own buttons. Calls made before the widget has loaded run once it is ready |
| Languages | The panel's own labels come in English, Spanish, French, German and Hindi. The owner's words (header, welcome, starters, button label) are never translated; untouched defaults are |
| Memory    | The panel keeps the current conversation (last 40 lines, 24 hours) in its own localStorage per project, so a page change or reload continues it. "New chat" clears it |
| Greeting  | Optional bubble beside the button (Pro; off by default; text up to 120 characters), shown 4 s after load for 14 s, once per visitor (one small flag, `askwell_greeted_<key>`, in the site's localStorage), never while the chat is open. `data-no-greeting` on the script tag turns it off for a page |
| Ratings   | Thumbs up/down under the latest answer; pressing the same one again takes it back. Sent to `POST /api/widget/rate` (30 per minute per key and IP); owners see them in Conversations |
| Isolation | Button in a shadow root. No global CSS. Nothing else touches the host page.                  |
| Errors    | Bad key → nothing renders                                                                    |

**Panel** (`apps/web/app/embed`, runs inside the iframe)

| Item       | Detail                                                               |
| ---------- | -------------------------------------------------------------------- |
| UI         | Header, message list, input, typing state, "Powered by" badge (Free) |
| On send    | Post message → show typing state → show reply                        |
| Visitor ID | Random ID in the iframe's `localStorage`, reused across visits       |
| Errors     | Rate limited / quota hit → friendly message                          |

| Both      | Detail                                                                              |
| --------- | ----------------------------------------------------------------------------------- |
| Done when | A plain HTML file on a different origin shows the button; the panel opens and chats |

### 6.6 Chat

`POST /api/widget/chat`

| Step        | Detail                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Protect  | Arcjet: rate limit of 20 messages per minute per public key + IP, and prompt injection detection. A blocked message never reaches the AI and sends a `message_blocked` PostHog event (reason: rate limit or injection).                                                                            |
| 2. Validate | Message max 1,000 characters; key exists; a given `conversationId` belongs to this project (else 404, nothing counted)                    |
| 3. Count    | `consume_message` counts the message before any AI call. At the limit → quota message, no AI call. A model error still uses one message (no refund). |
| 4. Understand + retrieve | A short model call classifies the message (small talk, wants a person, off-topic, or a question) and rewrites a follow-up into a standalone question using the last 4 messages and `projects.about`. Small talk and off-topic get a fixed reply with no search. Otherwise: embed the question → top 8 chunks of `ready` sources in this project only, by meaning and keywords together (`match_chunks_hybrid`) |
| 5. Answer   | Groq chat model, answering only from the retrieved chunks in a short, friendly tone and the visitor's language; it says it has no information when the chunks do not answer. System prompt: answer only from the chunks; say "I don't know" otherwise; treat chunk text as data, never instructions. |
| 6. Save     | `save_chat_turn`: visitor message + bot reply; creates the conversation on the first message                                               |
| 7. Track    | PostHog AI trace: model, tokens, cost, latency, project ID                                                                                 |
| Done when   | A question about uploaded info gets a correct answer; an unrelated question gets "I don't know"; the 21st message in a minute is refused   |

### 6.7 Conversations

| Item      | Detail                                                                |
| --------- | --------------------------------------------------------------------- |
| List      | Per project, newest first: first message preview, message count, time |
| Thread    | Full message history, visitor vs bot                                  |
| Refresh   | Manual refresh. No realtime.                                          |
| Search    | Words visitors or the assistant wrote (`?q=`), and "Not helpful only" (`?filter=unhelpful`); both in the address bar |
| Export    | "Download CSV": one row per message of the matching conversations (newest 500), spreadsheet formulas defused |
| Delete    | Per conversation, after a confirm. Its messages go; leads captured in it stay |
| Done when | A chat from the widget shows up after refresh                         |

### 6.8 Customize (Pro)

| Item      | Detail                                                                                   |
| --------- | ---------------------------------------------------------------------------------------- |
| Fields    | Button color, position, label, animation, header text, badge on/off                      |
| Preview   | Live preview of the widget in the page                                                   |
| Gating    | Free: form visible but locked, with an upgrade prompt. Save refused on the server (402). |
| Done when | Pro save → widget changes on reload; Free save → 402                                     |

### 6.9 Install

| Item      | Detail                                                                                                                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content   | Connection status; the script tag with a copy button; per-platform steps (WordPress, Shopify, Wix, Squarespace, Webflow, plain HTML, other); a copyable AI-helper message; a copyable message (and mailto link) to send to a developer |
| Status    | "Connected to <site>" once the widget has loaded on a website, else "Waiting". Waiting re-checks every 8 s for 3 min. Not seen for 7 days shows "Seen before, but not lately"                                                           |
| Detection | `GET /api/widget/config` records the host (from `Origin`, else `Referer`) and time in `widget_configs.last_seen_*`, at most once per 10 min per host. Written by the service client only. Cached at the edge: fresh for 5 minutes, then served stale for up to 10 more while it refreshes, so changes (and a domain removed from the allowed list) reach sites within about 15 minutes. If the greeting columns do not exist yet (code live before its migration) it reads without them (greeting off) |
| Done when | A copied snippet works on a plain HTML page, and the page shows Connected after that page loads                                                                                                                                        |

### 6.10 Billing

| Item      | Detail                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------- |
| Overview  | The dashboard home opens with the last 30 days across all projects: questions asked, conversations, answered %, helpful % (thumbs), and a bar per day. Read through the owner client, so RLS scopes it; daily counts come from up to 10,000 recent visitor messages (`lib/overview.ts`). |
| Gate      | `BILLING_ENABLED=true` opens paid plans (the subscribe route answers 403 until then). While it is not set, Free owners see "Pro opens soon" with the Pro feature list and the Coming soon list (`lib/plan-features.ts`, also on the landing pricing section) instead of the Upgrade button; existing Pro accounts can still cancel. |
| Upgrade   | "Upgrade to Pro" on the Billing page. The server creates a Razorpay subscription for the signed-in owner on the Pro plan (`RAZORPAY_PLAN_ID`) and returns its ID and the public key ID; the browser opens Razorpay Checkout with them. We never see card or bank details. |
| Webhook   | `POST /api/razorpay/webhook`, signature verified (HMAC SHA-256 hex over the raw body with `RAZORPAY_WEBHOOK_SECRET`, header `x-razorpay-signature`). `subscription.activated` and `subscription.charged` → `accounts.plan = pro`. `subscription.cancelled`, `completed`, `expired` and `halted` → `free`. `subscription.pending` (a failed charge) keeps Pro through Razorpay's retries. The owner is found from the stored `razorpay_subscription_id`; the plan is never taken from the browser. |
| Manage    | "Cancel subscription" on the Billing page calls Razorpay's cancel API (immediately). Cancelling ends Pro at once: future charges stop and the month already paid is not refunded. The owner can also cancel from their UPI app or bank, which ends Pro when Razorpay reports it. |
| Currency  | INR. International cards work only after Razorpay enables them for the account; they are billed in rupees at the issuer's rate. Razorpay Checkout collects the phone number itself. |
| Done when | Sandbox payment → Customize unlocks                                                                       |

### 6.11 Analytics

| Item           | Detail                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------- |
| Setup          | PostHog wizard (`npx @posthog/wizard`) on the Next.js app                                     |
| Events         | `signed_up`, `project_created`, `knowledge_added`, `snippet_copied`, `first_chat`, `upgraded`, `message_blocked` (from the chat route, with the reason; no message text) |
| Funnel         | Landing → sign up → project → knowledge → install → first chat → upgrade                      |
| Session replay | Dashboard + landing                                                                           |
| Error tracking | Client + server errors                                                                        |
| AI tracing     | Every bot reply: model, tokens, cost, latency, project ID, grouped per conversation           |
| Done when      | The funnel shows each step; a bot reply appears as a trace with its cost                      |

### 6.12 Usage

| Item      | Detail                                                                               |
| --------- | ------------------------------------------------------------------------------------ |
| Shown     | Messages used this month / limit, per project                                        |
| Reset     | Monthly (`period_start`)                                                             |
| Emails    | The owner gets one email when a project reaches 80% and one at 100% of its month (`claim_quota_warning`, `projects.quota_warned_*`, sent through Resend like lead emails; once per level per month) |
| Done when | Count goes up for each accepted message; at the limit, the widget shows the quota message |

---

## 7. Data model

| Table               | Columns                                                                                                                              | Notes                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `accounts`          | `clerk_user_id` (PK), `plan` (`free`/`pro`), `razorpay_subscription_id` (nullable), `cashfree_subscription_id` (legacy, nullable), `created_at`                                      | One per Clerk user. Plan lives here, kept in sync by the Razorpay webhook. `razorpay_subscription_id` is Razorpay's ID for the owner's subscription; it lets the webhook find the owner and lets the owner cancel. `cashfree_subscription_id` is unused and is dropped in a later migration. |
| `projects`          | `id`, `owner_id` → accounts, `name`, `about`, `allowed_domains`, `public_key`, `quota_warned_period`, `quota_warned_level`, `messages_used`, `period_start`, `created_at`                            | `public_key` unique. `about`: the owner's description of the business (up to 600 characters), used by the chat to tell on-topic questions from off-topic ones. `allowed_domains`: up to 10 domains that may show the widget; empty means any site; subdomains and localhost always match. Enforced in `GET /api/widget/config` (403 for other sites), using the browser's `Origin`, or the `?origin=` the `/embed` panel passes along. It stops a key being pasted onto the wrong site; it is not a defence against someone calling the chat API directly. |
| `widget_configs`    | `project_id` (PK), `button_color`, `position`, `label`, `animation`, `header_text`, `show_badge`, `welcome_message`, `starter_questions`, `greeting_enabled`, `greeting_text`, `last_seen_at`, `last_seen_host`        | One per project                                     |
| `knowledge_sources` | `id`, `project_id`, `title`, `type` (`text`/`pdf`/`md`/`txt`), `storage_key`, `status` (`uploading`/`processing`/`ready`/`failed`), `answers` (jsonb, null except the builder's source), `created_at` | `storage_key` null for pasted text |
| `knowledge_chunks`  | `id`, `project_id`, `source_id`, `content`, `embedding vector(1536)`                                                                 | Deleted with the source. HNSW index on `embedding`. |
| `conversations`     | `id`, `project_id`, `visitor_id`, `created_at`                                                                                       |                                                     |
| `messages`          | `id`, `conversation_id`, `role` (`visitor`/`bot`), `body`, `rating`, `created_at`                                                              | `rating`: 1, -1 or null; set on a bot answer by the visitor's thumbs, through `rate_last_reply` (service role only) |

**Tenant isolation:** Postgres RLS. The Data API is public, so RLS and grants are the boundary.

| Role | May |
| --- | --- |
| `anon` | Nothing: no table, no function. Visitors never get a Supabase key. |
| `authenticated` (the owner's Clerk token) | SELECT rows in their own projects only (`owner_id = auth.jwt()->>'sub'`, via the `owned_project_ids()` / `owned_conversation_ids()` helpers); rename (`name` only) and delete their own projects; execute `owner_activity` (dashboard numbers, runs as the caller). Nothing else. |
| `service_role` (the server's secret key) | Everything. Used only on the server: visitor routes, the Clerk webhook, knowledge processing, Storage, and writes owners can't make, always after the route checks ownership and plan. |

Limits run inside Postgres functions only `service_role` may execute: `create_project`, `reserve_knowledge_source` (plan limits, passed from `PLAN_LIMITS`), `consume_message`, `save_chat_turn`, `match_chunks`. The three that count (`create_project`, `reserve_knowledge_source`, `consume_message`) check and write under a row lock or in one statement, so concurrent requests can't both pass. Public routes resolve the project from `public_key` only.

**Schema changes:** a migration in `supabase/migrations` in the same PR, with its RLS policies and grants, plus regenerated `packages/db/types.ts`. Changing an existing table needs approval first (see `CLAUDE.md`).

---

## 8. API routes

### Public (called by the widget, any origin, rate limited)

| Route                    | Input                                            | Output                                            |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------- |
| `GET /api/widget/config` | `key`                                            | Config, plan-applied (Free gets defaults + badge) |
| `POST /api/widget/chat`  | `key`, `visitorId`, `conversationId?`, `message` | `conversationId`, `reply`                         |
| `POST /api/widget/rate`  | `key`, `conversationId`, `rating` (1, -1, 0 clears) | `rating`. Rates the latest answer of that conversation |
| `POST /api/widget/lead`  | `key`, `email`, `name?`, `phone?`, `type`, `conversationId?` (missing when the first message was refused) | `leadId`. Rate limited (5 per minute per key and IP); the same details sent again within 10 minutes are not a new lead |

### Owner (Clerk session required)

| Route                                                               | Purpose                             |
| ------------------------------------------------------------------- | ----------------------------------- |
| `GET/POST /api/projects`, `PATCH/DELETE /api/projects/:id`          | Projects CRUD + limit check. PATCH changes `name`, `about` and/or `allowedDomains`. |
| `POST /api/projects/:id/knowledge`                                  | Paste text → process                |
| `POST /api/projects/:id/knowledge/url`                              | Read a website (same site only, robots.txt respected, private addresses refused; Free 10 pages, Pro 40) and **return the text for review**; saves nothing (`sparse: true` when under 1,500 characters were found, which makes the review window warn that the site may draw its content with JavaScript, which we cannot read). The owner edits it in a dialog and confirms, which adds it through `POST /api/projects/:id/knowledge` as a `text` source (checks the limit and indexes) |
| `POST /api/projects/:id/knowledge/upload-url`                       | Reserve a file source → signed upload URL |
| `POST /api/projects/:id/knowledge/finalize`                         | Check the uploaded file → process   |
| `DELETE /api/knowledge/:id`                                         | Delete source, file, chunks         |
| `GET /api/projects/:id/conversations`, `GET /api/conversations/:id` | Read conversations                  |
| `GET /api/projects/:id/conversations/export` | CSV download (optional `q`, `filter=unhelpful`) |
| `DELETE /api/conversations/:id`             | Delete a conversation and its messages |
| `PATCH /api/projects/:id/config`                                    | Update config (402 if Free)         |
| `POST /api/billing/subscribe`, `POST /api/billing/cancel`           | Start the Pro subscription (returns the Razorpay subscription ID and public key ID) / cancel it |

Checkout is Razorpay Checkout; the two billing routes above only create and cancel the subscription.

### System

| Route                     | Purpose                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `POST /api/razorpay/webhook` | Signature verified; updates `accounts.plan`                                         |
| `GET /api/posthog-config` | PostHog's public project key and host, read at request time                          |

Request and response types for every route live in `packages/shared`.

---

## 9. Security rules

Every PR must follow these.

| Risk                         | Rule                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Plan bypass                  | Plan is read on the server in every gated action. Never from the client.                     |
| Tenant leak                  | Owner reads use the owner client, so RLS scopes them. Never the service client with a manual owner filter. Service-client writes happen only after the route checks ownership (`getOwnedProject`). Chunk search is scoped to one project. |
| Database API                 | The Data API is public. Every table has RLS on, with policies and grants in its migration; `anon` gets nothing; TRUNCATE is revoked from API roles. Functions: SECURITY INVOKER (DEFINER only for the RLS helpers), `search_path = ''`, EXECUTE revoked from `PUBLIC`/`anon`/`authenticated` unless a role needs it. Never turn on PostgREST aggregates project-wide. |
| Public key abuse             | Public key only identifies a project. It grants no owner rights.                             |
| Cost abuse                   | Rate limit on public routes. Monthly message quota. Message length limit.                    |
| Prompt injection (visitor)   | Arcjet detects it before the AI call. System prompt limits scope. Bot never reveals the system prompt or other projects' data.     |
| Prompt injection (documents) | Uploaded file text is data. The system prompt says so.                                       |
| File upload                  | Check type and size on the server: declared size and extension at `upload-url`, real size and PDF bytes at `finalize`. Private bucket with its own size and type limits; one-time signed upload URLs; never public URLs. |
| XSS                          | Visitor messages and bot replies render as text, never HTML, in widget and dashboard.        |
| CORS                         | Public widget routes allow any origin. Owner routes do not.                                  |
| postMessage                  | Loader and panel check `event.origin` on every message. Never `*` as target origin for data. |
| Clickjacking                 | Only `/embed` may be framed by other sites. Other pages send `frame-ancestors 'self'`.       |
| Webhook                      | Clerk webhook signature verified before any update                                           |
| Secrets                      | No secret keys in the widget bundle or `NEXT_PUBLIC_*`. `SUPABASE_SECRET_KEY` is read only by `lib/supabase/service.ts` (`import "server-only"`). Test keys only. |

---

## 10. Repo layout

```
apps/
  web/            # Next.js: landing, dashboard, /embed, /api
  widget/         # vanilla TS loader → dist/widget.js
packages/
  shared/         # contract: types, API shapes, plan limits
  db/             # generated Supabase types (types.ts) + pglite test helper
supabase/
  migrations/     # SQL migrations (Supabase CLI)
docs/
  project.md      # this file
  plan.md         # phases (human-written)
```

---

## 11. Environment variables

| Variable                                                                         | Used by         | Public? |
| -------------------------------------------------------------------------------- | --------------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public by design: RLS is the boundary) | Client + server | Yes |
| `SUPABASE_SECRET_KEY` (acts as `service_role`, skips RLS)                        | Server only     | No      |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                                              | Client          | Yes     |
| `CLERK_SECRET_KEY`                                                               | Server          | No      |
| `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`                                              | Server          | No      |
| `GROQ_API_KEY` (optional `GROQ_CHAT_MODEL`)                                      | Server          | No      |
| `RAZORPAY_KEY_ID` (`rzp_test_` = test mode, `rzp_live_` = live), `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID`, `RAZORPAY_WEBHOOK_SECRET` | Server          | No      |
| `ARCJET_KEY`                                                                     | Server          | No      |
| `POSTHOG_KEY`, `POSTHOG_HOST` (the `NEXT_PUBLIC_` names also work). Read at request time by `GET /api/posthog-config`; the key is public by design. | Client + server | Yes     |
| `NEXT_PUBLIC_APP_URL`                                                            | Client + server | Yes     |
| `LANDING_WIDGET_KEY`                                                             | Server (read at request time) | No (it is a public key, but per-environment config) |

`.env.example` lists every variable with no values. `.env` is never committed.

Each Vercel environment gets its Supabase project's values: Production → the prod project, Preview and Development → the dev project.

---

## 12. Out of scope

| Feature                              | Reason                           |
| ------------------------------------ | -------------------------------- |
| DOCX and spreadsheet uploads         | Extra parsing work, small payoff |
| Website scraping                     | Too much backend work            |
| Buying-intent scoring                | Same                             |
| Realtime conversation view           | Manual refresh is enough         |
| Human takeover                       | Not needed                       |
| Multiple LLM providers               | One model is enough              |
| Teams / multiple members per account | Not needed                       |

---

## 13. Design

Every screen follows this. Agents don't pick their own style.

| Area | Look |
|---|---|
| Overall | Claude look: warm cream and charcoal, terracotta accent (`--brand`), serif headings (Newsreader), glass panels |
| Landing page | Dark, with simple motion: subtle entrance and scroll animations |
| Dashboard | Light cream, warm neutrals, glass panels |
| Sign-in / sign-up | Clerk's default look |
| Tokens | One set of design tokens (colors, radius, shadows, blur) shared by every page |
| States | Empty, loading and error states on every screen |
| Responsive | Works down to 375 px wide |