import { Context } from "hono";
import z, { ZodError } from "zod";

export const asyncHandler = (fn: Function) => {
  console.log("asyncHandler initialized");
  return async (c: Context) => {
    try {
      await fn(c);
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          {
            error: "Validation Error",
            errors: z.treeifyError(error),
          },
          400
        );
      }
      return c.json(
        {
          error: "Internal Server Error",
          message: "An unexpected error occurred.",
        },
        500
      );
    }
  };
};
