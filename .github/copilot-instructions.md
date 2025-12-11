# GitHub Copilot / AI Agent instructions for Carbon5-nextjs-webapp

Purpose: concise, actionable guidance so an AI helper becomes productive quickly in this repo.

1) Big picture
- Next.js 14 app-router project using the `app/` directory. Server components are default; client components use `"use client"` or have explicit client filenames (see examples below).
- Data & auth: Supabase is the primary backend (see `config/supabase.ts`, `app/config/supabase.ts`, `lib/supabaseClient.ts`).
- AI: OpenAI is used via `lib/openaiClient.ts` and multiple api routes under `app/api/ai/*`.
- UI: Tailwind CSS + React. Charts use `recharts` and many components live under `app/` and top-level `components/`.

2) Key files & integration points (scan these first)
- `package.json` — scripts: `npm run dev` (Next dev), `npm run build`, `npm start`, `npm run lint`.
- `app/` — primary UI and server routes. Examples: `app/layout.tsx`, pages under `app/dashboard`, `app/api/*` for server API routes.
- `config/supabase.ts` and `app/config/supabase.ts` — one contains a hard-coded URL/anon key (repo), the app variant reads env vars. Prefer env-based config for local/dev.
- `lib/supabaseClient.ts` — reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` and creates the Supabase client.
- `lib/openaiClient.ts` — expects `OPENAI_API_KEY`.

3) Environment variables required for local development
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase URL (used by client + server). Example: `app/config/supabase.ts`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key.
- `OPENAI_API_KEY` — OpenAI API key for `lib/openaiClient.ts` and `app/api/ai` routes.

4) Project-specific conventions and patterns
- Server vs Client components: files in `app/` are server-rendered by default. Client components either contain `"use client"` at top or are named with `Client` suffix (e.g., `RowActionsClient.tsx`). Server-only conventions include `*Server.tsx` naming (e.g., `LeadershipSnapshotServer.ts`). Follow these patterns when adding new components.
- API routes: Use the app-router `app/api/.../route.ts` pattern. Many AI endpoints live under `app/api/ai` (e.g., `route.ts`, `analyse/route.ts`). When editing or adding AI endpoints, call `lib/openaiClient.ts` and keep heavy processing on the server side.
- Data mutations: Many API handlers under `app/api/*/route.ts` call Supabase. Use `lib/supabaseClient.ts` for auth-aware client creation; prefer server-side operations in `route.ts` files.

5) Helpful examples and quick patterns
- To call OpenAI from a server route: import `{ openai }` from `lib/openaiClient.ts` and await responses in `app/api/ai/route.ts`.
- To access Supabase from components or routes: import `{ supabase }` from `lib/supabaseClient.ts` (server) or create an SSR client via `@supabase/ssr` for server-rendered pages.
- Naming: keep `*Client.tsx` for client components, `*Server.tsx` for server-specific components. Follow existing file names under `app/dashboard` and `components/`.

6) Build / run / debug
- Start dev server: `npm install` then `npm run dev`. Ensure env vars above are set in `.env.local` or in your environment.
- Build: `npm run build` then `npm start` for production start.
- Lint: `npm run lint`.

7) Tests & tooling
- Dev deps include `playwright`. There are no repo-level unit test scripts — run browser tests or add them under `tests/` if required.

8) Safety and secrets
- `config/supabase.ts` contains an exported URL and anon key (in repo). Treat this as sensitive: prefer envs and do not commit additional secrets. When making changes, check `lib/supabaseClient.ts` for how keys are read.

9) When making changes, checklist for agents
- Preserve Server/Client boundaries; add `"use client"` when converting a component to client.
- Add or update env var notes in the README or this file when introducing new external keys.
- Prefer `lib/*` helpers (`openaiClient.ts`, `supabaseClient.ts`) for integrations rather than inlining credentials.
- Reference existing API routes under `app/api/` for example implementations.

10) Where to look next (recommended file order)
- `package.json` → `app/layout.tsx` → `app/api/ai/route.ts` → `lib/openaiClient.ts` → `lib/supabaseClient.ts` → `app/config/supabase.ts` → `config/supabase.ts` → `app/**/*Client.tsx` and `*Server.tsx` components.

If anything here is unclear or you want the instructions to emphasize other developer workflows (tests, CI, deploy), tell me which area to expand and I'll iterate.
