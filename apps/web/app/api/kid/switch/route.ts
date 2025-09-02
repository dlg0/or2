import { cookies } from "next/headers";
import { getDb } from "@db/client";
import { childProfiles, families } from "@db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { childId } = body as { childId?: string };
  if (!childId) return new Response("Missing childId", { status: 400 });
  const db = getDb();
  const rows = await db.select().from(childProfiles).where(eq(childProfiles.id, childId)).limit(1);
  if (rows.length === 0) return new Response("Not found", { status: 404 });
  const kid = rows[0] as any;
  const jar = await cookies();
  jar.set({ name: "kid_id", value: kid.id, httpOnly: true, sameSite: "lax", path: "/" });
  jar.set({ name: "kid_family", value: kid.familyId, httpOnly: true, sameSite: "lax", path: "/" });
  jar.set({ name: "kid_status", value: kid.status, httpOnly: true, sameSite: "lax", path: "/" });
  jar.set({ name: "kid_name", value: kid.displayName, httpOnly: true, sameSite: "lax", path: "/" });
  return Response.json({ id: kid.id, displayName: kid.displayName, status: kid.status, familyId: kid.familyId });
}
