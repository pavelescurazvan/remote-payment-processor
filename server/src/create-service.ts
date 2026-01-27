import { createInputValidator } from "./utils/create-input-validator";
import { createInputParsers } from "./utils/create-input-parsers";
import { createTransactionsProcessor } from "./domain/create-transactions-processor";
import { getConnectionPool } from "./db-utils";
import { createPostgresRepository } from "./repository/create-postgres-repository";

/**
 * Creates the payment processor.
 */
export const createService = () => {
  const { validator } = createInputValidator();

  const { parseInput } = createInputParsers();

  const { process } = createTransactionsProcessor({
    repository: createPostgresRepository(),
    pool: getConnectionPool(),
  });

  return {
    run: async () => {
      console.log("Service started");

      const input = await parseInput();

      const transactions = input.map(validator);

      await process({ transactions });

      console.log("Service finished");
    },
  };
};
