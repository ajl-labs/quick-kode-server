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
import { cleanAndParseJson } from "../../../helpers/data.parser";
import {
  endOfTheMonth,
  PERIODS,
  PERIODS_FORMAT,
  startOfTheMonth,
  subtractDays,
} from "../../../helpers/date.helpers";
export default class TransactionController extends MainController<ITransaction> {
  constructor(c: Context) {
    super(c, "transactions", TransactionSchema);
  }

  addNewTransaction = async (c: Context) => {
    const { aiEnabled } = await c.req.json();
    if (aiEnabled) {
      return this.createFromAIPrompt(c);
    }
    return this.create(c);
  };

  getStatsSummary = asyncHandler(async (c: Context) => {
    const totalTransactions = await this.countRecords(this.table);
    const balance = await this.getLastRecord(this.table, "created_at");
    const totalFees = await this.sumColumn(this.table, "fees");
    return c.json({
      totalTransactions,
      balance: balance?.remaining_balance || 0,
      totalFees,
    });
  });

  getTransactionsTrends = asyncHandler(async (c: Context) => {
    const startAt = c.req.query("start");
    const endAt = c.req.query("end");
    const period = c.req.query("period");

    const [spendingByCategory, spendingByPeriod] = await Promise.all([
      this.computeSpendingByCategory(startAt, endAt),
      this.computeSpendingByPeriod(startAt, endAt, period as PERIODS),
    ]);
    return c.json({
      spendingByCategory,
      spendingByPeriod,
    });
  });

  private computeSpendingByCategory = async (
    startAt?: Date | string,
    endAt?: Date | string,
  ) => {
    startAt = startOfTheMonth(startAt || subtractDays(new Date(), 30));
    endAt = endOfTheMonth(endAt || new Date());
    const queryString = `
      SELECT
        lower(label) AS label,
        SUM(amount) AS total_amount,
        SUM(fees) AS total_fees,
        COUNT(*) AS total_transactions
      FROM transactions
      WHERE label IS NOT NULL
        AND lower(type) = lower(%L)
        AND completed_at BETWEEN %L AND %L
      GROUP BY lower(label);
    `;
    const query = this.format(
      queryString,
      "DEBIT",
      startAt.toISOString(),
      endAt.toISOString(),
    );
    const result = await this.runQuery<{ label: string; total_amount: number }>(
      query,
    );
    return result?.rowCount ? result.rows : [];
  };

  private computeSpendingByPeriod = async (
    startAt?: Date | string,
    endAt?: Date | string,
    period?: keyof typeof PERIODS_FORMAT,
  ) => {
    period = period || PERIODS.WEEK;
    let totalDays = 30;

    if (period === PERIODS.WEEK) totalDays = totalDays * 4;
    if (period === PERIODS.MONTH) totalDays = totalDays * 30;
    if (period === PERIODS.YEAR) totalDays = totalDays * 365;

    startAt = startOfTheMonth(startAt || subtractDays(new Date(), totalDays));
    endAt = endOfTheMonth(endAt || new Date());
    const queryString = `
      SELECT
        to_char(date_trunc('${period}', created_at), '${PERIODS_FORMAT[period]}') AS label,
        SUM(amount) AS total_amount,
        SUM(fees) AS total_fees,
        COUNT(*) AS total_transactions
      FROM transactions
      WHERE lower(type)=lower(%L)
        AND created_at BETWEEN %L AND %L
      GROUP BY date_trunc('${period}', created_at)
      ORDER BY date_trunc('${period}', created_at);
    `;

    const query = this.format(
      queryString,
      "DEBIT",
      startAt.toISOString(),
      endAt.toISOString(),
    );

    const result = await this.runQuery<{
      month: string;
      total_amount: number;
      total_fees: number;
    }>(query);
    return result?.rowCount ? result.rows : [];
  };

  createFromAIPrompt = asyncHandler(async (c: Context) => {
    const { aiEnabled, ...body } = await c.req.json();
    const payload = await TransactionPayloadAISchema.strict().parseAsync(body);
    console.log(payload);
    if (payload?.message_id) {
      const existingRecord = await this.findOneBy(
        this.table,
        "message_id",
        payload.message_id,
      );
      if (existingRecord)
        return this.context.json(
          {
            error: "Transaction already exists",
            code: "TRANSACTION_ALREADY_EXISTS",
          },
          409,
        );
    }
    if (payload.message.toLowerCase().includes("failed")) return;
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
             - Balance which is remaining_balance must be a number or null.
             - If sender missing set 'sender':'self'.
             - If recipient missing set 'recipient':'self'.
             - Generate summary based on the message and transaction category identified. e.g of summary:
                 - if it is transfer then "Money transferred to John",
                 - if money was received then "Received money from Jane",
                 - if it is a loan then "Received loan from MoCash",
                 - if it is a payment or a transaction then "Paid good/service to AJL Ltd", etc..
             - If the message is not a transaction message return null.
             - Output JSON only—no text, explanation, or code blocks.
             - Return empty object for: failed transaction, none transaction
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
          },
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
        400,
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
        response.completed_at || defaultData,
      ).toISOString(),
    });

    const newRecord = await this.createRecord<IDatabaseRecord<ITransaction>>(
      this.table,
      transactionPayload!,
    );
    return this.context.json(newRecord, 201);
  });
}
