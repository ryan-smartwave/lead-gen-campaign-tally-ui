import { neon } from "@neondatabase/serverless";

/**
 * Lazy database handle.
 *
 * Never connect at module scope: a missing DATABASE_URL would then crash the
 * dev server on import instead of letting the app boot and explain itself. The
 * app is fully usable with no database at all (it reads the scraper's local
 * files); the database exists so results can be viewed from another device.
 */

type Sql = ReturnType<typeof neon>;
let cached: Sql | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return (cached ??= neon(url));
}

export function requireDb(): Sql {
  const sql = db();
  if (!sql) {
    const err = new Error(
      "DATABASE_URL is not set. Create a free Neon project, put its connection string in web/.env.local, then run: npm run db:migrate",
    );
    (err as NodeJS.ErrnoException).code = "DB_NOT_CONFIGURED";
    throw err;
  }
  return sql;
}
