import { PoolClient } from "pg";
import db from "../database.config";

export class AddSummaryColumn1760290888431 {
  public async up(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
        ALTER TABLE transactions
        ADD COLUMN summary VARCHAR(255);
    `
    );
  }

  public async down(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
        ALTER TABLE transactions
        DROP COLUMN IF EXISTS summary;
    `
    );
  }
}
