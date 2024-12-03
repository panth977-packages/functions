import type {
  AsyncFunction,
  AsyncGenerator,
  Context,
  SyncFunction,
  SyncGenerator,
} from "../functions/index.ts";
import { getParams, type WrapperBuild } from "../_helper.ts";
import { assign } from "./_helper.ts";

export function SafeParse<
  I extends AsyncFunction.zInput,
  O extends AsyncFunction.zOutput,
  L,
  C extends Context
>(arg: {
  _params: AsyncFunction._Params<I, O, L, C>;
  debug?: boolean;
  input?: boolean;
  output?: boolean;
}): AsyncFunction.WrapperBuild<I, O, L, C>;
export function SafeParse<
  I extends SyncFunction.zInput,
  O extends SyncFunction.zOutput,
  L,
  C extends Context
>(arg: {
  _params: SyncFunction._Params<I, O, L, C>;
  debug?: boolean;
  input?: boolean;
  output?: boolean;
}): SyncFunction.WrapperBuild<I, O, L, C>;
export function SafeParse<
  I extends SyncGenerator.zInput,
  Y extends SyncGenerator.zYield,
  N extends SyncGenerator.zNext,
  O extends SyncGenerator.zOutput,
  L,
  C extends Context
>(arg: {
  _params: SyncGenerator._Params<I, Y, N, O, L, C>;
  debug?: boolean;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): SyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function SafeParse<
  I extends AsyncGenerator.zInput,
  Y extends AsyncGenerator.zYield,
  N extends AsyncGenerator.zNext,
  O extends AsyncGenerator.zOutput,
  L,
  C extends Context
>(arg: {
  _params: AsyncGenerator._Params<I, Y, N, O, L, C>;
  debug?: boolean;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): AsyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function SafeParse({
  _params,
  ...behavior
}: {
  _params: unknown;
  debug?: boolean;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): WrapperBuild {
  const { type } = getParams(_params);
  let Wrapper: undefined | WrapperBuild;
  if (type === "function") {
    Wrapper = function ({ context, input, func, build }) {
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
      let output = func({ context, input, build });
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
    Wrapper = async function ({ context, input, func, build }) {
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
      let output = await func({ context, input, build });
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
    Wrapper = async function* ({ context, input, func, build }) {
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
      const g = func({ context, input, build });
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
    Wrapper = function* ({ context, input, func, build }) {
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
      const g = func({ context, input, build });
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
