"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";

type Kid = { id: string; displayName: string; status: string; familyId: string };
const fetcher = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : null));

export default function KidGateway() {
  const { data: active, mutate } = useSWR<Kid | null>("/api/kid/status", fetcher);
  const [parentCode, setParentCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);

  // Keep a list of kids used on this device
  const [known, setKnown] = useState<Kid[]>([]);
  useEffect(() => {
    const raw = localStorage.getItem("kids_known");
    if (raw) setKnown(JSON.parse(raw));
  }, []);
  useEffect(() => {
    if (active?.id) {
      const next = [...known.filter((k) => k.id !== active.id), active];
      setKnown(next);
      localStorage.setItem("kids_known", JSON.stringify(next));
      if (!displayName) setDisplayName(active.displayName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.displayName, active?.status]);

  const authorized = active?.status === "approved";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/kid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentCode: parentCode.trim(), displayName: displayName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setMsg(json.status === "approved" ? "Authorized — you can play!" : "Request sent — waiting for approval.");
      await mutate();
    } catch (err: any) {
      setMsg(err?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const switchKid = async (kid: Kid) => {
    setBusy(true);
    try {
      await fetch("/api/kid/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: kid.id }) });
      await mutate();
      setChanging(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ padding: 24, display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div style={{ width: 420 }}>
        <h1>I'm a Kid</h1>

        {active ? (
          <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8, marginBottom: 12 }}>
            <div>Signed in as <strong>{active.displayName}</strong></div>
            <div style={{ color: authorized ? "#2ecc71" : "#f1c40f" }}>
              {authorized ? "Authorized" : "Not yet authorized"}
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <a href="/play"><button disabled={!authorized}>Go to Play</button></a>
              <button onClick={() => setChanging((v) => !v)}>{changing ? "Close" : "Change Kid"}</button>
            </div>
          </div>
        ) : null}

        {changing && (
          <div style={{ marginBottom: 16 }}>
            <h3>Choose another kid on this device</h3>
            {known.length === 0 ? (
              <div>No other kids yet.</div>
            ) : (
              <ul>
                {known.map((k) => (
                  <li key={k.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span>{k.displayName}</span>
                    <button disabled={busy} onClick={() => switchKid(k)}>Use</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <h3>{active ? "Add another kid" : "Enter your details"}</h3>
        <p>Enter the 4‑character code your parent gave you.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
          <input placeholder="Parent code" value={parentCode} onChange={(e) => setParentCode(e.target.value.toUpperCase())} maxLength={4} required />
          <input placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <button type="submit" disabled={busy}>{busy ? "Please wait…" : (active ? "Add" : "Continue")}</button>
        </form>
        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    </main>
  );
}
