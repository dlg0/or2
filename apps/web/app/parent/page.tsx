"use client";
import { useUser } from "@clerk/nextjs";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url, { method: "POST" }).then((r) => r.json());

export default function ParentDashboard() {
  const { user, isSignedIn } = useUser();
  const { data } = useSWR(isSignedIn ? "/api/families" : null, fetcher);

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
    </main>
  );
}

