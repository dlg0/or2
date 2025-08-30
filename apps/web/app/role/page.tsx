"use client";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RolePicker() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!isSignedIn) {
    router.replace("/sign-in");
    return null;
  }

  const setRole = async (role: "parent" | "child") => {
    if (!user) return;
    setBusy(true);
    await user.update({ publicMetadata: { ...(user.publicMetadata || {}), role } });
    setBusy(false);
    router.push(role === "parent" ? "/parent" : "/play");
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Choose Role</h1>
      <p>This sets your account role for Octorobot.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <button disabled={busy} onClick={() => setRole("parent")}>I'm a Parent</button>
        <button disabled={busy} onClick={() => setRole("child")}>I'm a Child</button>
      </div>
    </main>
  );
}

