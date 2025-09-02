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

// Avatar Upgrades: shared catalog and helpers
// Each upgrade provides a gameplay power and a visual effect hint.
export const UpgradePowerType = z.enum(["speed", "magnet", "jump"]);
export type UpgradePowerType = z.infer<typeof UpgradePowerType>;

export const UpgradeVisual = z.enum(["glow", "trail", "aura"]);
export type UpgradeVisual = z.infer<typeof UpgradeVisual>;

export const AvatarUpgrade = z.object({
  id: z.string(),
  name: z.string(),
  power: z.object({
    type: UpgradePowerType,
    value: z.number(), // semantic depends on power type
  }),
  visual: z.object({
    type: UpgradeVisual,
    // hex color hint for the client; may reuse avatar color if not provided
    color: z.string().optional(),
  }),
});
export type AvatarUpgrade = z.infer<typeof AvatarUpgrade>;

// Minimal built-in catalog for the MVP loop
export const UPGRADE_CATALOG: Record<string, AvatarUpgrade> = {
  speed_t1: {
    id: "speed_t1",
    name: "Speed I",
    power: { type: "speed", value: 0.25 }, // +25% speed
    visual: { type: "glow", color: "#f1c40f" },
  },
  speed_t2: {
    id: "speed_t2",
    name: "Speed II",
    power: { type: "speed", value: 0.5 }, // +50% speed
    visual: { type: "glow", color: "#f39c12" },
  },
  magnet_t1: {
    id: "magnet_t1",
    name: "Magnet I",
    power: { type: "magnet", value: 64 }, // pickup radius in px
    visual: { type: "aura", color: "#3498db" },
  },
};

export function getUpgradeById(id: string): AvatarUpgrade | undefined {
  return UPGRADE_CATALOG[id];
}

export function speedMultiplierFromUpgrades(ids: readonly string[] | undefined): number {
  if (!ids || !ids.length) return 1;
  let bonus = 0;
  for (const id of ids) {
    const up = UPGRADE_CATALOG[id];
    if (up && up.power.type === "speed") bonus += up.power.value;
  }
  return Math.max(0.25, 1 + bonus);
}
