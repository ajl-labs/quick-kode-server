import { Context } from 'hono';
import { MainController } from '../../../helpers/MainController';
import { ITransaction, TransactionSchema } from './transaction.schema';

export default class TransactionController extends MainController<ITransaction> {
  constructor(c: Context) {
    super(c, 'transactions', TransactionSchema);
  }
}
