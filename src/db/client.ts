import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

declare global {
  var _postgresClient: postgres.Sql | undefined;
}

const connectionString = process.env.DATABASE_URL;

const sql =
  globalThis._postgresClient ||
  postgres(connectionString || "postgresql://postgres:postgres@localhost:5432/mymedialist", {
    max: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis._postgresClient = sql;
}

export const db = drizzle(sql);
export { sql };
