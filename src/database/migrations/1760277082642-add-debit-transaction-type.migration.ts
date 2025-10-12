import { PoolClient } from "pg";
import db from "../database.config";

export class AddDebuitTransactionType1760277082642 {
  public async up(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
        ALTER TABLE transactions
        ADD COLUMN transaction_category VARCHAR(255) DEFAULT 'other',
        ADD COLUMN payment_code VARCHAR(255),
        ADD COLUMN transaction_reference VARCHAR(255),
        ADD COLUMN label VARCHAR(255);
    `
    );
  }

  public async down(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
        ALTER TABLE transactions
        DROP COLUMN IF EXISTS transaction_category,
        DROP COLUMN IF EXISTS payment_code,
        DROP COLUMN IF EXISTS transaction_reference,
        DROP COLUMN IF EXISTS label;
    `
    );
  }
}
