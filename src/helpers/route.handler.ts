import { Context } from 'hono';

type ControllerConstructor<T> = new (c: Context) => T;

export const handle = <T>(
  ControllerClass: ControllerConstructor<T>,
  method: keyof T,
) => {
  return async (c: Context) => {
    const controller = new ControllerClass(c);
    const fn = controller[method];
    if (typeof fn === 'function') {
      return fn.call(controller, c);
    }
    throw new Error(
      `Method ${String(method)} is not a public method on the controller.`,
    );
  };
};
