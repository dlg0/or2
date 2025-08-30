import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware({
  // Public routes include the canvas demo and status page for now
  // We will protect /play and /parent later.
  publicRoutes: ["/", "/health", "/api/health"],
});

export const config = {
  matcher: [
    // Run on all routes except static/_next
    "/((?!_next|assets|.*\\.(?:ico|png|jpg|jpeg|svg|css|js)).*)",
  ],
};

