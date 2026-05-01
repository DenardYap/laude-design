# Laude Design Clone

A self-hosted, Laude-style design workspace. Sign in with Google or GitHub, configure your own LLM provider keys (Laude / Gemini / OpenAI), upload reusable Skills, and (coming soon) generate UI in a design canvas.

## Stack

- **Next.js 15** (App Router, RSC + Server Actions, TypeScript)
- **Auth.js v5** (NextAuth) — Google + GitHub OAuth only
- **Prisma** + **Postgres 16**
- **Tailwind CSS** + **shadcn/ui** primitives in `src/components/ui/`
- **Zustand** for client UI state
- **Zod** + **react-hook-form** for validation

## Quick start (one command)

Make sure Docker Desktop is running, then:

```bash
pnpm install
pnpm dev
```

That's it. `pnpm dev` ([scripts/dev.mjs](scripts/dev.mjs)) will:

1. Check that Docker is reachable
2. Create `.env` from `.env.example` if missing and auto-generate `AUTH_SECRET` + `ENCRYPTION_KEY`
3. `docker compose up -d --wait db` (Postgres 16, waits for healthy)
4. `prisma migrate deploy` (applies any pending migrations)
5. Start Next.js (frontend + Server Actions/API routes) on <http://localhost:3000>

Ctrl+C stops the dev server. Postgres keeps running so the next `pnpm dev` is instant — stop it with `pnpm db:down` when you're done.

### OAuth setup (required before sign-in works)

Fill these in `.env`:

- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — [GitHub Developer settings](https://github.com/settings/developers). Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

`pnpm dev` warns you if any of these are still empty.

## Other scripts

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `pnpm dev`           | One-shot: Docker + Postgres + migrations + Next.js dev    |
| `pnpm dev:next`      | Just `next dev` (use when DB is already up)               |
| `pnpm db:up`         | Start Postgres in Docker, wait for healthy                |
| `pnpm db:down`       | Stop and remove the Postgres container                    |
| `pnpm prisma:migrate`| `prisma migrate dev` — interactive, for new schema changes |
| `pnpm prisma:studio` | Open Prisma Studio                                        |
| `pnpm build`         | Production build (`prisma generate && next build`)        |
| `pnpm start`         | Run production server                                     |
| `pnpm typecheck`     | `tsc --noEmit`                                            |

## Run everything in Docker (prod-like)

```bash
docker compose up --build
```

This brings up `db` (Postgres) and `app` (Next.js production build) together.

## Project layout

```
src/
  app/
    (marketing)/page.tsx            # Public landing
    (auth)/sign-in/page.tsx         # Google / GitHub buttons
    (app)/                          # Protected, sidebar layout
      projects/
      api-keys/                     # Configure API
      skills/
    api/auth/[...nextauth]/route.ts
  components/
    ui/                             # shadcn primitives (DRY library)
    shared/                         # SearchBar, MultiSelectFilter, PageHeader, EmptyState, DataList, ConfirmDialog
    layout/                         # AppSidebar, WorkspaceFooter
    projects/  api-keys/  skills/   # Domain components
  lib/
    auth.ts        # NextAuth config + requireUser()
    db.ts          # Prisma singleton
    crypto.ts      # AES-256-GCM encryptSecret / decryptSecret
    utils.ts
    validators/    # zod schemas
  server/actions/  # Server Actions (mutations)
  stores/          # Zustand (ui-store, filters-store)
  styles/globals.css
prisma/
  schema.prisma
```

## Security notes

- API keys are encrypted at rest with AES-256-GCM (`src/lib/crypto.ts`) using `ENCRYPTION_KEY`. Plaintext is never returned to the client; the UI only shows the last four characters.
- Always create a dedicated key per provider for this app and never share it.
- `.env` and any `*.local` env files are git-ignored.
# laude-design
