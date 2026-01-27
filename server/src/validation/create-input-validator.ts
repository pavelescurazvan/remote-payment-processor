import {
  TransactionType,
  Deposit,
  Withdrawal,
  Dispute,
  Rezolve,
  Chargeback,
} from "../domain/types";

type TransactionRecord = Deposit | Withdrawal | Dispute | Rezolve | Chargeback;

export const createInputValidator = () => {
  return {
    validator: ({ record }: { record: any }): TransactionRecord => {
      const type = record.type?.trim().toLowerCase();
      const client = parseInt(record.client.toString(), 10);
      const tx = parseInt(record.tx.toString(), 10);

      if (!type) {
        throw new Error("Missing transaction type");
      }

      if (isNaN(client)) {
        throw new Error(`Invalid client ID: ${record.client}`);
      }

      if (isNaN(tx)) {
        throw new Error(`Invalid transaction ID: ${record.tx}`);
      }

      switch (type) {
        case TransactionType.DEPOSIT: {
          const amount = parseFloat(record.amount);
          if (isNaN(amount)) {
            throw new Error(`Invalid amount for deposit: ${record.amount}`);
          }
          return {
            type: TransactionType.DEPOSIT,
            client,
            tx,
            amount,
          } as Deposit;
        }

        case TransactionType.WITHDRAWAL: {
          const amount = parseFloat(record.amount);
          if (isNaN(amount)) {
            throw new Error(`Invalid amount for withdrawal: ${record.amount}`);
          }
          return {
            type: TransactionType.WITHDRAWAL,
            client,
            tx,
            amount,
          } as Withdrawal;
        }

        case TransactionType.DISPUTE:
          return {
            type: TransactionType.DISPUTE,
            client,
            tx,
          } as Dispute;

        case TransactionType.REZOLVE:
          return {
            type: TransactionType.REZOLVE,
            client,
            tx,
          } as Rezolve;

        case "chargeback":
          return {
            type: TransactionType.REZOLVE,
            client,
            tx,
          } as Chargeback;

        default:
          throw new Error(`Unknown transaction type: ${type}`);
      }
    },
  };
};
