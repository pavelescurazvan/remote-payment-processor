import { createInputValidator } from "./utils/create-input-validator";
import { createInputParsers } from "./utils/create-input-parsers";
import { createTransactionsProcessor } from "./domain/create-transactions-processor";
import { getConnectionPool } from "./db-utils";
import { createPostgresRepository } from "./repository/create-postgres-repository";
import { createRetrieveOutput } from "./domain/create-output-retriever";

/**
 * Creates the payment processor.
 */
export const createService = () => {
  const { validator } = createInputValidator();
  const { parseInput } = createInputParsers({ validator });

  const pool = getConnectionPool();
  const { process } = createTransactionsProcessor({
    repository: createPostgresRepository(),
    pool,
  });

  const { printOutput } = createRetrieveOutput({
    repository: createPostgresRepository(),
    pool,
  });

  return {
    /**
     * Runs the payment processor against an input CSV.
     */
    run: async (filePath: string) => {
      const transactionsStream = parseInput(filePath);

      const clients = await process({
        transactions: transactionsStream,
      });

      await printOutput({ clients });
    },

    /**
     * Shuts down the payment processor.
     */
    shutDown: async () => {
      await pool.end();
    },
  };
};
