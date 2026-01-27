import { Repository } from "../../repository/create-postgres-repository";
import { Transaction, TransactionDto, TransactionType } from "../types";
import { Pool } from "pg";
import {
  InsufficientFundsError,
  InvalidTransactionPayload,
  InvalidTransactionType,
  WalletLocked,
} from "../Errors";

/**
 * Registers a withdrawal transaction.
 * Updates the ledger with the latest `available` and `total` balances.
 * @param repository
 * @param pool
 * @param transaction
 */
export const registerWithdrawal = async ({
  repository,
  pool,
  transaction,
}: {
  repository: Repository;
  pool: Pool;
  transaction: Transaction;
}) => {
  if (transaction.type !== TransactionType.WITHDRAWAL) {
    throw new InvalidTransactionType({
      client: transaction.client,
      type: transaction.type,
      tx: transaction.tx,
    });
  }

  if (
    !transaction.amount ||
    isNaN(transaction.amount) ||
    transaction.amount <= 0
  ) {
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

  if (transaction.amount > lastTransaction.available) {
    throw new InsufficientFundsError({
      client: transaction.client,
      available: lastTransaction.available,
      attempted: transaction.amount,
      tx: transaction.tx,
    });
  }

  const updatedVersion = lastTransaction.version + 1;
  const updatedAvailable = lastTransaction.available - transaction.amount;
  const updatedTotal = updatedAvailable + lastTransaction.held;

  const transactionDto: TransactionDto = {
    ...transaction,
    version: updatedVersion,
    available: updatedAvailable,
    held: lastTransaction.held,
    total: updatedTotal,
    locked: lastTransaction.locked,
  };

  await repository.transactions.append(pool, transactionDto);
};
