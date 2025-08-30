import { auth } from "@clerk/nextjs/server";
import { getDb } from "@db/client";
import { families, childProfiles } from "@db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const { userId } = auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const fam = await db.select().from(families).where(eq(families.parentUserId, userId)).limit(1);
  if (fam.length === 0) return new Response("No family", { status: 404 });
  const rows = await db.select().from(childProfiles).where(eq(childProfiles.familyId, fam[0].id));
  return Response.json(rows);
}

