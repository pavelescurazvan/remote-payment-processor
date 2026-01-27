export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly cause?: unknown;
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
    this.cause = options?.cause;
    this.metadata = options?.metadata;
  }
}

export class InsufficientFundsError extends DomainError {
  readonly code = "INSUFFICIENT_FUNDS";

  constructor(params: {
    client: number;
    available: number;
    attempted: number;
    tx: number;
  }) {
    super(
      `Insufficient funds: attempted ${params.attempted}, available ${params.available}`,
      {
        metadata: params,
      }
    );
  }
}

export class InvalidTransaction extends DomainError {
  readonly code = "INVALID_TRANSACTION";

  constructor(params: {
    client: number;
    type: string;
    amount: number;
    tx: number;
  }) {
    super(
      `Invalid transaction: type ${params.type}, amount ${params.amount}`,
      {
        metadata: params,
      }
    );
  }
}
