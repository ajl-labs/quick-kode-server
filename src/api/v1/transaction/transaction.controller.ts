import { Context } from "hono";
import { MainController } from "../../../helpers/MainController";
import {
  ITransaction,
  TransactionPayloadAISchema,
  TransactionSchema,
} from "./transaction.schema";
import { asyncHandler } from "../../../helpers/async.helper";

export default class TransactionController extends MainController<ITransaction> {
  constructor(c: Context) {
    super(c, "transactions", TransactionSchema);
  }

  createFromAIPrompt = asyncHandler(async (c: Context) => {
    const body = await c.req.json();
    const payload = await TransactionPayloadAISchema.strict().parseAsync(body);
    const { response } = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You are a JSON extraction engine that extract payment info from SMS messages. You return the extracted data in a JSON format.",
        },
        {
          role: "user",
          content: `
                  Extract payment info from ${payload.message}.
                  phone_number: ${payload.phone_number}
                  SMS sender -> ${payload.sender}
                  message -> ${payload.message}

                  Identify transaction type: "DEBIT" or "CREDIT".
                  Identify debit transaction category: "transfer", "payment", "withdrawal", "purchase".
                  Identify credit transaction category: "transfer", "refund", "deposit".
                  Identify the amount of money involved in the transaction, return as number only, no currency symbol.
                  Identify the fees involved in the transaction, return as number only, no currency symbol. If no fees, return 0.
                  Identify the date of the transaction, if no date, use current date. Return as timestamp.
                  Identify the payment code, if no payment code, return null.
                  Identify the transaction reference, if no transaction reference, return null.
                  Identify the  sender or recipient:
                    If sender missing → "sender": "self".
                    If recipient missing → "recipient": "self".

                  Return JSON, this the validation schema ${JSON.stringify(
                    TransactionSchema.shape
                  )}, ensure that the response has all fields and is valid.
                
                Give me the json only, no other text. 
                If you believe the message is not a transaction, return null.
                `,
        },
      ],
    });

    const aiResponse = JSON.parse(response || null);
    if (!aiResponse || !aiResponse.amount) {
      return this.context.json(
        {
          error: "Invalid transaction message",
          code: "INVALID_TRANSACTION_MESSAGE",
        },
        400
      );
    }

    const transactionPayload = await this.schema?.parseAsync({
      ...aiResponse,
      message: payload.message,
      phone_number: payload.phone_number,
      sender: payload.sender,
      message_id: payload.message_id,
      message_timestamp: payload.message_timestamp
        ? new Date(payload.message_timestamp)
        : new Date(),
    });

    const newRecord = await this.createRecord<IDatabaseRecord<ITransaction>>(
      this.table,
      transactionPayload!
    );
    return this.context.json(newRecord, 201);
  });
}
