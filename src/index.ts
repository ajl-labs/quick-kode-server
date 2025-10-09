import 'dotenv/config';
import { Hono } from 'hono';
import api from './api';
import { dbConnection } from './database/database.config';

// This is the main Hono app that will be the entry point for the worker.
const app = new Hono();

// --- Middleware ---
// Simple logger middleware that runs on every request
app.use('*', async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`);
  await next();
});

// --- Routing ---
// Mount the versioned API router under the '/api' base path.
// All requests to /api/v1/* will be handled by our v1 router.
app.use('/api/*', dbConnection);
app.route('/api', api);

// --- Error Handling ---
// Custom 404 Not Found handler
app.notFound(c => {
  return c.json(
    { error: 'Not Found', message: `The path ${c.req.path} was not found.` },
    404,
  );
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
    },
    500,
  );
});

// This is the required export for a Cloudflare Worker module.
export default {
  fetch: app.fetch,
};
