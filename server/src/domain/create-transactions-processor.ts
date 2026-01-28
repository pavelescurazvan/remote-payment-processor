import { Pool } from "pg";
import { Transaction, TransactionType } from "./types";
import { registerDeposit } from "./commands/register-deposit";
import { Repository } from "../repository/create-postgres-repository";
import { registerWithdrawal } from "./commands/register-withdrawal";
import { registerDispute } from "./commands/register-dispute";
import { registerResolve } from "./commands/register-resolve";
import { registerChargeback } from "./commands/register-chargeback";
import { InvalidTransactionType } from "./Errors";
import { errorHandler } from "./error-handler";

export const createTransactionsProcessor = ({
  repository,
  pool,
}: {
  repository: Repository;
  pool: Pool;
}) => {
  /**
   * Processes a single transaction
   * @param transaction
   */
  const processTransaction = async (transaction: Transaction) => {
    console.log(
      `Processing ${transaction.type} transaction ${transaction.tx} for ${transaction.client} with amount ${transaction.amount}`
    );

    switch (transaction.type) {
      case TransactionType.DEPOSIT: {
        await registerDeposit({
          repository,
          pool,
          transaction,
        });
        break;
      }
      case TransactionType.WITHDRAWAL: {
        await registerWithdrawal({
          repository,
          pool,
          transaction,
        });
        break;
      }
      case TransactionType.DISPUTE: {
        await registerDispute({
          repository,
          pool,
          transaction,
        });
        break;
      }
      case TransactionType.REZOLVE: {
        await registerResolve({
          repository,
          pool,
          transaction,
        });
        break;
      }
      case TransactionType.CHARGEBACK: {
        await registerChargeback({
          repository,
          pool,
          transaction,
        });
        break;
      }
      default: {
        throw new InvalidTransactionType({
          client: transaction.client,
          type: transaction.type,
          tx: transaction.tx,
        });
      }
    }
  };

  return {
    process: async ({ transactions }: { transactions: Transaction[] }) => {
      const clientIds = new Set<number>();

      for (const transaction of transactions) {
        await errorHandler(processTransaction, transaction);
        clientIds.add(transaction.client);
      }

      return clientIds;
    },
  };
};
