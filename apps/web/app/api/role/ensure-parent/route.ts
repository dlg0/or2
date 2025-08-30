import { auth, clerkClient } from "@clerk/nextjs/server";
import { getDb } from "@db/client";
import { families } from "@db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export async function POST() {
  const { userId } = auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  // Set public role = parent via server-side SDK
  await clerkClient.users.updateUser(userId, { publicMetadata: { role: "parent" } });

  // Ensure family exists for this parent
  const db = getDb();
  const existing = await db.select().from(families).where(eq(families.parentUserId, userId)).limit(1);
  if (existing.length === 0) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 4 }, () => alphabet[randomBytes(1)[0] % alphabet.length]).join("");
    await db.insert(families).values({ parentUserId: userId, parentCode: code }).execute();
  }

  return Response.json({ ok: true });
}

