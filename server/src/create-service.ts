import { createInputValidator } from "./utils/create-input-validator";
import { createInputParsers } from "./utils/create-input-parsers";
import { createTransactionsProcessor } from "./domain/create-transactions-processor";
import { getConnectionPool } from "./db-utils";
import { createPostgresRepository } from "./repository/create-postgres-repository";

/**
 * Creates the payment processor.
 */
export const createService = () => {
  const { parseInput } = createInputParsers();

  const { validator } = createInputValidator();

  const { process } = createTransactionsProcessor({
    repository: createPostgresRepository(),
    pool: getConnectionPool(),
  });

  return {
    run: async () => {
      const input = await parseInput();
      const transactions = input.map((record) => validator({ record }));

      await process({ transactions });
    },
  };
};
