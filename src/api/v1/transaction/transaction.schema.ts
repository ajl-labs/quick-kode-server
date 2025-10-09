import zod from "zod";

export const TransactionSchema = zod
  .object({
    amount: zod.number().min(0),
    fees: zod.number().min(0).default(0),
    type: zod.enum(["DEBIT", "CREDIT"]),
    message: zod.string(),
    recipient: zod.string().optional(),
    sender: zod.string().optional(),
    phone_number: zod.string().max(15).optional(),
    completed_at: zod.date().optional(),
  })
  .strict();

export type ITransaction = zod.infer<typeof TransactionSchema>;

export const TransactionPayloadAISchema = zod
  .object({
    message: zod.string(),
    sender: zod.string().optional(),
    phone_number: zod.string().max(15).optional(),
  })
  .strict();
export type ITransactionPayloadAI = zod.infer<
  typeof TransactionPayloadAISchema
>;
