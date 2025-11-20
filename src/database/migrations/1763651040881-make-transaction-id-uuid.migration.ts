import { PoolClient } from "pg";
import db from "../database.config";

export class MakeTransactionIdUUID1763651040881 {
  public async up(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
      -- Ensure all current IDs are valid UUIDs
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM transactions
          WHERE id !~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        ) THEN
          RAISE EXCEPTION 'Cannot convert id column to UUID: invalid value found';
        END IF;
      END$$;

      ALTER TABLE transactions
      ALTER COLUMN id TYPE UUID USING id::uuid;

      -- Set default to generate real UUIDs for new rows
      ALTER TABLE transactions
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
      `,
    );
  }

  public async down(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
      ALTER TABLE transactions
      ALTER COLUMN id TYPE VARCHAR(36) USING id::VARCHAR(36);
      `,
    );
  }
}
