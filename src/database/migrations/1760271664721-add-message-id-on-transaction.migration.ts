import { PoolClient } from "pg";
import db from "../database.config";

export class AddMessageIdOnTransaction1760271664721 {
  public async up(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
        ALTER TABLE transactions
        ADD COLUMN message_id VARCHAR(255),
        ADD COLUMN message_timestamp TIMESTAMPTZ DEFAULT now();  
    `
    );
  }

  public async down(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
        ALTER TABLE transactions
        DROP COLUMN IF EXISTS message_id,
        DROP COLUMN IF EXISTS message_timestamp;
    `
    );
  }
}
