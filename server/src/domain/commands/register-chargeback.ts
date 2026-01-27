import { Repository } from "../../repository/create-postgres-repository";
import { Transaction, TransactionDto, TransactionType } from "../types";
import { PoolClient } from "pg";
import {
  InvalidTransactionType,
  InvalidWalletState,
  TransactionNotFound,
} from "../Errors";

/**
 * Registers a chargeback transaction.
 * Updates the ledger with the latest `held` and `total` balances.
 * Marks the client as locked
 * @param repository
 * @param pool
 * @param transaction
 */
export const registerChargeback = async ({
  repository,
  pool,
  transaction,
}: {
  repository: Repository;
  pool: PoolClient;
  transaction: Transaction;
}) => {
  if (transaction.type !== TransactionType.CHARGEBACK) {
    throw new InvalidTransactionType({
      client: transaction.client,
      type: transaction.type,
      tx: transaction.tx,
    });
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

  if (!disputedTransaction) {
    throw new TransactionNotFound({
      client: transaction.client,
      tx: transaction.tx,
    });
  }

  if (lastTransaction.held < disputedTransaction.amount) {
    throw new InvalidWalletState({
      client: transaction.client,
      tx: transaction.tx,
    });
  }

  const updatedVersion = lastTransaction.version + 1;
  const updatedAvailable =
    lastTransaction.available - disputedTransaction.amount;
  const updatedHeld = lastTransaction.held - disputedTransaction.amount;
  const updatedLocked = true;

  const transactionDto: TransactionDto = {
    ...transaction,
    version: updatedVersion,
    available: updatedAvailable,
    held: updatedHeld,
    total: lastTransaction.available,
    locked: updatedLocked,
  };

  await repository.transactions.append(pool, transactionDto);
};
