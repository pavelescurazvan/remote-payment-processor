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
  const { parseInput } = createInputParsers();

  const { validator } = createInputValidator();

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
    run: async () => {
      const input = await parseInput();
      const transactions = input.map((record) => validator({ record }));

      const clients = await process({ transactions });

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
