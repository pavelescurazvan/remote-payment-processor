import { Repository } from "../../repository/create-postgres-repository";
import { Transaction, TransactionDto } from "../types";
import { Pool } from "pg";
import {
  InvalidTransactionPayload,
  WalletLocked,
} from "../Errors";

/**
 * Registers a deposit transaction.
 * Updates the ledger with the latest `available` and `total` balances.
 * @param repository
 * @param pool
 * @param transaction
 */
export const registerDeposit = async ({
  repository,
  pool,
  transaction,
}: {
  repository: Repository;
  pool: Pool;
  transaction: Transaction;
}) => {
  if (!transaction.amount) {
    throw new InvalidTransactionPayload({
      client: transaction.client,
      type: transaction.type,
      amount: transaction.amount,
      tx: transaction.tx,
    });
  }

  const lastTransaction = await repository.transactions.readLast({
    pool,
    client: transaction.client,
  });

  if (lastTransaction.locked) {
    throw new WalletLocked({
      client: transaction.client,
      tx: transaction.tx,
    });
  }

  const updatedVersion = lastTransaction.version + 1;
  const updatedAvailable = lastTransaction.available + transaction.amount;
  const updatedTotal = updatedAvailable + lastTransaction.held;

  const transactionDto: TransactionDto = {
    ...transaction,
    version: updatedVersion,
    available: updatedAvailable,
    held: lastTransaction.held,
    total: updatedTotal,
    locked: lastTransaction.locked,
  };

  try {
    await repository.transactions.append(pool, transactionDto);
  } catch (e) {
    // Idempotency
    if (e?.code === "23505" && e?.constraint === "event_store_client_tx_type_uk") {
      console.log(`Transaction ${transaction.type} with tx ${transaction.tx} for client ${transaction.client} already processed. Skipping.`);
      return;
    }

    throw e;
  }
};
