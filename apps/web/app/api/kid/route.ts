import { cookies } from "next/headers";
import { getDb } from "@db/client";
import { families, childProfiles } from "@db/schema";
import { eq, and } from "drizzle-orm";

async function setCookie(name: string, value: string) {
  const jar = await cookies();
  jar.set({ name, value, httpOnly: true, sameSite: "lax", path: "/" });
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json().catch(() => ({}));
  const { parentCode, displayName } = body as { parentCode?: string; displayName?: string };
  if (!parentCode || !displayName) return Response.json({ error: "Missing fields" }, { status: 400 });

  const fam = await db.select().from(families).where(eq(families.parentCode, String(parentCode).toUpperCase())).limit(1);
  if (fam.length === 0) return Response.json({ error: "Invalid code" }, { status: 404 });

  const existing = await db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.familyId, fam[0].id), eq(childProfiles.displayName, displayName)))
    .limit(1);

  let child = existing[0];
  if (!child) {
    const inserted = await db.insert(childProfiles).values({ familyId: fam[0].id, displayName, status: "pending" }).returning();
    child = inserted[0];
  }

  // Set a simple cookie for the child session (dev only)
  await setCookie("kid_id", child.id);
  await setCookie("kid_family", fam[0].id);
  await setCookie("kid_status", child.status);
  await setCookie("kid_name", displayName);

  return Response.json({ id: child.id, status: child.status, familyId: fam[0].id, displayName });
}
