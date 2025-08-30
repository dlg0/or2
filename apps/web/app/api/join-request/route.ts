import { auth } from "@clerk/nextjs/server";
import { getDb } from "@db/client";
import { families, childProfiles } from "@db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const body = await request.json().catch(() => ({}));
  const { parentCode, displayName } = body as { parentCode?: string; displayName?: string };
  if (!parentCode || !displayName) return new Response("Missing fields", { status: 400 });

  const fam = await db.select().from(families).where(eq(families.parentCode, parentCode)).limit(1);
  if (fam.length === 0) return new Response("Invalid code", { status: 404 });

  const [child] = await db.insert(childProfiles).values({ familyId: fam[0].id, displayName, status: "pending" }).returning();
  return Response.json(child);
}

