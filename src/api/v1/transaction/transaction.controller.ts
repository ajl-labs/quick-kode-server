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
  GRANULARITY,
  GRANULARITY_FORMAT,
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
    const granularity = c.req.query("granularity") || GRANULARITY.MONTH;
    const months = c.req.query("months") || "12";

    const endDate = new Date();
    const startDate = subtractDays(endDate, parseInt(months) * 30);

    const [balance, totalFees, transactionAverages] = await Promise.all([
      this.getLastRecord(this.table, "created_at"),
      this.sumColumn(this.table, "fees"),
      this.computeTransactionAverages(
        granularity as keyof typeof GRANULARITY_FORMAT,
        startDate,
        endDate,
      ),
    ]);

    return c.json({
      balance: balance?.remaining_balance || 0,
      totalFees,
      ...transactionAverages,
    });
  });

  getTransactionsTrends = asyncHandler(async (c: Context) => {
    const months = c.req.query("months") || "12";
    const endDate = new Date();
    const startDate = subtractDays(endDate, parseInt(months) * 30);
    let granularity = c.req.query("granularity");

    granularity = granularity || GRANULARITY.WEEK;

    const [spendingByCategory, spendingByPeriod] = await Promise.all([
      this.computeSpendingByCategory(startDate, endDate),
      this.computeSpendingByPeriod(
        granularity as GRANULARITY,
        startDate,
        endDate,
      ),
    ]);
    return c.json({
      spendingByCategory,
      spendingByPeriod,
    });
  });

  private computeSpendingByCategory = async (
    startDate: Date,
    endDate: Date,
  ) => {
    const queryString = `
      SELECT
        lower(label) AS label,
        SUM(amount) AS total_amount,
        SUM(fees) AS total_fees,
        COUNT(*) AS total_transactions
      FROM transactions
      WHERE label IS NOT NULL
        AND lower(type) = lower(%L)
        AND created_at BETWEEN %L AND %L
      GROUP BY lower(label);
    `;
    const query = this.format(
      queryString,
      "DEBIT",
      startDate.toISOString(),
      endDate.toISOString(),
    );
    const result = await this.runQuery<{ label: string; total_amount: number }>(
      query,
    );
    return result?.rowCount ? result.rows : [];
  };

  private computeSpendingByPeriod = async (
    granularity: keyof typeof GRANULARITY_FORMAT,
    startDate: Date,
    endDate: Date,
  ) => {
    const queryString = `
      SELECT
        to_char(date_trunc('${granularity}', created_at), '${GRANULARITY_FORMAT[granularity]}') AS label,
        SUM(amount) AS total_amount,
        SUM(fees) AS total_fees,
        COUNT(*) AS total_transactions
      FROM transactions
      WHERE lower(type)=lower(%L)
        AND created_at BETWEEN %L AND %L
      GROUP BY date_trunc('${granularity}', created_at)
      ORDER BY date_trunc('${granularity}', created_at);
    `;

    const query = this.format(
      queryString,
      "DEBIT",
      startDate.toISOString(),
      endDate.toISOString(),
    );

    const result = await this.runQuery<{
      month: string;
      total_amount: number;
      total_fees: number;
    }>(query);
    return result?.rowCount ? result.rows : [];
  };
  private computeTransactionAverages = async (
    granularity: keyof typeof GRANULARITY_FORMAT,
    startDate: Date,
    endDate: Date,
  ) => {
    const query = this.format(
      `
      WITH amount_by_months AS (
        SELECT
          DATE_TRUNC('${granularity}', transactions.created_at) AS month,
          SUM(transactions.amount) AS total,
          COUNT(*) AS count
        FROM transactions
        WHERE lower(transactions.type) = 'debit'
        AND created_at BETWEEN %L AND %L
        GROUP BY month
        ORDER BY month
      )
      SELECT AVG(total) AS averageSpending,
             SUM(count) AS totalTransactions
      FROM amount_by_months;
      `,
      startDate.toISOString(),
      endDate.toISOString(),
    );

    const result = await this.runQuery<{
      month: string;
      average_spending: number;
    }>(query);
    return result.rows?.[0];
  };
  createFromAIPrompt = asyncHandler(async (c: Context) => {
    const { aiEnabled, ...body } = await c.req.json();
    const payload = await TransactionPayloadAISchema.strict().parseAsync(body);
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

    if (payload.message.toLowerCase().includes("failed")) {
      return this.context.json(
        {
          error: "Invalid transaction message",
          code: "INVALID_TRANSACTION_MESSAGE",
        },
        400,
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

    if (
      (!response?.amount && !body?.message?.includes("RWF")) ||
      response.summary?.toLowerCase().includes("failed")
    ) {
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
