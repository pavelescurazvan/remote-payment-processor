import { TransactionType, Transaction } from "../domain/types";

export const createInputValidator = () => {
  /**
   * Parse monetary input into a fixed-point integer (scale = 10^4).
   * Trims whitespace, accepts decimals, truncates beyond 4 places.
   * @param input
   */
  const parseAmountScaled = (input: any): number => {
    const raw = String(input ?? "").trim();
    if (!raw) {throw new Error("Missing amount");}

    const m = raw.match(/^(\d+)(?:\.(\d+))?$/);
    if (!m) {throw new Error(`Invalid amount format: ${input}`);}

    const intPart = m[1];
    const fracPart = (m[2] ?? "").slice(0, 4).padEnd(4, "0");

    const scaled = Number(intPart + fracPart);
    if (!Number.isSafeInteger(scaled) || scaled <= 0) {
      throw new Error(`Invalid amount: ${input}`);
    }

    return scaled;
  };

  return {
    validator: ({ record }: { record: any }): Transaction => {
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
          const scaledAmount = parseAmountScaled(record.amount);
          return {
            type: TransactionType.DEPOSIT,
            client,
            tx,
            amount: scaledAmount,
          } as Transaction;
        }

        case TransactionType.WITHDRAWAL: {
          const scaledAmount = parseAmountScaled(record.amount);
          return {
            type: TransactionType.WITHDRAWAL,
            client,
            tx,
            amount: scaledAmount,
          } as Transaction;
        }

        case TransactionType.DISPUTE:
          return {
            type: TransactionType.DISPUTE,
            client,
            tx,
            amount: 0,
          } as Transaction;

        case TransactionType.REZOLVE:
          return {
            type: TransactionType.REZOLVE,
            client,
            tx,
            amount: 0,
          } as Transaction;

        case TransactionType.CHARGEBACK:
          return {
            type: TransactionType.CHARGEBACK,
            client,
            tx,
            amount: 0,
          } as Transaction;

        default:
          throw new Error(`Unknown transaction type: ${type}`);
      }
    },
  };
};
