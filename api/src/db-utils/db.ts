import { Pool } from "pg";
import { config } from "../config";

/**
 * Initialises a connection pool.
 */
export function getConnectionPool(): Pool {
  return new Pool({
    host: config.dbHost,
    database: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    port: config.dbPort,
  });
}
