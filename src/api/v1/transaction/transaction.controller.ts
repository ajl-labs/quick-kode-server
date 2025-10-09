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
                  Extract: amount, fees, sender, recipient, date as completed_at which is timestamp.
                  
                  If sender missing → "sender": "self".
                  If recipient missing → "recipient": "self".

                  Return JSON, this the validation schema ${JSON.stringify(
                    TransactionSchema.shape
                  )}, ensure that the response has all fields and is valid.

                Give me the json only, no other text. 
                `,
        },
      ],
    });

    const transactionPayload = await this.schema?.parseAsync({
      ...JSON.parse(response || "{}"),
      message: payload.message,
      phone_number: payload.phone_number,
      sender: payload.sender,
    });

    const newRecord = await this.createRecord<IDatabaseRecord<ITransaction>>(
      this.table,
      transactionPayload!
    );
    return this.context.json(newRecord, 201);
  });
}
