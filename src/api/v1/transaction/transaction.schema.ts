import zod from "zod";

export const transactionCommonSchema = zod.object({
  sender: zod.string().optional().nullable(),
  phone_number: zod.string().max(15).optional().nullable(),
  transaction_category: zod
    .enum([
      "transfer",
      "withdrawal",
      "goods_payment",
      "airtime_purchase",
      "loan_payment",
      "loan_disbursement",
      "fund_transfer",
      "refund",
      "deposit",
      "other",
    ])
    .default("other"),
  payment_code: zod.string().optional().nullable(),
  transaction_reference: zod.string().optional().nullable(),
  summary: zod.string().optional().nullable(),
});

export const TransactionSchema = transactionCommonSchema.extend({
  amount: zod.number().min(0),
  fees: zod.number().min(0).default(0),
  type: zod.enum(["DEBIT", "CREDIT"]),
  message: zod.string(),
  message_id: zod.string().optional(),
  recipient: zod.string().optional(),
  completed_at: zod.string().optional().nullable(),
  label: zod.string().optional().nullable(),
  remaining_balance: zod.number().min(0).optional().nullable(),
});

export type ITransaction = zod.infer<typeof TransactionSchema>;

export const TransactionPayloadAISchema = transactionCommonSchema.extend({
  message: zod.string(),
  message_timestamp: zod.number().optional().nullable(),
  message_id: zod.string(),
});

export type ITransactionPayloadAI = zod.infer<
  typeof TransactionPayloadAISchema
>;
