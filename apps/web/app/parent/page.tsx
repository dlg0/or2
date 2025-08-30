"use client";
import { useUser, UserButton } from "@clerk/nextjs";
import useSWR, { mutate } from "swr";

const post = (url: string) => fetch(url, { method: "POST" }).then((r) => r.json());
const get = (url: string) => fetch(url).then((r) => r.json());

export default function ParentDashboard() {
  const { user, isSignedIn } = useUser();
  const { data } = useSWR(isSignedIn ? "/api/families" : null, post);
  const { data: kids } = useSWR(isSignedIn ? "/api/children" : null, get);

  if (!isSignedIn) return <div style={{ padding: 24 }}>Please sign in</section>;

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h1 style={{ margin: 0 }}>Parent Dashboard</h1><UserButton afterSignOutUrl="/" /></header>
      <p style={{ color: "#aaa" }}>Signed in as: {user?.emailAddresses?.[0]?.emailAddress || user?.id}</p>
      {data && (
        <section style={{ marginTop: 16, padding: 16, border: "1px solid #333", borderRadius: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>Family ID: {data.id}</div>
          <div style={{ fontSize: 12, color: "#aaa" }}>Parent Code</div>
              <div style={{ fontSize: 28, letterSpacing: 4 }}>{data.parentCode}</div>
            </div>
            <button onClick={() => navigator.clipboard.writeText(String(data.parentCode)).then(()=>alert("Copied!")).catch(()=>{})}>Copy</button>
            <button onClick={async()=>{await fetch("/api/family/regenerate",{method:"POST"}); location.reload();}}>Regenerate</button>
          </div>
          {data.status && data.status !== "approved" && (<p style={{ marginTop: 8, color: "#f1c40f" }}>Account status: {data.status}. If sign-ups are invite-only, this is fine.</p>)}
          <p style={{ marginTop: 8 }}>Kids go to <code>/kid</code> and enter this code plus their name to request access.</p>
        </div>
      )}
      <p style={{ marginTop: 16 }}>Share your Parent Code with your child to request access.</p>
      <section style={{ marginTop: 24 }}>
        <h2>Children</h2>
        {!kids ? (
          <div>Loading…</div>
        ) : kids.length === 0 ? (
          <div>No children yet.</div>
        ) : (
          <ul>
            {kids.map((c: any) => (
              <li key={c.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span>
                  {c.displayName} — <em>{c.status}</em>
                </span>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
