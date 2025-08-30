"use client";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
      <SignIn routing="path" path="/sign-in" afterSignInUrl="/role" afterSignUpUrl="/role" />
    </div>
  );
}
