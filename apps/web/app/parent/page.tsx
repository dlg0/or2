"use client";
import { useUser, UserButton } from "@clerk/nextjs";
import useSWR, { mutate } from "swr";

const post = (url: string) => fetch(url, { method: "POST" }).then((r) => r.json());
const get = (url: string) => fetch(url).then((r) => r.json());

export default function ParentDashboard() {
  const { user, isSignedIn } = useUser();
  const { data } = useSWR(isSignedIn ? "/api/families" : null, post);
  const { data: kids } = useSWR(isSignedIn ? "/api/children" : null, get);

  if (!isSignedIn) return <div style={{ padding: 24 }}>Please sign in</div>;

  const copy = async (txt: string) => {
    try { await navigator.clipboard.writeText(txt); alert("Copied!"); } catch {}
  };

  const regen = async () => {
    await fetch("/api/family/regenerate", { method: "POST" });
    mutate("/api/families");
  };

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Parent Dashboard</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/play"><button>Go to Play</button></a>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>
      <p style={{ color: "#aaa" }}>Signed in as: {user?.emailAddresses?.[0]?.emailAddress || user?.id}</p>
      {data && (
        <section style={{ marginTop: 16, padding: 16, border: "1px solid #333", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "#aaa" }}>Parent Code</div>
              <div style={{ fontSize: 28, letterSpacing: 4 }}>{data.parentCode}</div>
            </div>
            <button onClick={() => copy(String(data.parentCode))}>Copy</button>
            <button onClick={regen}>Regenerate</button>
          </div>
          {/* Clerk handles parent approvals; no status banner needed here. */}
          <p style={{ marginTop: 8 }}>Kids go to <code>/kid</code> and enter this code plus their name to request access.</p>
        </section>
      )}
      <section style={{ marginTop: 24 }}>
        <h2>Children</h2>
        {!kids ? (
          <div>Loading…</div>
        ) : kids.length === 0 ? (
          <div>No children yet.</div>
        ) : (
          <ul>
            {kids.map((c: any) => (
              <li key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #222" }}>
                <div>
                  <div><strong>{c.displayName}</strong> — <em>{c.status}</em></div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>Time left today: {Math.round((c.timeLeftDay ?? 0)/60)} min • Budget: {Math.round((c.timeBudgetDay ?? 0)/60)} min</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {c.status !== "approved" && (
                    <button
                      onClick={async () => {
                        await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: c.id }) });
                        mutate("/api/children");
                      }}
                    >
                      Approve
                    </button>
                  )}
                  <button onClick={async()=>{ await fetch('/api/child/update',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ childId: c.id, timeLeftDay: (c.timeBudgetDay ?? 0) })}); mutate('/api/children'); }}>Reset</button>
                  <button onClick={async()=>{ const v = Number(prompt('Set daily budget (minutes):', String(Math.round((c.timeBudgetDay ?? 0)/60)))); if (!Number.isNaN(v)) { const seconds = Math.max(0, Math.round(v*60)); await fetch('/api/child/update',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ childId: c.id, timeBudgetDay: seconds })}); mutate('/api/children'); } }}>Set Budget</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
