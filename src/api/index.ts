import { Hono } from 'hono';
import { apiV1Router } from './v1';

const api = new Hono();

api.get('/status', c => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

api.route('/v1', apiV1Router);

export default api;
