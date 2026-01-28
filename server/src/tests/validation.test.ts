import { Pool } from "pg";
import { createPostgresRepository } from "../repository/create-postgres-repository";
import { createTransactionsProcessor } from "../domain/create-transactions-processor";
import { Transaction, TransactionType } from "../domain/types";

describe("Transaction Validation Tests", () => {
  let pool: Pool;
  let processor: ReturnType<typeof createTransactionsProcessor>;

  beforeAll(() => {
    pool = new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: parseInt(process.env.DB_PORT ?? "5432", 10),
      user: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "postgres",
      database: process.env.DB_NAME ?? "pay_pro",
    });

    processor = createTransactionsProcessor({
      repository: createPostgresRepository(),
      pool,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE pay_pro.event_store");
  });

  async function* toAsyncIterable<T>(items: T[]): AsyncIterable<T> {
    for (const item of items) {
      yield item;
    }
  }

  describe("Dispute Validation", () => {
    it("should only allow disputes on deposits", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 1, tx: 100, amount: 1000000 },
        {
          type: TransactionType.WITHDRAWAL,
          client: 1,
          tx: 101,
          amount: 500000,
        },
        { type: TransactionType.DISPUTE, client: 1, tx: 101, amount: 0 }, // Try to dispute withdrawal
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      // Should have deposit and withdrawal, but dispute should fail
      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 1 ORDER BY version"
      );

      expect(result.rows).toHaveLength(2); // Only deposit and withdrawal
      expect(result.rows[0].type).toBe("deposit");
      expect(result.rows[1].type).toBe("withdrawal");
      // No dispute record should exist
    });

    it("should allow disputes on deposits", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 2, tx: 200, amount: 1000000 },
        { type: TransactionType.DISPUTE, client: 2, tx: 200, amount: 0 }, // Dispute deposit
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 2 ORDER BY version"
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].type).toBe("deposit");
      expect(result.rows[1].type).toBe("dispute");
    });
  });

  describe("Resolve Validation", () => {
    it("should not allow resolve without prior dispute", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 3, tx: 300, amount: 1000000 },
        { type: TransactionType.REZOLVE, client: 3, tx: 300, amount: 0 }, // Resolve without dispute
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      // Should only have deposit, resolve should fail
      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 3 ORDER BY version"
      );

      expect(result.rows).toHaveLength(1); // Only deposit
      expect(result.rows[0].type).toBe("deposit");
    });

    it("should allow resolve after dispute", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 4, tx: 400, amount: 1000000 },
        { type: TransactionType.DISPUTE, client: 4, tx: 400, amount: 0 },
        { type: TransactionType.REZOLVE, client: 4, tx: 400, amount: 0 },
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 4 ORDER BY version"
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].type).toBe("deposit");
      expect(result.rows[1].type).toBe("dispute");
      expect(result.rows[2].type).toBe("resolve");
    });
  });

  describe("Chargeback Validation", () => {
    it("should not allow chargeback without prior dispute", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 5, tx: 500, amount: 1000000 },
        { type: TransactionType.CHARGEBACK, client: 5, tx: 500, amount: 0 }, // Chargeback without dispute
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      // Should only have deposit, chargeback should fail
      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 5 ORDER BY version"
      );

      expect(result.rows).toHaveLength(1); // Only deposit
      expect(result.rows[0].type).toBe("deposit");
    });

    it("should allow chargeback after dispute", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 6, tx: 600, amount: 1000000 },
        { type: TransactionType.DISPUTE, client: 6, tx: 600, amount: 0 },
        { type: TransactionType.CHARGEBACK, client: 6, tx: 600, amount: 0 },
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 6 ORDER BY version"
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].type).toBe("deposit");
      expect(result.rows[1].type).toBe("dispute");
      expect(result.rows[2].type).toBe("chargeback");
      expect(result.rows[2].locked).toBe(true); // Account should be locked
    });
  });

  describe("Combined Scenarios", () => {
    it("should handle multiple disputes and resolves correctly", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 7, tx: 700, amount: 1000000 },
        { type: TransactionType.DEPOSIT, client: 7, tx: 701, amount: 500000 },
        { type: TransactionType.DISPUTE, client: 7, tx: 700, amount: 0 },
        { type: TransactionType.DISPUTE, client: 7, tx: 701, amount: 0 },
        { type: TransactionType.REZOLVE, client: 7, tx: 700, amount: 0 },
        { type: TransactionType.CHARGEBACK, client: 7, tx: 701, amount: 0 },
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 7 ORDER BY version"
      );

      expect(result.rows).toHaveLength(6);
      expect(result.rows[0].type).toBe("deposit");
      expect(result.rows[1].type).toBe("deposit");
      expect(result.rows[2].type).toBe("dispute");
      expect(result.rows[3].type).toBe("dispute");
      expect(result.rows[4].type).toBe("resolve");
      expect(result.rows[5].type).toBe("chargeback");
    });
  });
});
