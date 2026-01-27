import { Repository } from "../../repository/create-postgres-repository";
import {Transaction, TransactionDto, TransactionType} from "../types";
import {PoolClient} from "pg";

/**
 * Registers a dispute transaction.
 * Updates the ledger with the latest `available` and `held` balances.
 * @param repository
 * @param pool
 * @param transaction
 */
export const registerDispute = async ({
  repository,
  pool,
  transaction,
}: {
  repository: Repository,
  pool: PoolClient,
  transaction: Transaction,
}) => {
  if (transaction.type !== TransactionType.DISPUTE) {
    throw new Error(JSON.stringify({
      message: "Invalid transaction type",
      transaction,
    }));
  }

  const lastTransaction = await repository.transactions.readLast({
    pool,
    client: transaction.client,
  });

  const disputedTransaction = await repository.transactions.get({
    pool,
    client: transaction.client,
    tx: transaction.tx,
  });

  const updatedVersion = lastTransaction.version + 1;
  const updatedAvailable = lastTransaction.available - disputedTransaction.amount;
  const updatedHeld = lastTransaction.held + disputedTransaction.amount;

  const transactionDto: TransactionDto = {
    ...transaction,
    version: updatedVersion,
    available: updatedAvailable,
    held: updatedHeld,
    total: lastTransaction.available,
    locked: lastTransaction.locked,
  }

  await repository.transactions.append(
    pool,
    transactionDto
  );
}
