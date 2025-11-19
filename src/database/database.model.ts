import { PoolClient, QueryResult, QueryResultRow } from "pg";
import { format, quoteIdent, quoteLiteral } from "node-pg-format";
import { Context } from "hono";

export class DatabaseModel {
  context?: Context;
  format = format;
  quoteIdent = quoteIdent;
  quoteLiteral = quoteLiteral;
  constructor(context?: Context) {
    this.context = context;
  }

  runQuery = async <T extends QueryResultRow>(
    queryText: string,
    params?: any[]
  ) => {
    const client = this.context?.get("db") as PoolClient;
    try {
      const results = await client.query(queryText, params);
      return results as QueryResult<T>;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  };

  createRecord = async <T>(table: string, data: Record<string, any>) => {
    const payload = { ...data, created_at: new Date(), updated_at: new Date() };
    const keys = Object.keys(payload);
    const values = Object.values(payload);

    const query = format(
      "INSERT INTO %I (%s) VALUES (%s) RETURNING *",
      table,
      keys.map((k) => quoteIdent(k)).join(", "),
      values.map((v) => quoteLiteral(v)).join(", ")
    );

    const result = await this.runQuery(query);
    return result.rows[0];
  };

  findAll = async <T>(
    table: string,
    options: { limit: number; offset: number }
  ) => {
    const query = format(
      "SELECT * FROM %I ORDER BY created_at DESC LIMIT %L OFFSET %L;",
      table,
      options.limit,
      options.offset
    );
    const result = await this.runQuery(query);
    return {
      data: result.rows as IDatabaseRecord<T>[],
      total: result.rowCount ?? 0,
    };
  };

  findById = async <T>(table: string, id: string) => {
    const query = format("SELECT * FROM %I WHERE id = %L", table, id);
    const result = await this.runQuery(query);
    return result.rows[0] as IDatabaseRecord<T> | null;
  };

  updateRecord = async <T>(table: string, id: string, data: Partial<T>) => {
    const setClause = Object.entries(data)
      .map(([key, value]) => `${quoteIdent(key)} = ${quoteLiteral(value)}`)
      .join(", ");
    const query = format(
      "UPDATE %I SET %s WHERE id = %L RETURNING *",
      table,
      setClause,
      id
    );
    const result = await this.runQuery(query);
    return result.rows[0] as IDatabaseRecord<T> | null;
  };

  deleteRecord = async (table: string, id: string): Promise<boolean> => {
    const query = format("DELETE FROM %I WHERE id = %L RETURNING *", table, id);
    const result = await this.runQuery(query);
    return Boolean(result.rowCount);
  };

  countRecords = async (table: string) => {
    const query = format("SELECT COUNT(*) FROM %I", table);
    const result = await this.runQuery<{ count: string }>(query);
    return parseInt(result.rows[0]?.count || "0", 10);
  };

  sumColumn = async (table: string, column: string) => {
    const query = format("SELECT SUM(%I) FROM %I", column, table);
    const result = await this.runQuery<{ sum: string | null }>(query);
    return parseFloat(result.rows[0]?.sum || "0");
  };

  getLastRecord = async <T>(
    table: string,
    orderBy: "created_at" | "updated_at" | "completed_at" = "created_at"
  ) => {
    const query = format(
      "SELECT * FROM %I ORDER BY %I DESC LIMIT 1",
      table,
      orderBy
    );
    const result = await this.runQuery(query);
    return result.rows[0];
  };
}
