# Open World Kids Game (Monorepo)

Monorepo scaffold for a web-first, 2D, multiplayer world designed for kids with parent-approved controls.

**Game Overview**
- **Purpose:** Safe, simple, real-time social world for ages 6–12.
- **Core Loop (MVP):** Pick a simple shape avatar, move on a shared 2D map, see others, use preset emotes (no chat).
- **World:** Chunked infinite-style map; collect color items; progression via points and evolution stages.
- **Safety:** Parent-owned accounts, child profiles with approval, session time limits enforced server-side.
- **Tech:** Next.js Canvas client, Colyseus server, Postgres for durable data, Redis for presence/ephemera, Zod shared schemas.
- See `docs/prds/games-spec.md` for the full PRD, data model, and milestones.

## Structure
- apps/web – Next.js front-end (Canvas prototype)
- apps/server – Colyseus authoritative server (TypeScript)
- packages/shared – Shared types and schemas (Zod)
- docs/ – PRD and design docs

## Getting Started
1. Copy `.env.example` to `.env` and fill values.
2. Install deps: `make setup`
3. Run dev (both apps): `make dev`
   - Or separately: `make web` and `make server`

## Scripts
- Root: `npm run dev|build|lint|test` (via Turbo)
- Web: `npm -w apps/web run dev`
- Server: `npm -w apps/server run dev`

## Notes
- Server listens on `PORT=2567` by default.
- Frontend currently renders local movement only; networking to be wired next.
- See `docs/prds/games-spec.md` for PRD, data model, and roadmap.
