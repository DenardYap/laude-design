# Laude Design

An open-source agentic design workspace with any model you want.

**[laude-design.com](https://laude-design.com)** · Self-host in 60 seconds

The server at laude-design.com runs exactly the code in this repo. If you want to verify what happens to your keys, read the source.

## What it does

Laude Design pairs a chat interface with a live Sandpack canvas. You describe what you want, the AI writes React + Tailwind code, and you see it rendered immediately. No copy-pasting between tools.

Bring your own Claude, OpenAI, or Gemini key. No subscription stacked on top of your API bill.

**Skills** let you give the AI reusable context: think of them as persistent system prompt additions you can toggle per project. The public library has community-contributed skills you can clone and adapt.

**Highlight the UI** so the agent knows which exact component you are referring to. 

**Self-critique mode** lets the AI screenshot its own Sandpack output and use that image as visual feedback before the next edit. It sees what you see.

**Draw on the canvas** and send your sketch directly to the model. Good for rough layout direction when words aren't enough.

**Clarifying questions and design plans** keep longer builds organized. The AI asks before it assumes, and creates a checklist it works through step by step.

**Export** finished work as an image, a code prompt, or a ZIP, ready to hand off to another tool or agent.

**Cost tracking** at the bottom left allows you to see how much tokens and money have spent so far, so you don't go too far.

TODO: Image generation, allow users to upload image, tagging, create other sorts of documents (e.g slidedeck), add design systems, ask agent to turn something into skills

## Demo

### Self-critique mode

The AI screenshots its own Sandpack output and uses that image as visual feedback before committing the next edit. It sees what you see — no more guessing whether the rendered result matches the intent.

<video src="public/demo/demo%20with%20self-critique.mov" controls title="Self-critique mode"></video>

---

### Tool showcase

A walkthrough of the agent's built-in tool suite: `createDesign`, `editDesign`, `screenshotDesign`, `planDesign`, drawing support, and more. Each tool maps to a deliberate step in the design-build loop.

<video src="public/demo/tool%20showcase.mov" controls title="Tool showcase"></video>

---

### Use your favorite model

Bring your own Claude, OpenAI, or Gemini key and switch models from the composer at any time. No subscription stacked on top of your API bill — you pay only what the provider charges.

<video src="public/demo/use%20your%20favorite%20model.mov" controls title="Use your favorite model"></video>

---

### Accurate billing

Per-token cost tracking in the session usage popover tells you exactly how much input, output, and cache tokens each session consumed — and what it cost — so you stay in control of your API spend.

<video src="public/demo/accurate%20billing.mov" controls title="Accurate billing"></video>

---

### Export

Export finished work as an image snapshot, a raw code prompt, or a ZIP archive. Hand off to another tool, a different agent, or drop straight into your repo.

<video src="public/demo/export.mov" controls title="Export"></video>

---

### Upload your own skills

Skills are persistent system-prompt additions you toggle per project. Upload your own to encode design system conventions, component patterns, or any reusable context the AI should always have on hand.

<video src="public/demo/upload%20your%20own%20skills.mov" controls title="Upload your own skills"></video>

## How key storage works

Your keys live in your browser's `localStorage` (under `laude.apiKeys.v1`). On each chat request, the key is sent in the `x-provider-api-key` request header, used in-memory to call the LLM, and dropped when the request ends. **No code path in this repo writes the key to the database, to disk, or to a log line** — you can verify by searching the source for that header name. A full database compromise would reveal zero API keys.

A strict Content-Security-Policy is set on every response (see [`src/middleware.ts`](src/middleware.ts)) — `connect-src 'self'` plus `script-src 'strict-dynamic'` with a per-request nonce — so even a successful XSS attack can't exfiltrate the localStorage entry to an outside origin.

The honest trust model: the deployed server *can technically* read the key for the duration of the request — that's true of any byok product where the key transits a server. What you get instead is verifiability: the server at laude-design.com runs exactly the code in this repo, and "is the key being persisted/logged anywhere?" is a question you can answer by reading [`src/app/api/projects/[id]/chat/route.ts`](src/app/api/projects/[id]/chat/route.ts) and grepping for `x-provider-api-key`. If you want stronger isolation than that, self-host.

**I recommend you self-host or just run this project locally if you do not trust [laude-design.com](https://laude-design.com), which is understandable!**

**Best practice: create a dedicated key for this app at each provider and revoke it if anything looks off. DO NOT USE YOUR COMPANY's API KEY, USE A PERSONAL API KEY!**

## Stack

- **Next.js 15** (App Router, RSC + Server Actions, TypeScript)
- **Auth.js v5** (NextAuth) with Google + GitHub OAuth
- **Prisma** + **Postgres 16**
- **Tailwind CSS** + **shadcn/ui** components in `src/components/ui/`
- **Sandpack** for the live React canvas
- **Zustand** for client UI state
- **Zod** + **react-hook-form** for validation

## Quick start

Make sure Docker Desktop is running, then:

```bash
pnpm install
pnpm dev
```

`pnpm dev` ([scripts/dev.mjs](scripts/dev.mjs)) handles everything:

1. Checks that Docker is reachable
2. Creates `.env` from `.env.example` if it's missing, and auto-generates `AUTH_SECRET`
3. Runs `docker compose up -d --wait db` to start Postgres 16
4. Runs `prisma migrate deploy`
5. Starts Next.js on <http://localhost:3000>

Ctrl+C stops the dev server. Postgres keeps running so the next `pnpm dev` starts instantly. Stop it with `pnpm db:down` when you're done for the day.

### OAuth setup

You need to fill these in before sign-in works:

- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` from [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Redirect URI: `http://localhost:3000/api/auth/callback/google`
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` from [GitHub Developer settings](https://github.com/settings/developers). Callback URL: `http://localhost:3000/api/auth/callback/github`

`pnpm dev` will warn you if any of these are missing.

## Scripts

| Command               | What it does                                               |
| --------------------- | ---------------------------------------------------------- |
| `pnpm dev`            | Docker + Postgres + migrations + Next.js dev, all at once  |
| `pnpm dev:next`       | Just `next dev` (use when the DB is already up)            |
| `pnpm db:up`          | Start Postgres in Docker, wait for healthy                 |
| `pnpm db:down`        | Stop and remove the Postgres container                     |
| `pnpm prisma:migrate` | `prisma migrate dev` for new schema changes                |
| `pnpm prisma:studio`  | Open Prisma Studio                                         |
| `pnpm build`          | Production build (`prisma generate && next build`)         |
| `pnpm start`          | Run the production server                                  |
| `pnpm typecheck`      | `tsc --noEmit`                                             |

## Run everything in Docker

```bash
docker compose up --build
```

Brings up `db` (Postgres) and `app` (Next.js production build) together.

## Project layout

```
src/
  app/
    page.tsx                        # Public landing
    (auth)/sign-in/                 # Google / GitHub buttons
    (app)/                          # Protected, sidebar layout
      projects/
      api-keys/                     # Configure LLM keys (browser-only storage)
      skills/                       # Skill library + uploads
      settings/                     # Account
    (workspace)/projects/[id]/      # The designer (chat + canvas)
    (legal)/                        # Terms / Privacy
    api/
      auth/[...nextauth]/           # Auth.js routes
      projects/[id]/chat/           # Streaming AI chat route
      projects/[id]/upload/         # File / image uploads (Vercel Blob)
      sessions/[sessionId]/messages/
      sessions/[sessionId]/questions/
      plans/[planId]/
  components/
    ui/                             # shadcn primitives
    shared/                         # SearchBar, filters, pagination, lightbox
    layout/                         # AppSidebar, Topbar
    workspace/
      chat/                         # ChatPane, composer, model picker, session tabs
      canvas/                       # Sandpack renderer, file tree, drawing overlay, screenshots
      export/                       # Export dialog (image / code prompt / ZIP)
    projects/ api-keys/ skills/ settings/  # Domain components
  lib/
    ai/
      tools.ts            # Agent tools: createDesign, editDesign, screenshotDesign, planDesign, etc.
      providers.ts        # Claude / OpenAI / Gemini client setup
      system-prompt.ts
      pricing.ts          # Per-model pricing for the chat usage popover
      context-summarizer.ts
      inline-attachments.ts
      screenshot-upload.ts
    auth.ts               # NextAuth config + requireUser()
    db.ts                 # Prisma singleton
    limits.ts             # Per-user resource caps (designs / folders / skills)
    ratelimit.ts          # Upstash sliding window
    validators/           # Zod schemas
  middleware.ts           # CSP + nonce + per-IP rate limit
  server/actions/         # Server Actions (projects, sessions, designs, folders, skills, auth)
  stores/                 # Zustand (api-keys-store, workspace-store, ui-store, filters-store)
prisma/
  schema.prisma
```
