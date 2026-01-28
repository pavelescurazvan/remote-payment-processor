import { Pool } from "pg";
import { createPostgresRepository } from "../repository/create-postgres-repository";
import { createTransactionsProcessor } from "../domain/create-transactions-processor";
import { Transaction, TransactionType } from "../domain/types";

describe("Dispute Flow Integration Tests", () => {
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

  describe("Dispute → Resolve Flow", () => {
    it("should correctly calculate amounts through dispute and resolve", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 1, tx: 1, amount: 1000000 }, // 100.0000
        { type: TransactionType.DEPOSIT, client: 1, tx: 2, amount: 500000 },  // 50.0000
        { type: TransactionType.DISPUTE, client: 1, tx: 1, amount: 0 },       // Dispute first deposit
        { type: TransactionType.REZOLVE, client: 1, tx: 1, amount: 0 },       // Resolve dispute
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT type, available, held, total FROM pay_pro.event_store WHERE client = 1 ORDER BY version"
      );

      // After deposit 100: available=100, held=0, total=100
      expect(Number(result.rows[0].available)).toBe(1000000);
      expect(Number(result.rows[0].held)).toBe(0);
      expect(Number(result.rows[0].total)).toBe(1000000);

      // After deposit 50: available=150, held=0, total=150
      expect(Number(result.rows[1].available)).toBe(1500000);
      expect(Number(result.rows[1].held)).toBe(0);
      expect(Number(result.rows[1].total)).toBe(1500000);

      // After dispute of tx 1: available=50 (150-100), held=100, total=150
      expect(Number(result.rows[2].available)).toBe(500000);
      expect(Number(result.rows[2].held)).toBe(1000000);
      expect(Number(result.rows[2].total)).toBe(1500000);

      // After resolve of tx 1: available=150 (50+100), held=0, total=150
      expect(Number(result.rows[3].available)).toBe(1500000);
      expect(Number(result.rows[3].held)).toBe(0);
      expect(Number(result.rows[3].total)).toBe(1500000);
    });

    it("should handle resolve after multiple transactions", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 2, tx: 10, amount: 1000000 },
        { type: TransactionType.DEPOSIT, client: 2, tx: 11, amount: 500000 },
        { type: TransactionType.WITHDRAWAL, client: 2, tx: 12, amount: 255000 },
        { type: TransactionType.DEPOSIT, client: 2, tx: 13, amount: 102500 },
        { type: TransactionType.DEPOSIT, client: 2, tx: 21, amount: 150000 },
        { type: TransactionType.DISPUTE, client: 2, tx: 21, amount: 0 },
        { type: TransactionType.REZOLVE, client: 2, tx: 21, amount: 0 },
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const lastRow = await pool.query(
        "SELECT available, held, total FROM pay_pro.event_store WHERE client = 2 ORDER BY version DESC LIMIT 1"
      );

      // Final state after resolve: available should be fully restored
      expect(Number(lastRow.rows[0].available)).toBe(1497500); // 100 + 50 - 25.5 + 10.25 + 15
      expect(Number(lastRow.rows[0].held)).toBe(0);
      expect(Number(lastRow.rows[0].total)).toBe(1497500);
    });
  });

  describe("Dispute → Chargeback Flow", () => {
    it("should correctly calculate amounts through dispute and chargeback", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 3, tx: 1, amount: 2000000 }, // 200.0000
        { type: TransactionType.DISPUTE, client: 3, tx: 1, amount: 0 },
        { type: TransactionType.CHARGEBACK, client: 3, tx: 1, amount: 0 },
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT type, available, held, total, locked FROM pay_pro.event_store WHERE client = 3 ORDER BY version"
      );

      // After deposit: available=200, held=0, total=200
      expect(Number(result.rows[0].available)).toBe(2000000);
      expect(Number(result.rows[0].held)).toBe(0);
      expect(Number(result.rows[0].total)).toBe(2000000);
      expect(result.rows[0].locked).toBe(false);

      // After dispute: available=0, held=200, total=200
      expect(Number(result.rows[1].available)).toBe(0);
      expect(Number(result.rows[1].held)).toBe(2000000);
      expect(Number(result.rows[1].total)).toBe(2000000);
      expect(result.rows[1].locked).toBe(false);

      // After chargeback: available=-200 (withdrawn), held=0, total=0, locked=true
      expect(Number(result.rows[2].available)).toBe(-2000000);
      expect(Number(result.rows[2].held)).toBe(0);
      expect(Number(result.rows[2].total)).toBe(0);
      expect(result.rows[2].locked).toBe(true);
    });

    it("should handle chargeback after multiple deposits", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 4, tx: 1, amount: 1000000 },
        { type: TransactionType.DEPOSIT, client: 4, tx: 2, amount: 500000 },
        { type: TransactionType.DEPOSIT, client: 4, tx: 3, amount: 300000 },
        { type: TransactionType.DISPUTE, client: 4, tx: 2, amount: 0 }, // Dispute middle deposit
        { type: TransactionType.CHARGEBACK, client: 4, tx: 2, amount: 0 },
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const lastRow = await pool.query(
        "SELECT available, held, total, locked FROM pay_pro.event_store WHERE client = 4 ORDER BY version DESC LIMIT 1"
      );

      // After chargeback of 50: available=130, held=0, total=130, locked=true
      expect(Number(lastRow.rows[0].available)).toBe(1300000);
      expect(Number(lastRow.rows[0].held)).toBe(0);
      expect(Number(lastRow.rows[0].total)).toBe(1300000);
      expect(lastRow.rows[0].locked).toBe(true);
    });
  });

  describe("Multiple Disputes", () => {
    it("should handle multiple concurrent disputes", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 5, tx: 1, amount: 1000000 },
        { type: TransactionType.DEPOSIT, client: 5, tx: 2, amount: 500000 },
        { type: TransactionType.DEPOSIT, client: 5, tx: 3, amount: 300000 },
        { type: TransactionType.DISPUTE, client: 5, tx: 1, amount: 0 },
        { type: TransactionType.DISPUTE, client: 5, tx: 2, amount: 0 },
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const lastRow = await pool.query(
        "SELECT available, held, total FROM pay_pro.event_store WHERE client = 5 ORDER BY version DESC LIMIT 1"
      );

      // available = 180 - 100 - 50 = 30
      // held = 0 + 100 + 50 = 150
      // total = 180
      expect(Number(lastRow.rows[0].available)).toBe(300000);
      expect(Number(lastRow.rows[0].held)).toBe(1500000);
      expect(Number(lastRow.rows[0].total)).toBe(1800000);
    });

    it("should resolve one dispute while another remains", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 6, tx: 1, amount: 1000000 },
        { type: TransactionType.DEPOSIT, client: 6, tx: 2, amount: 500000 },
        { type: TransactionType.DISPUTE, client: 6, tx: 1, amount: 0 },
        { type: TransactionType.DISPUTE, client: 6, tx: 2, amount: 0 },
        { type: TransactionType.REZOLVE, client: 6, tx: 1, amount: 0 }, // Resolve first
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const lastRow = await pool.query(
        "SELECT available, held, total FROM pay_pro.event_store WHERE client = 6 ORDER BY version DESC LIMIT 1"
      );

      // After resolving tx 1: available = 0 + 100 = 100, held = 50, total = 150
      expect(Number(lastRow.rows[0].available)).toBe(1000000);
      expect(Number(lastRow.rows[0].held)).toBe(500000);
      expect(Number(lastRow.rows[0].total)).toBe(1500000);
    });
  });

  describe("Locked Account Behavior", () => {
    it("should prevent deposits on locked account", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 7, tx: 1, amount: 1000000 },
        { type: TransactionType.DISPUTE, client: 7, tx: 1, amount: 0 },
        { type: TransactionType.CHARGEBACK, client: 7, tx: 1, amount: 0 },
        { type: TransactionType.DEPOSIT, client: 7, tx: 2, amount: 500000 }, // Should fail
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 7 ORDER BY version"
      );

      // Should only have 3 transactions (deposit, dispute, chargeback)
      // The 4th deposit should have failed
      expect(result.rows).toHaveLength(3);
      expect(result.rows[2].type).toBe("chargeback");
      expect(result.rows[2].locked).toBe(true);
    });

    it("should prevent withdrawals on locked account", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 8, tx: 1, amount: 2000000 },
        { type: TransactionType.DISPUTE, client: 8, tx: 1, amount: 0 },
        { type: TransactionType.CHARGEBACK, client: 8, tx: 1, amount: 0 },
        { type: TransactionType.WITHDRAWAL, client: 8, tx: 2, amount: 100000 }, // Should fail
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 8 ORDER BY version"
      );

      // Should only have 3 transactions
      expect(result.rows).toHaveLength(3);
      expect(result.rows[2].locked).toBe(true);
    });

    it("should allow disputes on locked account (edge case)", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 9, tx: 1, amount: 1000000 },
        { type: TransactionType.DEPOSIT, client: 9, tx: 2, amount: 500000 },
        { type: TransactionType.DISPUTE, client: 9, tx: 1, amount: 0 },
        { type: TransactionType.CHARGEBACK, client: 9, tx: 1, amount: 0 }, // Locks account
        { type: TransactionType.DISPUTE, client: 9, tx: 2, amount: 0 }, // Should still work
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 9 ORDER BY version"
      );

      // Should have all 5 transactions - disputes are allowed on locked accounts
      expect(result.rows).toHaveLength(5);
      expect(result.rows[4].type).toBe("dispute");
    });
  });

  describe("Edge Cases", () => {
    it("should handle dispute of already disputed transaction (idempotent)", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 10, tx: 1, amount: 1000000 },
        { type: TransactionType.DISPUTE, client: 10, tx: 1, amount: 0 },
        { type: TransactionType.DISPUTE, client: 10, tx: 1, amount: 0 }, // Duplicate
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 10 ORDER BY version"
      );

      // Should only have 2 transactions (duplicate dispute ignored)
      expect(result.rows).toHaveLength(2);
    });

    it("should handle insufficient available funds for dispute", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 11, tx: 1, amount: 1000000 },
        { type: TransactionType.WITHDRAWAL, client: 11, tx: 2, amount: 900000 },
        { type: TransactionType.DISPUTE, client: 11, tx: 1, amount: 0 }, // Would need 100, only have 10
      ];

      await processor.process({ transactions: toAsyncIterable(transactions) });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = 11 ORDER BY version"
      );

      // Dispute should fail due to insufficient available funds
      expect(result.rows).toHaveLength(2);
    });
  });
});
