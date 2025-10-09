#!/usr/bin/env ./node_modules/.bin/ts-node
import "dotenv/config";
import fs from "fs";
import path from "path";
import db from "./database.config";
import { PoolClient } from "pg";

const MIGRATION_DIR = path.join(__dirname, "migrations");

enum MigrationActionType {
  RUN = "run",
  UNDO = "undo",
  SHOW = "show",
}
interface MigrationRecord {
  id: number;
  name: string;
  run_on: Date;
}

async function ensureMigrationsTable(client: PoolClient) {
  await db.runQuery(
    client,
    `
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      run_on TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `
  );
}

const getAppliedMigrations = async (client: PoolClient): Promise<string[]> => {
  const res = await db.runQuery(
    client,
    "SELECT name FROM _migrations ORDER BY id"
  );
  return res.rows.map((r) => r.name);
};

const recordMigration = async (client: PoolClient, name: string) => {
  await db.runQuery(client, "INSERT INTO _migrations (name) VALUES ($1)", [
    name,
  ]);
};

const deleteMigrationRecord = async (client: PoolClient, name: string) => {
  await db.runQuery(client, "DELETE FROM _migrations WHERE name=$1", [name]);
};

export const runMigrations = async (action: MigrationActionType) => {
  let client: PoolClient | null = null;
  try {
    client = await db.pool.connect();
    await client.query("BEGIN");
    await ensureMigrationsTable(client);
    const files = fs
      .readdirSync(MIGRATION_DIR)
      .filter((file) => file.endsWith(".migration.ts"));

    const applied = await getAppliedMigrations(client);

    if (action === MigrationActionType.SHOW) {
      console.log("\n=== Migration Status ===");
      for (const f of files) {
        const status = applied.includes(f) ? "✔" : " ";
        console.log(`[${status}]`, f);
      }
      console.log("=========================\n");
      return;
    }

    const migrations = files
      .filter((file) =>
        action === MigrationActionType.RUN
          ? !applied.includes(file)
          : applied.includes(file)
      )
      .map((file) => {
        const migration = require(path.join(MIGRATION_DIR, file));
        const className = Object.keys(migration)[0];
        return {
          run: new migration[className](),
          name: file,
        };
      });

    if (action === MigrationActionType.UNDO && migrations.length > 0) {
      const migration = migrations[migrations.length - 1];

      await migration.run.down(client);
      await deleteMigrationRecord(client, migration.name);
      console.log("[ ]", migration.name);
    } else if (action === MigrationActionType.RUN && migrations.length > 0) {
      for (const migration of migrations) {
        await migration.run.up(client);
        await recordMigration(client, migration.name);
        console.log("[✔]", migration.name);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    console.error("Migration error:", error);
    if (client) await client.query("ROLLBACK");
    throw error;
  } finally {
    client?.release();
  }
};

const migrationActionType = (process.argv[2] ??
  MigrationActionType.RUN) as MigrationActionType;

if (
  !migrationActionType ||
  !Object.values(MigrationActionType).includes(migrationActionType)
) {
  if (["help", "--help", "-h"].includes(migrationActionType)) {
    console.log("Available migration actions:");
    console.log("  create - Apply all pending migrations.");
    console.log("  undo   - Revert the last applied migration.");
    console.log("  show   - Display migration status.");
    process.exit(0);
  }
  console.error(
    `Please specify migration type: ${Object.values(MigrationActionType).join(
      ", "
    )}`
  );
  process.exit(1);
}
runMigrations(migrationActionType)
  .then(() => {
    console.log("Migrations completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
