import { getPagination } from "./query.helpers";
import z, { ZodError, ZodObject, ZodRawShape } from "zod";
import { Context } from "hono";
import { DatabaseModel } from "../database/database.model";

export class MainController<T> extends DatabaseModel {
  limit: number = 25;
  page: number = 1;
  table: string;
  schema?: ZodObject<ZodRawShape>;
  context: Context;
  constructor(c: Context, table: string, schema?: ZodObject<ZodRawShape>) {
    if (c === null || c === undefined) {
      throw new Error("Context 'c' is required");
    }
    super();
    this.table = table;
    this.schema = schema;
    this.context = c;
  }

  getAll = async () => {
    try {
      const limit =
        parseInt(this.context.req.query("limit") as string) || this.limit;
      const page =
        parseInt(this.context.req.query("page") as string) || this.page;
      const data = await this.findAll<T>(
        this.table,
        getPagination(page, limit)
      );
      return this.context.json(data, 200);
    } catch (error) {
      console.error("Error fetching data:", error);
      return this.context.json({ error: "Internal server error" }, 500);
    }
  };

  create = async () => {
    try {
      const body = await this.context.req.json();
      const payload = this.schema?.parse(body) ?? body;
      const newRecord = await this.createRecord<T>(this.table, payload);
      return this.context.json(newRecord, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        return this.context.json(
          {
            message: "Data validation error",
            errors: z.treeifyError(error),
          },
          400
        );
      }
      console.error("Error creating record:", error);
      return this.context.json({ error: "Internal server error" }, 500);
    }
  };
}
