import { Hono } from "hono";
import transactionController from "./transaction.controller";
import { handle } from "../../../helpers/route.handler";

const transactionRouter = new Hono();

transactionRouter.get("/", handle(transactionController, "getAll"));
transactionRouter.post("/", handle(transactionController, "create"));
transactionRouter.post(
  "/from-ai-prompt",
  handle(transactionController, "createFromAIPrompt")
);

export { transactionRouter };
