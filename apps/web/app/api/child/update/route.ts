import { auth } from "@clerk/nextjs/server";
import { getDb } from "@db/client";
import { families, childProfiles } from "@db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { childId, timeBudgetDay, timeLeftDay } = body as { childId?: string; timeBudgetDay?: number; timeLeftDay?: number };
  if (!childId) return new Response("Missing childId", { status: 400 });
  const db = getDb();
  const fam = await db.select().from(families).where(eq(families.parentUserId, userId)).limit(1);
  if (fam.length === 0) return new Response("No family", { status: 404 });
  const update: any = {};
  if (typeof timeBudgetDay === 'number') update.timeBudgetDay = Math.max(0, timeBudgetDay);
  if (typeof timeLeftDay === 'number') update.timeLeftDay = Math.max(0, timeLeftDay);
  const res = await db.update(childProfiles).set(update).where(and(eq(childProfiles.id, childId), eq(childProfiles.familyId, fam[0].id))).returning();
  if (res.length === 0) return new Response("Not found", { status: 404 });
  return Response.json(res[0]);
}

