import { Pool } from "pg";

/**
 * Runs a query.
 * @param pool
 * @param sql
 * @param bindings
 */
export async function query(pool: Pool, sql: string, bindings: unknown[] = []) {
  const connection = await pool.connect();

  try {
    return await connection.query(sql, bindings);
  } finally {
    connection.release();
  }
}
