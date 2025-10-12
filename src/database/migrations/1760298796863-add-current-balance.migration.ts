import { PoolClient } from "pg";
import db from "../database.config";

export class AddCurrentBalanceColumn1760298796863 {
  public async up(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
      ALTER TABLE transactions
      ADD COLUMN remaining_balance FLOAT;
      ALTER TABLE transactions
      ALTER COLUMN amount TYPE FLOAT USING amount::FLOAT;
      ALTER TABLE transactions
      ALTER COLUMN fees TYPE FLOAT USING fees::FLOAT;
    `
    );
  }

  public async down(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
        ALTER TABLE transactions
        DROP COLUMN IF EXISTS remaining_balance;
        ALTER TABLE transactions
        ALTER COLUMN amount TYPE NUMERIC USING amount::NUMERIC;
        ALTER TABLE transactions
        ALTER COLUMN fees TYPE NUMERIC USING fees::NUMERIC;
    `
    );
  }
}
