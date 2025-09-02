import { cookies } from "next/headers";
import crypto from "crypto";

function b64url(input: Buffer) {
  return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function GET() {
  const jar = await cookies();
  const id = jar.get("kid_id")?.value;
  if (!id) return new Response("No kid", { status: 401 });
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[kid/token] TOKEN_SECRET is not set; cannot sign token");
    }
    return new Response("Server misconfigured: TOKEN_SECRET missing", { status: 500 });
  }
  const fp = crypto.createHash("sha256").update(secret).digest("hex").slice(0, 8);
  const payload = { kid: id, exp: Math.floor(Date.now() / 1000) + 5 * 60 };
  const body = Buffer.from(JSON.stringify(payload));
  const data = b64url(body);
  const sig = crypto.createHmac("sha256", secret).update(data).digest("hex");
  const token = `${data}.${sig}`;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[kid/token] secret.fp=${fp} sig.fp=${sig.slice(0,8)} data.len=${data.length}`);
  }
  return Response.json({ token });
}
