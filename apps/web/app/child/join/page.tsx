"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function ChildJoinPage() {
  const { isSignedIn } = useUser();
  const [parentCode, setParentCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/join-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentCode: parentCode.trim(), displayName: displayName.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("Request sent! Waiting for parent approval.");
    } catch (err: any) {
      setStatus(err?.message || "Failed to send request");
    } finally {
      setBusy(false);
    }
  };

  if (!isSignedIn) return <main style={{ padding: 24 }}>Please sign in</main>;

  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Join Family</h1>
      <p>Enter your parent code to request access.</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
        <input placeholder="Parent code" value={parentCode} onChange={(e) => setParentCode(e.target.value)} required />
        <input placeholder="Your display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <button disabled={busy} type="submit">{busy ? "Sending..." : "Send Join Request"}</button>
      </form>
      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}

