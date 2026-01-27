import { PoolClient } from "pg";
import { TransactionDto } from "../domain/types";

/**
 * Creates a Postgres Repository
 */
export const createPostgresRepository = () => {
  return {
    transactions: {
      append: async (pool: PoolClient, transaction: TransactionDto) => {
        const { rows } = (await pool.query(
          `INSERT INTO
            pay_pro.event_store (type, client, version, amount, tx, available, held, total, locked, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id, created_at`,
          [
            transaction.type,
            transaction.client,
            transaction.version,
            transaction.amount,
            transaction.tx,
            transaction.available,
            transaction.held,
            transaction.total,
            transaction.locked,
          ]
        )) as {
          rows: {
            id: number;
            created_at: Date;
          }[];
        };

        if (rows.length === 0) {
          throw new Error("Invalid insert result");
        }

        return {
          id: rows[0].id,
          createdAt: rows[0].created_at,
        };
      },
      readLast: async ({
        pool,
        client,
      }: {
        pool: PoolClient;
        client: number;
      }) => {
        const { rows } = (await pool.query(
          `SELECT
            id, type, client, version, amount, tx, available, held, total, locked
            FROM pay_pro.event_store WHERE client = $1
            ORDER BY version DESC LIMIT 1`,
          [client]
        )) as {
          rows: {
            id: number;
            type: string;
            client: number;
            version: number;
            amount: number;
            tx: number;
            available: number;
            held: number;
            total: number;
            locked: boolean;
          }[];
        };

        if (!rows[0]) {
          return {
            id: 0,
            type: 0,
            client: 0,
            version: 0,
            amount: 0,
            tx: 0,
            available: 0,
            held: 0,
            total: 0,
            locked: false,
          };
        }

        return {
          id: rows[0].id,
          type: Number(rows[0].type),
          client: Number(rows[0].client),
          version: Number(rows[0].version),
          amount: Number(rows[0].amount),
          tx: Number(rows[0].tx),
          available: Number(rows[0].available),
          held: Number(rows[0].held),
          total: Number(rows[0].total),
          locked: rows[0].locked,
        };
      },
      get: async ({
        pool,
        client,
        tx,
      }: {
        pool: PoolClient;
        client: number;
        tx: number;
      }) => {
        const { rows } = (await pool.query(
          `SELECT
             id, type, client, version, amount, tx, available, held, total, locked
             FROM pay_pro.event_store
             WHERE client = $1 and tx = $2
             ORDER BY version DESC LIMIT 1`,
          [client, tx]
        )) as {
          rows: {
            id: number;
            type: string;
            client: number;
            version: number;
            amount: number;
            tx: number;
            available: number;
            held: number;
            total: number;
            locked: number;
          }[];
        };

        if (!rows[0]) {
          return undefined;
        }

        return {
          id: rows[0].id,
          type: Number(rows[0].type),
          client: Number(rows[0].client),
          version: Number(rows[0].version),
          amount: Number(rows[0].amount),
          tx: Number(rows[0].tx),
          available: Number(rows[0].available),
          held: Number(rows[0].held),
          total: Number(rows[0].total),
          locked: Number(rows[0].locked),
        };
      },
    },
  };
};

export type Repository = ReturnType<typeof createPostgresRepository>;
