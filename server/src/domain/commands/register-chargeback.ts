import { Repository } from "../../repository/create-postgres-repository";
import { Transaction, TransactionDto } from "../types";
import { Pool } from "pg";
import {
  InvalidWalletState,
  TransactionNotFound,
  TransactionNotDisputed,
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
  pool: Pool;
  transaction: Transaction;
}) => {
  const lastTransaction = await repository.transactions.readLast({
    pool,
    client: transaction.client,
  });

  const disputedTransaction = await repository.transactions.getDeposit({
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

  const hasDispute = await repository.transactions.hasDispute({
    pool,
    client: transaction.client,
    tx: transaction.tx,
  });

  if (!hasDispute) {
    throw new TransactionNotDisputed({
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
  const updatedHeld = lastTransaction.held - disputedTransaction.amount;
  const updatedTotal = lastTransaction.total - disputedTransaction.amount;
  const updatedLocked = true;

  const transactionDto: TransactionDto = {
    ...transaction,
    version: updatedVersion,
    available: lastTransaction.available,
    held: updatedHeld,
    total: updatedTotal,
    locked: updatedLocked,
  };

  await repository.transactions.append(pool, transactionDto);
};
