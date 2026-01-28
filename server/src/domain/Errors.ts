export enum DomainErrorCodes {
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  INVALID_TRANSACTION_TYPE = "INVALID_TRANSACTION_TYPE",
  INVALID_TRANSACTION_PAYLOAD = "INVALID_TRANSACTION_PAYLOAD",
  TRANSACTION_NOT_FOUND = "TRANSACTION_NOT_FOUND",
  INVALID_WALLET_STATE = "INVALID_WALLET_STATE",
  WALLET_LOCKED = "WALLET_LOCKED",
  WALLET_NOT_FOUND = "WALLET_NOT_FOUND",
}

export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly metadata?: Record<string, unknown>;

  protected constructor(
    message: string,
    options?: {
      cause?: unknown;
      metadata?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.metadata = options?.metadata;
  }
}

export class InsufficientFundsError extends DomainError {
  readonly code = DomainErrorCodes.INSUFFICIENT_FUNDS;

  constructor(params: {
    type: string;
    client: number;
    available: number;
    attempted: number;
    tx: number;
  }) {
    super(
      `Insufficient funds: attempted ${params.type} ${params.attempted} from client ${params.client}, available ${params.available}`,
      {
        metadata: params,
      }
    );
  }
}

export class InvalidTransactionType extends DomainError {
  readonly code = DomainErrorCodes.INVALID_TRANSACTION_TYPE;

  constructor(params: { client: number; type: string; tx: number }) {
    super(
      `Invalid transaction type: type ${params.type}, client ${params.client}, tx ${params.tx}`,
      {
        metadata: params,
      }
    );
  }
}

export class InvalidTransactionPayload extends DomainError {
  readonly code = DomainErrorCodes.INVALID_TRANSACTION_PAYLOAD;

  constructor(params: {
    client: number;
    type: string;
    amount?: number | string;
    tx: number;
  }) {
    super(
      `Invalid transaction payload: type ${params.type}, client ${params.client}, tx ${params.tx}, amount ${params.amount}`,
      {
        metadata: params,
      }
    );
  }
}

export class TransactionNotFound extends DomainError {
  readonly code = DomainErrorCodes.TRANSACTION_NOT_FOUND;

  constructor(params: { client: number; tx: number }) {
    super(`Transaction not found: client ${params.client}, tx ${params.tx}`, {
      metadata: params,
    });
  }
}

export class InvalidWalletState extends DomainError {
  readonly code = DomainErrorCodes.INVALID_WALLET_STATE;

  constructor(params: { client: number; tx: number }) {
    super(
      `Cannot process transaction due to invalid state: client ${params.client}, tx ${params.tx}`,
      {
        metadata: params,
      }
    );
  }
}

export class WalletLocked extends DomainError {
  readonly code = DomainErrorCodes.WALLET_LOCKED;

  constructor(params: { client: number; tx: number }) {
    super(
      `Cannot process transaction, wallet is locked: client ${params.client}, tx ${params.tx}`,
      {
        metadata: params,
      }
    );
  }
}

export class WalletNotFound extends DomainError {
  readonly code = DomainErrorCodes.WALLET_NOT_FOUND;

  constructor(params: { client: number }) {
    super(
      `Cannot retrieve wallet, wallet is not found: client ${params.client}`,
      {
        metadata: params,
      }
    );
  }
}
