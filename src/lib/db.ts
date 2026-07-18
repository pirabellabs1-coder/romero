/**
 * Postgres connection pool (Supabase).
 *
 * Why this replaces the previous SQLite + Vercel Blob persistence layer:
 * SQLite in serverless required shipping the DB through /tmp + syncing every
 * write back to Vercel Blob. That introduced cold-start data loss (a fresh
 * lambda would open the bundled seed instead of restoring from Blob, then
 * sync seed+1edit back to Blob — wiping prior writes), CDN cache staleness,
 * and silent multi-lambda divergence. Postgres-as-a-service eliminates all
 * of that: every lambda talks to the same always-on database.
 *
 * Connection mode: Supabase **Transaction pooler** (port 6543). It multiplexes
 * many short-lived serverless connections onto a small server-side pool,
 * which is the only viable mode for Vercel-style serverless. Prepared
 * statements / `SET` / advisory locks are NOT supported in transaction mode
 * (use simple parameterised queries only).
 */
import { Pool, types, type QueryResultRow } from "pg";

// Parse BIGINT (OID 20) as JS number. All our id columns fit comfortably under
// 2^53, and the rest of the codebase expects `number`, not `string`.
types.setTypeParser(20, (v) => parseInt(v, 10));

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function makePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it in Vercel project settings → Environment Variables."
    );
  }
  return new Pool({
    connectionString: url,
    // Supabase pooler requires SSL but uses Supabase's own CA — accept it.
    ssl: { rejectUnauthorized: false },
    // Serverless: one Postgres backend per warm lambda invocation is plenty.
    // The Supabase pooler does the multiplexing across all our lambdas.
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * Single global pool reused across hot-reloads in dev and warm lambda
 * invocations in prod. `globalThis` survives Next.js HMR; module-level
 * variables do not.
 */
export function pool(): Pool {
  if (!global._pgPool) {
    global._pgPool = makePool();
  }
  return global._pgPool;
}

/**
 * Run a parameterised query and return rows. Convenience wrapper so most
 * callers don't have to destructure `{ rows }` themselves.
 *
 *   const rows = await query<{ id: number; slug: string }>(
 *     "SELECT id, slug FROM galleries WHERE published = $1", [1]
 *   );
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>
): Promise<T[]> {
  const res = await pool().query<T>(text, params as unknown[]);
  return res.rows;
}

/** Run a query and return the first row, or `null` if no rows matched. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run a write that returns nothing relevant (just confirms success).
 * Equivalent to `query` but signals intent for INSERT/UPDATE/DELETE that
 * don't need RETURNING. Returns the affected row count.
 */
export async function execute(
  text: string,
  params?: ReadonlyArray<unknown>
): Promise<number> {
  const res = await pool().query(text, params as unknown[]);
  return res.rowCount ?? 0;
}

/**
 * Run a callback inside a transaction with a dedicated pooled client.
 * Rolls back automatically on throw. Use for multi-write sequences that
 * must all succeed or fail together (e.g. tool_use assistant message +
 * associated tool_result rows for the /api/chat endpoint).
 *
 * The pooled client is released to the pool in the finally block — safe
 * for both success and failure paths.
 */
export async function withTransaction<T>(
  fn: (client: {
    query: <R extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: ReadonlyArray<unknown>
    ) => Promise<R[]>;
    queryOne: <R extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: ReadonlyArray<unknown>
    ) => Promise<R | null>;
    execute: (
      text: string,
      params?: ReadonlyArray<unknown>
    ) => Promise<number>;
  }) => Promise<T>
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const wrapper = {
      query: async <R extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: ReadonlyArray<unknown>
      ): Promise<R[]> => {
        const r = await client.query<R>(text, params as unknown[]);
        return r.rows;
      },
      queryOne: async <R extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: ReadonlyArray<unknown>
      ): Promise<R | null> => {
        const r = await client.query<R>(text, params as unknown[]);
        return r.rows[0] ?? null;
      },
      execute: async (
        text: string,
        params?: ReadonlyArray<unknown>
      ): Promise<number> => {
        const r = await client.query(text, params as unknown[]);
        return r.rowCount ?? 0;
      },
    };
    const result = await fn(wrapper);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback failure — original error wins */
    }
    throw e;
  } finally {
    client.release();
  }
}
