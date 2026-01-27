import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import { createInputValidator } from "../utils/create-input-validator";
import { createTransactionsProcessor } from "../domain/create-transactions-processor";
import { createPostgresRepository } from "../repository/create-postgres-repository";
import { Transaction, TransactionType } from "../domain/types";
import { parse } from "csv-parse";

describe("Payment Processor Integration Tests", () => {
  let pool: Pool;
  let validator: ReturnType<typeof createInputValidator>["validator"];
  let processor: ReturnType<typeof createTransactionsProcessor>;

  beforeAll(() => {
    pool = new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: parseInt(process.env.DB_PORT ?? "5432", 10),
      user: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "postgres",
      database: process.env.DB_NAME ?? "pay_pro",
    });

    const { validator: validatorFn } = createInputValidator();
    validator = validatorFn;

    processor = createTransactionsProcessor({
      repository: createPostgresRepository(),
      pool,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await pool.query("TRUNCATE TABLE pay_pro.event_store");
  });

  describe("Happy Path Scenarios", () => {
    it("should process deposits correctly", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 1, tx: 1, amount: 1000000 },
        { type: TransactionType.DEPOSIT, client: 1, tx: 2, amount: 500000 },
      ];

      await processor.process({ transactions });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = $1 ORDER BY tx",
        [1]
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].type).toBe("deposit");
      expect(Number(result.rows[0].amount)).toBe(1000000);
      expect(Number(result.rows[1].amount)).toBe(500000);
    });

    it("should process withdrawals correctly", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 2, tx: 10, amount: 1000000 },
        { type: TransactionType.WITHDRAWAL, client: 2, tx: 11, amount: 250000 },
      ];

      await processor.process({ transactions });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = $1 ORDER BY tx",
        [2]
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[1].type).toBe("withdrawal");
      expect(Number(result.rows[1].amount)).toBe(250000);
    });

    it("should process dispute and resolve correctly", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 3, tx: 20, amount: 1000000 },
        { type: TransactionType.DISPUTE, client: 3, tx: 20, amount: 0 },
        { type: TransactionType.REZOLVE, client: 3, tx: 20, amount: 0 },
      ];

      await processor.process({ transactions });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = $1 ORDER BY version",
        [3]
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].type).toBe("deposit");
      expect(result.rows[1].type).toBe("dispute");
      expect(result.rows[2].type).toBe("resolve");
    });

    it("should process dispute and chargeback correctly", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 4, tx: 30, amount: 2000000 },
        { type: TransactionType.DISPUTE, client: 4, tx: 30, amount: 0 },
        { type: TransactionType.CHARGEBACK, client: 4, tx: 30, amount: 0 },
      ];

      await processor.process({ transactions });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = $1 ORDER BY version",
        [4]
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].type).toBe("deposit");
      expect(result.rows[1].type).toBe("dispute");
      expect(result.rows[2].type).toBe("chargeback");
    });

    it("should handle multiple clients simultaneously", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 10, tx: 100, amount: 1000000 },
        { type: TransactionType.DEPOSIT, client: 11, tx: 101, amount: 2000000 },
        { type: TransactionType.DEPOSIT, client: 12, tx: 102, amount: 3000000 },
      ];

      await processor.process({ transactions });

      const result = await pool.query(
        "SELECT DISTINCT client FROM pay_pro.event_store WHERE client IN (10, 11, 12) ORDER BY client"
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows.map((r) => r.client)).toEqual([10, 11, 12]);
    });
  });

  describe("CSV Validation", () => {
    it("should validate deposit transaction with amount", () => {
      const record = { type: "deposit", client: "1", tx: "1", amount: "100.0000" };
      const transaction = validator({ record });

      expect(transaction.type).toBe(TransactionType.DEPOSIT);
      expect(transaction.client).toBe(1);
      expect(transaction.tx).toBe(1);
      expect(transaction.amount).toBe(1000000);
    });

    it("should validate withdrawal transaction with amount", () => {
      const record = { type: "withdrawal", client: "2", tx: "2", amount: "50.5000" };
      const transaction = validator({ record });

      expect(transaction.type).toBe(TransactionType.WITHDRAWAL);
      expect(transaction.client).toBe(2);
      expect(transaction.tx).toBe(2);
      expect(transaction.amount).toBe(505000);
    });

    it("should validate dispute transaction without amount", () => {
      const record = { type: "dispute", client: "3", tx: "3" };
      const transaction = validator({ record });

      expect(transaction.type).toBe(TransactionType.DISPUTE);
      expect(transaction.client).toBe(3);
      expect(transaction.tx).toBe(3);
      expect(transaction.amount).toBe(0);
    });

    it("should validate resolve transaction without amount", () => {
      const record = { type: "resolve", client: "4", tx: "4" };
      const transaction = validator({ record });

      expect(transaction.type).toBe(TransactionType.REZOLVE);
      expect(transaction.client).toBe(4);
      expect(transaction.tx).toBe(4);
      expect(transaction.amount).toBe(0);
    });

    it("should validate chargeback transaction without amount", () => {
      const record = { type: "chargeback", client: "5", tx: "5" };
      const transaction = validator({ record });

      expect(transaction.type).toBe(TransactionType.CHARGEBACK);
      expect(transaction.client).toBe(5);
      expect(transaction.tx).toBe(5);
      expect(transaction.amount).toBe(0);
    });

    it("should throw error for invalid transaction type", () => {
      const record = { type: "invalid", client: "1", tx: "1" };

      expect(() => validator({ record })).toThrow("Unknown transaction type");
    });

    it("should throw error for missing client", () => {
      const record = { type: "deposit", client: "", tx: "1", amount: "100.0000" };

      expect(() => validator({ record })).toThrow("Invalid client ID");
    });

    it("should throw error for missing transaction id", () => {
      const record = { type: "deposit", client: "1", tx: "", amount: "100.0000" };

      expect(() => validator({ record })).toThrow("Invalid transaction ID");
    });

    it("should throw error for invalid amount format", () => {
      const record = { type: "deposit", client: "1", tx: "1", amount: "abc" };

      expect(() => validator({ record })).toThrow("Invalid amount format");
    });
  });

  describe("Full CSV Processing", () => {
    it("should process the input.csv file", async () => {
      const csvFilePath = path.resolve(__dirname, "../../..", "input.csv");

      if (!fs.existsSync(csvFilePath)) {
        console.warn("input.csv not found, skipping test");
        return;
      }

      const records: Transaction[] = [];
      const parser = fs.createReadStream(csvFilePath).pipe(
        parse({
          columns: true,
          trim: true,
          skip_empty_lines: true,
          relax_column_count: true,
        })
      );

      for await (const record of parser) {
        try {
          const transaction = validator({ record });
          records.push(transaction);
        } catch (error) {
          console.error("Validation error:", (error as Error).message);
        }
      }

      expect(records.length).toBeGreaterThan(0);

      await processor.process({ transactions: records });

      const result = await pool.query(
        "SELECT COUNT(DISTINCT client) as client_count FROM pay_pro.event_store"
      );

      expect(parseInt(result.rows[0].client_count, 10)).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle duplicate transaction IDs (idempotency)", async () => {
      const transactions: Transaction[] = [
        { type: TransactionType.DEPOSIT, client: 50, tx: 500, amount: 1000000 },
        { type: TransactionType.DEPOSIT, client: 50, tx: 500, amount: 1000000 },
      ];

      await processor.process({ transactions });

      const result = await pool.query(
        "SELECT * FROM pay_pro.event_store WHERE client = $1 AND tx = $2",
        [50, 500]
      );

      // Should only have one record due to unique constraint
      expect(result.rows).toHaveLength(1);
    });

    it("should handle amounts with decimal precision", () => {
      const record = { type: "deposit", client: "1", tx: "1", amount: "123.4567" };
      const transaction = validator({ record });

      // 123.4567 should be truncated to 123.4567 (4 decimal places)
      expect(transaction.amount).toBe(1234567);
    });

    it("should handle amounts with fewer decimal places", () => {
      const record = { type: "deposit", client: "1", tx: "1", amount: "100" };
      const transaction = validator({ record });

      expect(transaction.amount).toBe(1000000);
    });
  });
});
