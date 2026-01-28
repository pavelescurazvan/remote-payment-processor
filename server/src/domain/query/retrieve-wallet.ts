import { Pool } from "pg";
import { Repository } from "../../repository/create-postgres-repository";
import { WalletNotFound } from "../Errors";

/**
 * Retrieves the wallet state for a given client.
 * @param repository
 * @param pool
 * @param client
 */
export const retrieveWallet = async ({
  repository,
  pool,
  client,
}: {
  repository: Repository;
  pool: Pool;
  client: number;
}) => {
  const lastTransaction = await repository.transactions.readLast({
    pool,
    client,
  });

  if (!lastTransaction) {
    throw new WalletNotFound({
      client,
    });
  }

  return {
    client,
    available: lastTransaction.available,
    held: lastTransaction.held,
    total: lastTransaction.total,
    locked: lastTransaction.locked,
  };
};
