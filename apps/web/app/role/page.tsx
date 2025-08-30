"use client";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RolePicker() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isSignedIn, router]);
  if (!isSignedIn) return null;

  const setRole = async (role: "parent" | "child") => {
    if (!user) return;
    setBusy(true);
    // Use unsafeMetadata on the client; server can later copy vetted values to publicMetadata
    await user.update({ unsafeMetadata: { ...(user.unsafeMetadata || {}), role } });
    setBusy(false);
    router.push(role === "parent" ? "/parent" : "/child/join");
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
