import {
  createInputValidator,
  CsvRecord,
} from "./utils/create-input-validator";
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
  const repository = createPostgresRepository();

  const { process } = createTransactionsProcessor({
    repository,
    pool,
  });

  const { printOutput } = createRetrieveOutput({
    repository,
    pool,
  });

  return {
    /**
     * Runs the payment processor against an input CSV file.
     * @param filePath - Path to the CSV file to process.
     */
    run: async (filePath: string) => {
      const transactionsStream = parseInput(filePath);

      const clients = await process({
        transactions: transactionsStream,
      });

      await printOutput({ clients });
    },

    /**
     * Note: The `processStream` function is defined only as a showcase:
     * Processes a stream of CSV records (for concurrent stream processing).
     * Can be called multiple times in parallel for different streams.
     * @param stream - Async iterable of CSV records (raw objects with string values)
     * @returns Set of client IDs that were processed
     */
    processStream: async (stream: AsyncIterable<CsvRecord>) => {
      async function* validateStream() {
        for await (const record of stream) {
          yield validator({ record });
        }
      }

      await process({ transactions: validateStream() });
    },

    /**
     * Shuts down the payment processor.
     */
    shutDown: async () => {
      await pool.end();
    },
  };
};
