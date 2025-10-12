import { Context } from "hono";
import z, { ZodError } from "zod";

export const asyncHandler = (fn: Function) => {
  return async (c: Context) => {
    try {
      return await fn(c);
    } catch (error) {
      console.log(error);
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
