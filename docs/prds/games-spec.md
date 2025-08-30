# Game PRD — Working Draft

## Overview
- Purpose: A web-first, 2D, multiplayer social world for primary school kids that parents trust.
- Tenets: Keep it simple, favor code reuse, ensure codebase cleanliness.

## Audience & Principles
- Audience: Ages 6–12; short sessions; simple controls; readable UI.
- Principles: Safety-by-default, low cognitive load, progressive complexity.

## Core Loop (MVP)
- Players sign in, pick a color/shape avatar, and spawn into a shared 2D map.
- Move with arrow/WASD, see other players in near real-time, simple emotes.
- No chat initially; preset emotes only. Optional safe name selection.

## World & Avatars (MVP)
- Avatars: Elegant line/shape primitives (circle, triangle, line). Minimal animation.
- World: One continuous map (tiled or infinite-wrapping), simple colliders.
- Objects: Static points of interest for gathering; no inventory yet.

## Tech Stack (Proposed)
- Frontend: Next.js (Vercel), TypeScript, HTML5 Canvas (no heavy engine), Zustand for client state.
- Real-time: Colyseus (TypeScript) as authoritative game server (Fly.io/Railway).
- Persistence: Postgres (Neon/Supabase) for durable data; Upstash Redis (Vercel KV) for ephemeral state/pub-sub.
- Auth/Payments: Clerk (auth) and Stripe (optional later).
- Shared: Zod for schemas, single Turborepo with `packages/shared` for types.

## Accounts & Parental Controls (MVP)
- Parent Account: Signs up with email (Clerk), verified. Acts as owner of a Family.
- Child Profile: No email required. Child selects an existing parent to submit a join request; gameplay is locked until the parent approves.
- Selecting Parent: Use a parent code/QR or device-local recent list—never a public directory of parents. Approval happens in the parent dashboard.
- Time Limits: Parent sets daily/weekly time budgets and optional play windows. Server tracks `time_left` and enforces admission/auto-logout.
- Data Model (initial):
  - `families(id, parent_user_id)`
  - `child_profiles(id, family_id, display_name, status: pending|approved, time_budget_day, time_left_day, play_windows_json)`
  - `sessions(id, child_id, started_at, ended_at)`
  - Redis keys for active session counters and per-child remaining time
- Enforcement: Colyseus `onJoin` checks approval and schedule; simulation interval decrements `time_left`; when exhausted or out-of-window, server ends session and notifies client.
- Dashboard: Parent UI to approve children, adjust budgets/windows, and view recent sessions.

## Game Data Model
Persistent (Postgres)
- `color_defs(id smallint pk, name text, hex text, point_value smallint, density_weight smallint)`
  - Rule: density_weight ∝ point_value (higher-value colors appear more often per spec).
- `evolution_stages(stage smallint pk, name text, required_points smallint default 100, visual_json jsonb, min_xp int)`
- `avatars(child_id uuid pk fk->child_profiles.id, color_id smallint fk->color_defs.id, stage smallint, points_in_color smallint, xp_total int, pos_x int, pos_y int, speed smallint, last_evolved_at timestamptz)`
- `picked_items(child_id uuid, chunk_x int, chunk_y int, item_local_id int, color_id smallint, picked_at timestamptz, primary key(child_id, chunk_x, chunk_y, item_local_id))`
- `sessions(id uuid pk, child_id uuid fk, started_at timestamptz, ended_at timestamptz, seconds_played int)`

Real-time (Redis/Memory)
- `presence:player:{childId}` → {pos, vel, colorId, stage, pointsInColor}
- `time_left:{childId}` → remaining seconds for current window
- `chunk:seed:{cx}:{cy}` → deterministic RNG seed
- `chunk:items:{cx}:{cy}` → ephemeral set of spawned item ids/colors (server-owned)

World & Spawning
- Infinite canvas via chunks (e.g., 256×256 units). Seed = hash(world_seed, cx, cy).
- Spawn per chunk using `density_weight`; same-color pickup grants `point_value(color)` points. Different-color collision resets points to 0 and changes avatar color to the hit color.
- Persist only consumed items in `picked_items` to prevent re-collection; unvisited chunks are generated on-the-fly.

Evolution Path (visual_json examples)
- Stage 0: { shape: "dot", size: 8 }
- Stage 1: { shape: "circle", size: 10, stroke: true }
- Stage 2: { shape: "circle", size: 12, eyes: true }
- Stage 3: { shape: "circle", size: 12, idleAnim: "wobble" }
- Stage 4: { shape: "circle+tail", size: 12 }
- Stage 5: { shape: "circle", size: 12, glow: true }

## Networking & Persistence
- Model: Server-authoritative; clients send input; server simulates world at 10–20 TPS.
- Transport: WebSocket (Colyseus); delta patches to clients within AOI (area-of-interest).
- Persistence: Periodic world snapshots to Redis; durable user/world data in Postgres.
 - Compliance Hooks: Admission and tick loop enforce parental approvals and time budgets server-side.

## Shared Schemas (Zod/TypeScript)
```ts
import { z } from "zod";

export const MoveInput = z.object({
  seq: z.number().int().nonnegative(),
  dx: z.number(),
  dy: z.number(),
  keys: z.array(z.enum(["up","down","left","right"]).optional()).optional(),
});
export type MoveInput = z.infer<typeof MoveInput>;

export const PickupEvent = z.object({
  chunkX: z.number().int(),
  chunkY: z.number().int(),
  itemLocalId: z.number().int(),
  colorId: z.number().int(),
});
export type PickupEvent = z.infer<typeof PickupEvent>;

export const AvatarState = z.object({
  id: z.string(),
  colorId: z.number().int(),
  stage: z.number().int(),
  pointsInColor: z.number().int().min(0).max(100),
  xpTotal: z.number().int().min(0),
  pos: z.object({ x: z.number(), y: z.number() }),
  vel: z.object({ x: z.number(), y: z.number() }),
});
export type AvatarState = z.infer<typeof AvatarState>;

export const Env = z.object({
  WORLD_SEED: z.string().min(1),
});
export type Env = z.infer<typeof Env>;
```

## Safety & Compliance
- No UGC text at MVP; whitelisted emotes only.
- PII minimal; COPPA-aware flows; parent consent gate for payments.
- Rate limiting at edge; reconcile server state to prevent cheating.

## Milestones
- M0: Static prototype (local movement, canvas render).
- M1: Multiplayer room with 20–50 clients, basic AOI, emotes.
- M1.5: Parent dashboard, child approvals (no-email), time limits enforcement.
- M2: Single shard map, persistence, basic moderation tooling.

## Open Questions
- Sharding vs. zones for scaling beyond hundreds of concurrent users?
- In-browser perf targets (60 FPS on low-end Chromebooks)?
- Which payments unlocks (cosmetics, passes) and parental consent flow?
