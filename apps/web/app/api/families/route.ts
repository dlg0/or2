import { auth } from "@clerk/nextjs/server";
import { getDb } from "@db/client";
import { families } from "@db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export async function POST() {
  const { userId } = auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb();

  // get or create family for parent user
  const existing = await db.select().from(families).where(eq(families.parentUserId, userId)).limit(1);
  if (existing.length > 0) return Response.json(existing[0]);

  // 4-char parent code, uppercase alphanumeric (no confusing chars)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  const code = Array.from({ length: 4 }, () => alphabet[randomBytes(1)[0] % alphabet.length]).join("");
  const [created] = await db.insert(families).values({ parentUserId: userId, parentCode: code }).returning();
  return Response.json(created);
}
