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
    const payload = await TransactionPayloadAISchema.parseAsync(body);
    const { result } = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
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
                  Extract: amount, fees, sender, recipient, date (CAT timezone), and timestamp.
                  
                  If sender missing → "sender": "self".
                  If recipient missing → "recipient": "self".

                  Return JSON, this the validation schema ${JSON.stringify(
                    TransactionSchema
                  )}.
                Give me the json only, no other text. 
                `,
        },
      ],
    });
    return c.json(result);
  });
}
