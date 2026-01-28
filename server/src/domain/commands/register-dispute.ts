import { Repository } from "../../repository/create-postgres-repository";
import { Transaction, TransactionDto, TransactionType } from "../types";
import { Pool } from "pg";
import { InvalidWalletState, TransactionNotFound, CannotDisputeNonDeposit } from "../Errors";

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
  repository: Repository;
  pool: Pool;
  transaction: Transaction;
}) => {
  const lastTransaction = await repository.transactions.readLast({
    pool,
    client: transaction.client,
  });

  const disputedTransaction = await repository.transactions.get({
    pool,
    client: transaction.client,
    tx: transaction.tx,
  });

  if (!disputedTransaction) {
    throw new TransactionNotFound({
      client: transaction.client,
      tx: transaction.tx,
    });
  }

  if (disputedTransaction.type !== TransactionType.DEPOSIT) {
    throw new CannotDisputeNonDeposit({
      client: transaction.client,
      tx: transaction.tx,
      type: disputedTransaction.type,
    });
  }

  if (lastTransaction.available < disputedTransaction.amount) {
    throw new InvalidWalletState({
      client: transaction.client,
      tx: transaction.tx,
    });
  }

  const updatedVersion = lastTransaction.version + 1;
  const updatedAvailable =
    lastTransaction.available - disputedTransaction.amount;
  const updatedHeld = lastTransaction.held + disputedTransaction.amount;

  const transactionDto: TransactionDto = {
    ...transaction,
    version: updatedVersion,
    available: updatedAvailable,
    held: updatedHeld,
    total: lastTransaction.total,
    locked: lastTransaction.locked,
  };

  await repository.transactions.append(pool, transactionDto);
};
