import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware({
  // Explicitly allow auth routes and APIs as public
  publicRoutes: [
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/(.*)",
    "/health",
    "/api/health",
  ],
} as any);

export const config = {
  // Match all routes except static files and _next
  matcher: ["/((?!.+\\.\\w+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
