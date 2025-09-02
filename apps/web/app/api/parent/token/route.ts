import { auth } from "@clerk/nextjs/server";
import { getDb } from "@db/client";
import { families } from "@db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function b64url(input: Buffer) {
  return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function GET() {
  const { userId } = auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const rows = await db.select().from(families).where(eq(families.parentUserId, userId)).limit(1);
  if (rows.length === 0) return new Response("No family", { status: 404 });

  const secret = process.env.TOKEN_SECRET;
  if (!secret) return new Response("Server misconfigured: TOKEN_SECRET missing", { status: 500 });

  const payload = { parent: userId, fam: rows[0].id, exp: Math.floor(Date.now() / 1000) + 10 * 60 };
  const data = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac("sha256", secret).update(data).digest("hex");
  const token = `${data}.${sig}`;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[parent/token] sig.fp=${sig.slice(0,8)} data.len=${data.length}`);
  }
  return Response.json({ token });
}

