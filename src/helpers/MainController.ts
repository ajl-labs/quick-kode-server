import { getPagination } from "./query.helpers";
import { ZodObject, ZodRawShape } from "zod";
import { Context } from "hono";
import { DatabaseModel } from "../database/database.model";
import { asyncHandler } from "./async.helper";

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

  getAll = asyncHandler(async () => {
    const limit =
      parseInt(this.context.req.query("limit") as string) || this.limit;
    const page =
      parseInt(this.context.req.query("page") as string) || this.page;
    const data = await this.findAll<T>(this.table, getPagination(page, limit));
    return this.context.json(data, 200);
  });

  create = asyncHandler(async () => {
    const body = await this.context.req.json();
    const payload = (await this.schema?.strict().parseAsync(body)) ?? body;
    const newRecord = await this.createRecord<T>(this.table, payload);
    return this.context.json(newRecord, 201);
  });

  update = asyncHandler(async () => {
    const id = this.context.req.param("id");
    if (!id) {
      return this.context.json({ error: "ID is required" }, 400);
    }
    const body = await this.context.req.json();
    const payload = (await this.schema?.partial().parseAsync(body)) ?? body;
    const updatedRecord = await this.updateRecord<T>(this.table, id, payload);
    if (!updatedRecord) {
      return this.context.json({ error: "Record not found" }, 404);
    }
    return this.context.json(updatedRecord, 200);
  });
}
