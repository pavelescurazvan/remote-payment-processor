import { Pool } from "pg";
import { createPostgresRepository } from "../repository/create-postgres-repository";
import { TransactionType, TransactionDto } from "../domain/types";

describe("Concurrency Control Tests", () => {
  let pool: Pool;
  let repository: ReturnType<typeof createPostgresRepository>;

  beforeAll(() => {
    pool = new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: parseInt(process.env.DB_PORT ?? "5432", 10),
      user: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "postgres",
      database: process.env.DB_NAME ?? "pay_pro",
    });

    repository = createPostgresRepository();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await pool.query("TRUNCATE TABLE pay_pro.event_store");
  });

  describe("Version Uniqueness Constraint", () => {
    it("should prevent duplicate versions for the same client", async () => {
      const transaction1: TransactionDto = {
        type: TransactionType.DEPOSIT,
        client: 1,
        tx: 100,
        amount: 1000000,
        version: 1,
        available: 1000000,
        held: 0,
        total: 1000000,
        locked: false,
      };

      const transaction2: TransactionDto = {
        type: TransactionType.DEPOSIT,
        client: 1,
        tx: 101,
        amount: 500000,
        version: 1, // Same version as transaction1
        available: 1500000,
        held: 0,
        total: 1500000,
        locked: false,
      };

      // First insert should succeed
      await repository.transactions.append(pool, transaction1);

      // Second insert with same (client, version) should fail
      await expect(
        repository.transactions.append(pool, transaction2)
      ).rejects.toThrow();
    });

    it("should allow same version for different clients", async () => {
      const transaction1: TransactionDto = {
        type: TransactionType.DEPOSIT,
        client: 1,
        tx: 100,
        amount: 1000000,
        version: 1,
        available: 1000000,
        held: 0,
        total: 1000000,
        locked: false,
      };

      const transaction2: TransactionDto = {
        type: TransactionType.DEPOSIT,
        client: 2, // Different client
        tx: 101,
        amount: 500000,
        version: 1, // Same version is OK for different client
        available: 500000,
        held: 0,
        total: 500000,
        locked: false,
      };

      // Both inserts should succeed
      await repository.transactions.append(pool, transaction1);
      await repository.transactions.append(pool, transaction2);

      // Verify both were inserted
      const result = await pool.query(
        "SELECT COUNT(*) as count FROM pay_pro.event_store"
      );
      expect(parseInt(result.rows[0].count)).toBe(2);
    });
  });

  describe("Transaction Idempotency Constraint", () => {
    it("should prevent duplicate (client, tx, type) combinations", async () => {
      const transaction1: TransactionDto = {
        type: TransactionType.DEPOSIT,
        client: 1,
        tx: 100,
        amount: 1000000,
        version: 1,
        available: 1000000,
        held: 0,
        total: 1000000,
        locked: false,
      };

      const transaction2: TransactionDto = {
        type: TransactionType.DEPOSIT, // Same type
        client: 1, // Same client
        tx: 100, // Same tx
        amount: 500000,
        version: 2,
        available: 1500000,
        held: 0,
        total: 1500000,
        locked: false,
      };

      // First insert should succeed
      await repository.transactions.append(pool, transaction1);

      // Second insert with same (client, tx, type) should fail
      await expect(
        repository.transactions.append(pool, transaction2)
      ).rejects.toThrow();
    });

    it("should allow same (client, tx) with different types", async () => {
      const deposit: TransactionDto = {
        type: TransactionType.DEPOSIT,
        client: 1,
        tx: 100,
        amount: 1000000,
        version: 1,
        available: 1000000,
        held: 0,
        total: 1000000,
        locked: false,
      };

      const dispute: TransactionDto = {
        type: TransactionType.DISPUTE, // Different type
        client: 1,
        tx: 100, // Same tx - disputing the deposit
        amount: 1000000,
        version: 2,
        available: 0,
        held: 1000000,
        total: 1000000,
        locked: false,
      };

      // Both should succeed - different types allowed
      await repository.transactions.append(pool, deposit);
      await repository.transactions.append(pool, dispute);

      // Verify both were inserted
      const result = await pool.query(
        "SELECT COUNT(*) as count FROM pay_pro.event_store WHERE client = 1 AND tx = 100"
      );
      expect(parseInt(result.rows[0].count)).toBe(2);
    });
  });

  describe("Concurrent Write Simulation", () => {
    it("should handle race condition with version constraint", async () => {
      // Simulate two concurrent processes trying to write version 1
      const transaction1: TransactionDto = {
        type: TransactionType.DEPOSIT,
        client: 1,
        tx: 100,
        amount: 1000000,
        version: 1,
        available: 1000000,
        held: 0,
        total: 1000000,
        locked: false,
      };

      const transaction2: TransactionDto = {
        type: TransactionType.DEPOSIT,
        client: 1,
        tx: 101,
        amount: 500000,
        version: 1, // Race: both think they're writing version 1
        available: 500000,
        held: 0,
        total: 500000,
        locked: false,
      };

      // Execute both "concurrently" (Promise.allSettled handles both success and failure)
      const results = await Promise.allSettled([
        repository.transactions.append(pool, transaction1),
        repository.transactions.append(pool, transaction2),
      ]);

      // One should succeed, one should fail
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failureCount = results.filter((r) => r.status === "rejected").length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify only one transaction was inserted
      const result = await pool.query(
        "SELECT COUNT(*) as count FROM pay_pro.event_store WHERE client = 1"
      );
      expect(parseInt(result.rows[0].count)).toBe(1);
    });

    it("should maintain version monotonicity under concurrent load", async () => {
      // Insert initial transaction
      const initial: TransactionDto = {
        type: TransactionType.DEPOSIT,
        client: 1,
        tx: 1,
        amount: 1000000,
        version: 1,
        available: 1000000,
        held: 0,
        total: 1000000,
        locked: false,
      };
      await repository.transactions.append(pool, initial);

      // Try to insert multiple transactions with conflicting versions
      const conflictingTransactions = Array.from({ length: 5 }, (_, i) => ({
        type: TransactionType.DEPOSIT,
        client: 1,
        tx: 100 + i,
        amount: 100000,
        version: 2, // All trying to write version 2
        available: 1100000,
        held: 0,
        total: 1100000,
        locked: false,
      }));

      const results = await Promise.allSettled(
        conflictingTransactions.map((t) =>
          repository.transactions.append(pool, t)
        )
      );

      // Only one should succeed
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      expect(successCount).toBe(1);

      // Verify version sequence is maintained
      const versions = await pool.query(
        "SELECT version FROM pay_pro.event_store WHERE client = 1 ORDER BY version"
      );
      expect(versions.rows.map((r) => Number(r.version))).toEqual([1, 2]);
    });
  });
});
