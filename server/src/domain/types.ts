export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  DISPUTE = "dispute",
  RESOLVE = "resole",
}

export interface Transaction {
  type: TransactionType,
  client: number,
  tx: number,
}

export interface Deposit extends Transaction {
  amount: number
}

export interface Withdrawal extends Transaction {
  amount: number
}

export interface Dispute extends Transaction {}
export interface Resolve extends Transaction {}
export interface Chargeback extends Transaction {}
