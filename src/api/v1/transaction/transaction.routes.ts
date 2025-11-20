import { Hono } from "hono";
import transactionController from "./transaction.controller";
import { handle } from "../../../helpers/route.handler";

const transactionRouter = new Hono();

transactionRouter.get("/", handle(transactionController, "getAllWithSearch"));
transactionRouter.post("/", handle(transactionController, "addNewTransaction"));

transactionRouter.put("/:id", handle(transactionController, "update"));
transactionRouter.get(
  "/stats/summary",
  handle(transactionController, "getStatsSummary"),
);

transactionRouter.get(
  "/stats/trends",
  handle(transactionController, "getTransactionsTrends"),
);
transactionRouter.delete("/:id", handle(transactionController, "delete"));

export { transactionRouter };
