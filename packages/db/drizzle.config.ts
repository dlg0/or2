import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "path";

// Try loading `.env` from repo root (../../.env) and from CWD as fallback.
const ROOT_ENV = path.resolve(process.cwd(), "../../.env");
const LOCAL_ENV = path.resolve(process.cwd(), ".env");
dotenv.config({ path: ROOT_ENV });
dotenv.config({ path: LOCAL_ENV });

export default defineConfig({
  out: "./migrations",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  strict: true,
});
