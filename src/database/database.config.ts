import { Context, Next } from 'hono';
import pg, { Client, PoolClient } from 'pg';
const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default {
  pool,
  runQuery: (client: PoolClient, text: string, params?: any[]) =>
    client.query(text, params),
};
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Hono middleware to manage database connections.
 * It checks out a client from the pool, attaches it to the context,
 * and ensures it's released after the request is handled.
 */
export const dbConnection = async (c: Context, next: Next) => {
  // 1. Borrow a client from the pool
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  console.log('Database client checked out.');

  // 2. Attach the client to the context so routes can use it
  c.set('db', client);

  try {
    await client.connect();
    // 3. Pass control to the next middleware or route handler
    await next();
  } catch (error) {
    // If an error happens, we still want to release the client.
    // The global error handler in index.js will format the response.
    console.error(
      'Error within DB middleware scope:',
      (error as Error).message,
    );
    throw error; // Re-throw the error
  } finally {
    // 4. ALWAYS release the client back to the pool
    // This block runs whether an error occurred or not.
    await client.end();
    console.log('Database client released.');
  }
};
