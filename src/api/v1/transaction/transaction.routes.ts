import { Hono } from "hono";
import transactionController from "./transaction.controller";
import { handle } from "../../../helpers/route.handler";

const transactionRouter = new Hono();

transactionRouter.get("/", handle(transactionController, "getAll"));
transactionRouter.post("/", handle(transactionController, "addNewTransaction"));

transactionRouter.put("/:id", handle(transactionController, "update"));
transactionRouter.get(
  "/dashboard/stats",
  handle(transactionController, "getDashboardStats")
);

export { transactionRouter };
