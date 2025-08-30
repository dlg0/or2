"use client";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
}

