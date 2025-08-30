"use client";
import { useState } from "react";

export default function KidGateway() {
  const [parentCode, setParentCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed");
      setMsg(json?.status === "approved" ? "Signed in! You can play now." : "Account created. Waiting for parent approval.");
    } catch (err: any) {
      setMsg(err?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ padding: 24, display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div style={{ width: 360 }}>
        <h1>I'm a Kid</h1>
        <p>Enter your name and the 4‑character code your parent gave you.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
          <input placeholder="Parent code" value={parentCode} onChange={(e) => setParentCode(e.target.value.toUpperCase())} maxLength={4} required />
          <input placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <button type="submit" disabled={busy}>{busy ? "Please wait…" : "Continue"}</button>
        </form>
        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
        <p style={{ marginTop: 12 }}><a href="/play">Go to Play</a></p>
      </div>
    </main>
  );
}

