import "dotenv/config";

// Load the environment variables.
const rawEnv = process.env;

export const config = {
  dbHost: rawEnv.DB_HOST ?? "postgres",
  dbName: rawEnv.DB_NAME ?? "pay_pro",
  dbUser: rawEnv.DB_USER ?? "postgres",
  dbPassword: rawEnv.DB_PASSWORD ?? "postgres",
  dbPort: rawEnv.DB_PORT ? Number(rawEnv.DB_PORT) : 5432,

  enableLogs: rawEnv.LOGS ?? "no",
};
