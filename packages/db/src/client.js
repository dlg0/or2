import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// Create and export a singleton Drizzle client using node-postgres.
// Reads `DATABASE_URL` from env. Ensure it's set (Neon connection string).
let _pool;
let _db;
export function getDb() {
    if (_db)
        return _db;
    const url = process.env.DATABASE_URL;
    if (!url)
        throw new Error("DATABASE_URL is not set");
    _pool = new Pool({ connectionString: url, max: 5, ssl: url.includes("neon.tech") ? { rejectUnauthorized: false } : undefined });
    _db = drizzle(_pool);
    return _db;
}
export async function closeDb() {
    await _pool?.end();
}
