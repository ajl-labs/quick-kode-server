import { PoolClient } from 'pg';
import db from '../database.config';

export class CreateTransactionsTable1680000000000 {
  public async up(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
        CREATE TABLE transactions (
            id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
            amount NUMERIC(12, 2) NOT NULL,
            fees NUMERIC(12, 2) DEFAULT 0,
            type VARCHAR(6) NOT NULL CHECK (type IN ('DEBIT', 'CREDIT')),
            message TEXT,
            recipient VARCHAR(36),
            sender VARCHAR(36),
            phone_number VARCHAR(15),
            completed_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX idx_transactions_phone_number ON transactions(phone_number);
    `,
    );
  }

  public async down(client: PoolClient): Promise<void> {
    await db.runQuery(
      client,
      `
            DROP INDEX IF EXISTS idx_transactions_phone_number;
            DROP TABLE IF EXISTS transactions;
    `,
    );
  }
}
