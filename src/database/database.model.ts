import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { format, quoteIdent, quoteLiteral } from 'node-pg-format';
import { Context } from 'hono';

export class DatabaseModel {
  context?: Context;
  constructor(context?: Context) {
    this.context = context;
  }
  private runQuery = async <T extends QueryResultRow>(
    queryText: string,
    params?: any[],
  ) => {
    const client = this.context?.get('db') as PoolClient;
    try {
      const results = await client.query(queryText, params);
      return results as QueryResult<T>;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  };

  createRecord = async <T>(table: string, data: Record<string, any>) => {
    const payload = { ...data, created_at: new Date(), updated_at: new Date() };
    const keys = Object.keys(payload);
    const values = Object.values(payload);

    const query = format(
      'INSERT INTO %I (%s) VALUES (%s) RETURNING *',
      table,
      keys.map(k => quoteIdent(k)).join(', '),
      values.map(v => quoteLiteral(v)).join(', '),
    );

    const result = await this.runQuery(query);
    return result.rows[0];
  };

  findAll = async <T>(
    table: string,
    options: { limit: number; offset: number },
  ) => {
    const query = format(
      'SELECT * FROM %I ORDER BY created_at DESC LIMIT %L OFFSET %L;',
      table,
      options.limit,
      options.offset,
    );
    const result = await this.runQuery(query);
    return {
      data: result.rows as IDatabaseRecord<T>[],
      total: result.rowCount ?? 0,
    };
  };

  findById = async <T>(table: string, id: string) => {
    const query = format('SELECT * FROM %I WHERE id = %L', table, id);
    const result = await this.runQuery(query);
    return result.rows[0] as IDatabaseRecord<T> | null;
  };

  update = async () => {};
  softDelete = async () => {};
}
