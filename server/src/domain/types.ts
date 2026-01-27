export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  DISPUTE = "dispute",
  REZOLVE = "resolve",
  CHARGEBACK = "chargeback",
}

export interface Transaction {
  type: TransactionType;
  client: number;
  tx: number;
  amount?: number;
}

export interface TransactionDto extends Transaction {
  version: number;
  available: number;
  held: number;
  total: number;
  locked: boolean;
}
