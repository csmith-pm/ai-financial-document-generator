import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type DrizzleInstance = ReturnType<typeof createDb>;

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString });
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema });
}
