import { auth } from "@clerk/nextjs/server";
import { getDb } from "@db/client";
import { families, childProfiles } from "@db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { childId } = body as { childId?: string };
  if (!childId) return new Response("Missing childId", { status: 400 });

  const db = getDb();
  const fam = await db.select().from(families).where(eq(families.parentUserId, userId)).limit(1);
  if (fam.length === 0) return new Response("No family", { status: 404 });

  // Ensure the child belongs to this family
  const res = await db
    .update(childProfiles)
    .set({ status: "approved" })
    .where(and(eq(childProfiles.id, childId), eq(childProfiles.familyId, fam[0].id)))
    .returning();
  if (res.length === 0) return new Response("Not found", { status: 404 });
  return Response.json(res[0]);
}

