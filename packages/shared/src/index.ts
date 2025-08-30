import { z } from "zod";

export const MoveInput = z.object({
  seq: z.number().int().nonnegative(),
  dx: z.number(),
  dy: z.number(),
  keys: z.array(z.enum(["up", "down", "left", "right"]).optional()).optional()
});
export type MoveInput = z.infer<typeof MoveInput>;

export const PickupEvent = z.object({
  chunkX: z.number().int(),
  chunkY: z.number().int(),
  itemLocalId: z.number().int(),
  colorId: z.number().int()
});
export type PickupEvent = z.infer<typeof PickupEvent>;

export const AvatarState = z.object({
  id: z.string(),
  colorId: z.number().int(),
  stage: z.number().int(),
  pointsInColor: z.number().int().min(0).max(100),
  xpTotal: z.number().int().min(0),
  pos: z.object({ x: z.number(), y: z.number() }),
  vel: z.object({ x: z.number(), y: z.number() })
});
export type AvatarState = z.infer<typeof AvatarState>;

export const Env = z.object({ WORLD_SEED: z.string().min(1) });
export type Env = z.infer<typeof Env>;

