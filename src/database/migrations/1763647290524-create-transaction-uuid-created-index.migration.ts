import { PoolClient } from "pg";
import db from "../database.config";

export class CreateTransactionUuidCreatedIndex1763647290524 {
  public async up(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at_id
      ON transactions (created_at DESC, id DESC);
      `,
    );
  }

  public async down(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `DROP INDEX IF EXISTS idx_transactions_created_at_id;`,
    );
  }
}
