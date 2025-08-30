import { auth } from "@clerk/nextjs/server";
import { getDb } from "@db/client";
import { families } from "@db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export async function POST() {
  const { userId } = auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 4 }, () => alphabet[randomBytes(1)[0] % alphabet.length]).join("");
  const res = await db.update(families).set({ parentCode: code }).where(eq(families.parentUserId, userId)).returning();
  if (res.length === 0) return new Response("No family", { status: 404 });
  return Response.json(res[0]);
}
