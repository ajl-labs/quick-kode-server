import { Hono } from 'hono';
import { transactionRouter } from './transaction/transaction.routes';

const apiV1Router = new Hono();

apiV1Router.route('/transactions', transactionRouter);

export { apiV1Router };
