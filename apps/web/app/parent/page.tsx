"use client";
import { useUser } from "@clerk/nextjs";
import useSWR, { mutate } from "swr";

const post = (url: string) => fetch(url, { method: "POST" }).then((r) => r.json());
const get = (url: string) => fetch(url).then((r) => r.json());

export default function ParentDashboard() {
  const { user, isSignedIn } = useUser();
  const { data } = useSWR(isSignedIn ? "/api/families" : null, post);
  const { data: kids } = useSWR(isSignedIn ? "/api/children" : null, get);

  if (!isSignedIn) return <div style={{ padding: 24 }}>Please sign in</div>;

  return (
    <main style={{ padding: 24 }}>
      <h1>Parent Dashboard</h1>
      <p>Signed in as: {user?.emailAddresses?.[0]?.emailAddress || user?.id}</p>
      {data && (
        <div style={{ marginTop: 12 }}>
          <div>Family ID: {data.id}</div>
          <div>Parent Code: {data.parentCode}</div>
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
