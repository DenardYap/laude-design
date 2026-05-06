# Laude Design

An open-source agentic design workspace with any model you want.

**[laude-design.com](https://laude-design.com)** · Self-host in 60 seconds

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

When you save a key it is encrypted with **AES-256-GCM** before it is written to the database. The encryption secret (`ENCRYPTION_KEY` in your `.env`) is a 32-byte value held outside the application database — a full database compromise reveals only ciphertext, not plaintext keys.

On each chat request the ciphertext is fetched and decrypted in memory for the duration of the outbound call to the provider, then discarded. The plaintext key is **never written to disk, never logged, and never returned to the browser** — the API exposes only the last four characters of each key as a display hint (e.g. `…k3bP`), plus an optional expiry timestamp.

You can set keys to auto-expire after 7, 14, or 30 days, or keep them indefinitely. Expired keys are hard-deleted from the database on your next visit; rotating a key overwrites the previous ciphertext immediately.

A strict Content-Security-Policy is set on every response (see [`src/middleware.ts`](src/middleware.ts)) — `connect-src 'self'` plus `script-src 'strict-dynamic'` with a per-request nonce — so even a successful XSS attack cannot exfiltrate key material to an outside origin.

**The honest trust model:** the deployed server decrypts your key in-memory for the duration of each request — that is true of any server-side BYOK product. What you get instead is verifiability: the server at [laude-design.com](https://laude-design.com) runs exactly the code in this repo, and "is the plaintext key ever persisted or logged?" is a question you can answer by reading [`src/lib/crypto.ts`](src/lib/crypto.ts) and [`src/server/actions/api-keys.ts`](src/server/actions/api-keys.ts). If you want stronger isolation than that, self-host.

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
2. Creates `.env` from `.env.example` if it's missing, and auto-generates `AUTH_SECRET` and `ENCRYPTION_KEY`
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
