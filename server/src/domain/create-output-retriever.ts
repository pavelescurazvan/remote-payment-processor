import { Pool } from "pg";
import { Repository } from "../repository/create-postgres-repository";
import { retrieveWallet } from "./query/retrieve-wallet";

/**
 * Creates a function to retrieve the wallet state for a given list of clients.
 * @param repository
 * @param pool
 */
export const createRetrieveOutput = ({
  repository,
  pool,
}: {
  repository: Repository;
  pool: Pool;
}) => {
  const retrieveOutput = async ({ clients }: { clients: Set<number> }) => {
    const outputs = [];

    for (const client of clients) {
      const output = await retrieveWallet({
        repository,
        pool,
        client,
      });

      outputs.push(output);
    }

    return outputs;
  };

  return {
    printOutput: async ({ clients }: { clients: Set<number> }) => {
      const outputs = await retrieveOutput({ clients });

      // Format and output as CSV
      const formatAmount = (amount: number) => {
        return (amount / 10000).toFixed(4).replace(/\.?0+$/, "");
      };

      console.log("client, available, held, total, locked");
      outputs.forEach((wallet) => {
        const available = formatAmount(wallet.available);
        const held = formatAmount(wallet.held);
        const total = formatAmount(wallet.total);
        console.log(
          `${wallet.client}, ${available}, ${held}, ${total}, ${wallet.locked}`
        );
      });
    },
  };
};
