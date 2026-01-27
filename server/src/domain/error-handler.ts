import { Transaction } from "./types";

/**
 * Wraps a function, catches, and handles any errors that occur during execution
 * @param fn
 * @param input
 */
export const errorHandler = async (
  fn: (input: Transaction) => Promise<void>,
  input: Transaction
) => {
  try {
    await fn(input);
  } catch (e) {
    // Handle idempotency error based on persistence unique constraint
    if (
      e?.code === "23505" &&
      e?.constraint === "event_store_client_tx_type_uk"
    ) {
      console.log(
        `Transaction ${JSON.stringify(input)} already processed. Skipping.`
      );
      return;
    }

    console.error(
      `Error processing transaction ${JSON.stringify(input)}: ${e.message}`
    );
  }
};
