export async function GET() {
  try {
    const raw = process.env.NEXT_PUBLIC_SERVER_URL || "ws://localhost:2567";
    const base = raw.replace(/^ws/, "http");
    const url = `${base}/health`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    return Response.json({ ok: res.ok, url, status: res.status, data: json });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

