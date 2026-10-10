import "dotenv/config";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ ERROR: DATABASE_URL is not set in environment or .env");
    console.error("Please add your PostgreSQL connection string to .env, e.g.:");
    console.error("DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const result = await sql`SELECT 1 AS connected`;
    console.log("✅ Successfully connected! Result:", result);

    const vectorExtension = await sql`
      SELECT installed_version FROM pg_available_extensions WHERE name = 'vector' AND installed_version IS NOT NULL;
    `;
    if (vectorExtension.length > 0) {
      console.log(`✅ pgvector extension is installed (version ${vectorExtension[0].installed_version}).`);
    } else {
      console.log("⚠️ pgvector extension is NOT installed yet. You can enable it with: CREATE EXTENSION IF NOT EXISTS vector;");
    }
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
