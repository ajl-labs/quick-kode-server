import { Context } from "hono";
import { MainController } from "../../../helpers/MainController";
import {
  ITransaction,
  TransactionPayloadAISchema,
  TransactionSchema,
} from "./transaction.schema";
import { asyncHandler } from "../../../helpers/async.helper";
import z from "zod";
import { runGemini } from "../../../service/ai/exterinal.LLM.service";
import { cleanAndParseJson } from "../../../helpers/ai.helper";
import { classicNameResolver } from "typescript";
export default class TransactionController extends MainController<ITransaction> {
  constructor(c: Context) {
    super(c, "transactions", TransactionSchema);
  }

  createFromAIPrompt = asyncHandler(async (c: Context) => {
    const body = await c.req.json();
    const payload = await TransactionPayloadAISchema.strict().parseAsync(body);
    const aiInstruction =
      "Extract payment info from SMS and return only valid JSON, no text or code blocks.";
    const aiContent = `
            Extract payment info from the SMS below and return only one valid JSON object matching this schema: 
              SMS: "${payload.message}"
              Schema: "${z.toJSONSchema(TransactionSchema)}"

            Rules: 
             - phone_number: ${payload.phone_number}
             - SMS sender -> ${payload.sender}
             - message -> ${payload.message}
             - type must be 'DEBIT' or 'CREDIT'. 
             - Identify transaction category, and set it to be one of: 'transfer','withdrawal','goods_payment','airtime_purchase','loan_payment','fund_transfer', 'loan_disbursement','refund','deposit','other'. 
             - amount and fees must be numbers only (no currency symbol); fees default to 0 if missing. 
             - date must be ISO8601 UTC; if missing use current UTC datetime. 
             - payment_code and transaction_reference must be string or null. 
             - If sender missing set 'sender':'self'. 
             - If recipient missing set 'recipient':'self'. 
             - Generate summary based on the message. i.e "Paid RWF 200 to John", or "Received RWF 500 from Jane", or "Received RWF 100 loan from MoCash", etc..
             - If the message is not a transaction return null. 
             - Output JSON only—no text, explanation, or code blocks.
                `;

    const response = await runGemini(aiInstruction, aiContent)
      .then((res: any) => {
        try {
          const geminiResponse = cleanAndParseJson(res[0].text);
          return geminiResponse;
        } catch (error) {
          console.error("Failed to parse Gemini response:", error);
          return null;
        }
      })
      .catch(async (err) => {
        const { response: llamaResponse } = await c.env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct",
          {
            messages: [
              {
                role: "system",
                content: aiInstruction,
              },
              {
                role: "user",
                content: aiContent,
              },
            ],
          }
        ).catch((err: any) => {
          throw err;
        });
        return cleanAndParseJson(llamaResponse);
      });

    if (!response?.amount && !body?.message?.includes("RWF")) {
      console.log("Invalid transaction message:", payload.message);
      return this.context.json(
        {
          error: "Invalid transaction message",
          code: "INVALID_TRANSACTION_MESSAGE",
        },
        400
      );
    }

    const defaultData = new Date();
    const transactionPayload = await this.schema?.parseAsync({
      ...response,
      message: payload.message,
      phone_number: payload.phone_number,
      sender: payload.sender,
      message_id: payload.message_id,
      message_timestamp: payload.message_timestamp
        ? new Date(payload.message_timestamp)
        : defaultData,
      completed_at: new Date(
        response.completed_at || defaultData
      ).toISOString(),
    });

    const newRecord = await this.createRecord<IDatabaseRecord<ITransaction>>(
      this.table,
      transactionPayload!
    );
    return this.context.json(newRecord, 201);
  });
}
