import { PoolClient } from "pg";
import db from "../database.config";

export class AddTransactionsFullTextSearch1763651896002 {
  public async up(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
      -- Add a generated tsvector column for full-text search
      ALTER TABLE transactions
      ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(recipient, '')), 'A') ||  -- highest
        setweight(to_tsvector('english', coalesce(phone_number, '')), 'A') || -- also highest
        setweight(to_tsvector('english', coalesce(sender, '')), 'B') ||       -- middle
        setweight(to_tsvector('english', coalesce(label, '')), 'C') ||        -- low
        setweight(to_tsvector('english', coalesce(transaction_reference, '')), 'D') -- lowest
      ) STORED;

      -- Create a GIN index on the tsvector column
      CREATE INDEX idx_transactions_search_vector
      ON transactions USING GIN(search_vector);
      `,
    );
  }

  public async down(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
      -- Drop the index
      DROP INDEX IF EXISTS idx_transactions_search_vector;

      -- Drop the generated tsvector column
      ALTER TABLE transactions
      DROP COLUMN IF EXISTS search_vector;
      `,
    );
  }
}
