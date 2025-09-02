import { cookies } from "next/headers";
import { getDb } from "@db/client";
import { childProfiles } from "@db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const jar = await cookies();
  const id = jar.get("kid_id")?.value;
  const name = jar.get("kid_name")?.value;
  const familyId = jar.get("kid_family")?.value;
  if (!id || !familyId) return new Response("No kid", { status: 404 });
  const db = getDb();
  const rows = await db.select().from(childProfiles).where(eq(childProfiles.id, id)).limit(1);
  if (rows.length === 0) return new Response("No kid", { status: 404 });
  const status = rows[0].status as string;
  // refresh status cookie
  jar.set({ name: "kid_status", value: status, httpOnly: true, sameSite: "lax", path: "/" });
  return Response.json({ id, displayName: name || rows[0].displayName, status, familyId });
}
