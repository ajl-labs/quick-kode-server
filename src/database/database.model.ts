import { PoolClient, QueryResult, QueryResultRow } from "pg";
import { format, quoteIdent, quoteLiteral } from "node-pg-format";
import { Context } from "hono";
import {
  buildWhereClause,
  decodeCursor,
  encodeCursor,
} from "../helpers/query.helpers";

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
    params?: any[],
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
      values.map((v) => quoteLiteral(v)).join(", "),
    );

    const result = await this.runQuery(query);
    return result.rows[0];
  };

  findAllVectorSearch = async <T>(
    table: string,
    options: {
      limit: number;
      cursor?: string;
      searchText?: string;
    },
  ) => {
    let cursorCreatedAt = null;
    let cursorId = null;

    if (options.cursor) {
      ({ created_at: cursorCreatedAt, id: cursorId } = decodeCursor(
        options.cursor,
      ));
    }
    let searchQuery = "";
    if (options.searchText) {
      searchQuery = "AND t.search_vector @@ plainto_tsquery('english', %L)";
      // for transaction ensure that phone number is well captured
      if (table == "transactions") {
        searchQuery =
          "AND (t.search_vector @@ plainto_tsquery('english', %L) OR t.phone_number ILIKE %L)";
      }
      searchQuery = format(
        searchQuery,
        options.searchText,
        `%${options.searchText}%`,
      );
    }

    const query = format(
      `
        WITH cursor AS (
          SELECT
            %L::timestamptz AS cur_created_at,
            %L::uuid AS cur_id
        )
        SELECT t.*
        FROM %I AS t, cursor c
        WHERE
          (%L IS NULL OR (t.created_at, t.id) < (c.cur_created_at, c.cur_id))
          ${searchQuery}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT %L;
      `,
      cursorCreatedAt,
      cursorId,
      table,
      options.cursor, // for (%L IS NULL)
      options.limit,
    );

    const result = await this.runQuery(query);
    let nextCursor: string | null = null;
    if (result.rows.length === options.limit) {
      const lastItem = result.rows[result.rows.length - 1];
      nextCursor = encodeCursor({
        id: lastItem.id,
        created_at: lastItem.created_at,
      });
    }

    return {
      data: result.rows as IDatabaseRecord<T>[],
      currentCursor: options.cursor,
      nextCursor,
    };
  };

  findById = async <T>(table: string, id: string) => {
    const query = format("SELECT * FROM %I WHERE id = %L", table, id);
    const result = await this.runQuery(query);
    return result.rows[0] as IDatabaseRecord<T> | null;
  };

  findOneBy = async <T>(table: string, column: string, value: any) => {
    const query = format(
      "SELECT * FROM %I WHERE %I = %L",
      table,
      column,
      value,
    );
    console.log(query);
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
      id,
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
    orderBy: "created_at" | "updated_at" | "completed_at" = "created_at",
  ) => {
    const query = format(
      "SELECT * FROM %I ORDER BY %I DESC LIMIT 1",
      table,
      orderBy,
    );
    const result = await this.runQuery(query);
    return result.rows[0];
  };
}
