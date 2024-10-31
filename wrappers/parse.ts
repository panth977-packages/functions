import type { z } from "zod";
import type {
  AsyncFunction,
  AsyncGenerator,
  Context,
  SyncFunction,
  SyncGenerator,
} from "../functions.ts";
import { getParams, type WrapperBuild } from "../_helper.ts";
import { assign } from "./instance.ts";

export function SafeParse<
  I extends z.ZodType,
  O extends z.ZodType,
  L,
  C extends Context
>(
  _params: AsyncFunction._Params<I, O, L, C>,
  behavior?: { debug?: boolean; input?: boolean; output?: boolean }
): AsyncFunction.WrapperBuild<I, O, L, C>;
export function SafeParse<
  I extends z.ZodType,
  O extends z.ZodType,
  L,
  C extends Context
>(
  _params: SyncFunction._Params<I, O, L, C>,
  behavior?: { debug?: boolean; input?: boolean; output?: boolean }
): SyncFunction.WrapperBuild<I, O, L, C>;
export function SafeParse<
  I extends z.ZodType,
  Y extends z.ZodType,
  N extends z.ZodType,
  O extends z.ZodType,
  L,
  C extends Context
>(
  _params: SyncGenerator._Params<I, Y, N, O, L, C>,
  behavior?: {
    debug?: boolean;
    input?: boolean;
    output?: boolean;
    yield?: boolean;
    next?: boolean;
  }
): SyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function SafeParse<
  I extends z.ZodType,
  Y extends z.ZodType,
  N extends z.ZodType,
  O extends z.ZodType,
  L,
  C extends Context
>(
  _params: AsyncGenerator._Params<I, Y, N, O, L, C>,
  behavior?: {
    debug?: boolean;
    input?: boolean;
    output?: boolean;
    yield?: boolean;
    next?: boolean;
  }
): AsyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function SafeParse(
  _params: unknown,
  behavior: {
    debug?: boolean;
    input?: boolean;
    output?: boolean;
    yield?: boolean;
    next?: boolean;
  } = {}
): WrapperBuild {
  const { type } = getParams(_params);
  let Wrapper: undefined | WrapperBuild;
  if (type === "function") {
    Wrapper = function (context, input, func, build) {
      if (behavior.input ?? true) {
        const start = Date.now();
        input = build.input.parse(input, {
          path: [build.getRef() + ":input"],
        });
        if (behavior.debug) {
          context.log(
            `${build.getRef()}:input parsed in ${Date.now() - start} ms`
          );
        }
      }
      let output = func(context, input);
      if (behavior.output ?? true) {
        const start = Date.now();
        output = build.output.parse(output, {
          path: [build.getRef() + ":output"],
        });
        if (behavior.debug) {
          context.log(
            `${build.getRef()}:output parsed in ${Date.now() - start} ms`
          );
        }
      }
      return output;
    } satisfies SyncFunction.WrapperBuild;
  } else if (type === "async function") {
    Wrapper = async function (context, input, func, build) {
      if (behavior.input ?? true) {
        const start = Date.now();
        input = build.input.parse(input, {
          path: [build.getRef() + ":input"],
        });
        if (behavior.debug) {
          context.log(
            `${build.getRef()}:input parsed in ${Date.now() - start} ms`
          );
        }
      }
      let output = await func(context, input);
      if (behavior.output ?? true) {
        const start = Date.now();
        output = build.output.parse(output, {
          path: [build.getRef() + ":output"],
        });
        if (behavior.debug) {
          context.log(
            `${build.getRef()}:output parsed in ${Date.now() - start} ms`
          );
        }
      }
      return output;
    } satisfies AsyncFunction.WrapperBuild;
  } else if (type === "async function*") {
    Wrapper = async function* (context, input, func, build) {
      if (behavior.input ?? true) {
        const start = Date.now();
        input = build.input.parse(input, {
          path: [build.getRef() + ":input"],
        });
        if (behavior.debug) {
          context.log(
            `${build.getRef()}:input parsed in ${Date.now() - start} ms`
          );
        }
      }
      const g = func(context, input);
      let val = await g.next();
      while (!val.done) {
        let y = val.value;
        if (behavior.yield ?? true) {
          const start = Date.now();
          y = build.yield.parse(y, { path: [build.getRef() + ":yield"] });
          if (behavior.debug) {
            context.log(
              `${build.getRef()}:yield parsed in ${Date.now() - start} ms`
            );
          }
        }
        let next = yield y;
        if (behavior.next ?? true) {
          const start = Date.now();
          next = build.next.parse(next, { path: [build.getRef() + ":next"] });
          if (behavior.debug) {
            context.log(
              `${build.getRef()}:next parsed in ${Date.now() - start} ms`
            );
          }
        }
        val = await g.next(next);
      }
      let output = val.value;
      if (behavior.output ?? true) {
        const start = Date.now();
        output = build.output.parse(output, {
          path: [build.getRef() + ":output"],
        });
        if (behavior.debug) {
          context.log(
            `${build.getRef()}:output parsed in ${Date.now() - start} ms`
          );
        }
      }
      return output;
    } satisfies AsyncGenerator.WrapperBuild;
  } else if (type === "function*") {
    Wrapper = function* (context, input, func, build) {
      if (behavior.input ?? true) {
        const start = Date.now();
        input = build.input.parse(input, {
          path: [build.getRef() + ":input"],
        });
        if (behavior.debug) {
          context.log(
            `${build.getRef()}:input parsed in ${Date.now() - start} ms`
          );
        }
      }
      const g = func(context, input);
      let val = g.next();
      while (!val.done) {
        let y = val.value;
        if (behavior.yield ?? true) {
          const start = Date.now();
          y = build.yield.parse(y, { path: [build.getRef() + ":yield"] });
          if (behavior.debug) {
            context.log(
              `${build.getRef()}:yield parsed in ${Date.now() - start} ms`
            );
          }
        }
        let next = yield y;
        if (behavior.next ?? true) {
          const start = Date.now();
          next = build.next.parse(next, { path: [build.getRef() + ":next"] });
          if (behavior.debug) {
            context.log(
              `${build.getRef()}:next parsed in ${Date.now() - start} ms`
            );
          }
        }
        val = g.next(next);
      }
      let output = val.value;
      if (behavior.output ?? true) {
        const start = Date.now();
        output = build.output.parse(output, {
          path: [build.getRef() + ":output"],
        });
        if (behavior.debug) {
          context.log(
            `${build.getRef()}:output parsed in ${Date.now() - start} ms`
          );
        }
      }
      return output;
    } satisfies SyncGenerator.WrapperBuild;
  } else {
    throw new Error("Unimplemented!");
  }
  assign(Wrapper, SafeParse);
  return Wrapper;
}
