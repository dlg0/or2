"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function ParentSetup() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [msg, setMsg] = useState("Setting up your account…");

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const res = await fetch("/api/role/ensure-parent", { method: "POST" });
        if (!res.ok) throw new Error(await res.text());
        setMsg("Done. Redirecting…");
        router.replace("/parent");
      } catch (e: any) {
        setMsg(e?.message || "Failed to set role");
      }
    })();
  }, [isSignedIn, router]);

  return <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>{msg}</main>;
}

