import type {
  AsyncFunction,
  AsyncGenerator,
  Context,
  SyncFunction,
  SyncGenerator,
} from "../functions/index.ts";
import { getParams, type WrapperBuild } from "../_helper.ts";
import { assign, is } from "./_helper.ts";

function debugTime(
  context: Context,
  ref: string,
  log: boolean
): (label: string) => void {
  if (!log) return function () {};
  const record: Record<string, number> = {};
  return function (label) {
    const then = record[label];
    if (then) {
      delete record[label];
      const ts = Date.now() - then;
      context.log("[DEBUG]", `(${ts / 1000} sec)`, label, ref);
    } else {
      record[label] = Date.now();
    }
  };
}

export function SafeParse<
  I extends AsyncFunction.zInput,
  O extends AsyncFunction.zOutput,
  S extends Record<never, never>,
  C extends Context
>(arg: {
  _params: AsyncFunction._Params<I, O, S, C>;
  debug?: boolean;
  input?: boolean;
  output?: boolean;
}): AsyncFunction.WrapperBuild<I, O, S, C>;
export function SafeParse<
  I extends SyncFunction.zInput,
  O extends SyncFunction.zOutput,
  S extends Record<never, never>,
  C extends Context
>(arg: {
  _params: SyncFunction._Params<I, O, S, C>;
  debug?: boolean;
  input?: boolean;
  output?: boolean;
}): SyncFunction.WrapperBuild<I, O, S, C>;
export function SafeParse<
  I extends SyncGenerator.zInput,
  Y extends SyncGenerator.zYield,
  N extends SyncGenerator.zNext,
  O extends SyncGenerator.zOutput,
  S extends Record<never, never>,
  C extends Context
>(arg: {
  _params: SyncGenerator._Params<I, Y, N, O, S, C>;
  debug?: boolean;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): SyncGenerator.WrapperBuild<I, Y, N, O, S, C>;
export function SafeParse<
  I extends AsyncGenerator.zInput,
  Y extends AsyncGenerator.zYield,
  N extends AsyncGenerator.zNext,
  O extends AsyncGenerator.zOutput,
  S extends Record<never, never>,
  C extends Context
>(arg: {
  _params: AsyncGenerator._Params<I, Y, N, O, S, C>;
  debug?: boolean;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): AsyncGenerator.WrapperBuild<I, Y, N, O, S, C>;
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
      const timer = debugTime(context, build.getRef(), behavior.debug ?? false);
      if (behavior.input ?? true) {
        timer("input:parser");
        input = build.input.parse(input, {
          path: [build.getRef() + ":input"],
        });
        timer("input:parser");
      }
      timer("func:process");
      let output = func({ context, input, build });
      timer("func:process");
      if (behavior.output ?? true) {
        timer("output:parser");
        output = build.output.parse(output, {
          path: [build.getRef() + ":output"],
        });
        timer("output:parser");
      }
      return output;
    } satisfies SyncFunction.WrapperBuild;
  } else if (type === "async function") {
    Wrapper = async function ({ context, input, func, build }) {
      const timer = debugTime(context, build.getRef(), behavior.debug ?? false);
      if (behavior.input ?? true) {
        timer("input:parser");
        input = build.input.parse(input, {
          path: [build.getRef() + ":input"],
        });
        timer("input:parser");
      }
      timer("func:process");
      let output = await func({ context, input, build });
      timer("func:process");
      if (behavior.output ?? true) {
        timer("output:parser");
        output = build.output.parse(output, {
          path: [build.getRef() + ":output"],
        });
        timer("output:parser");
      }
      return output;
    } satisfies AsyncFunction.WrapperBuild;
  } else if (type === "async function*") {
    Wrapper = async function* ({ context, input, func, build }) {
      const timer = debugTime(context, build.getRef(), behavior.debug ?? false);
      if (behavior.input ?? true) {
        timer("input:parser");
        input = build.input.parse(input, {
          path: [build.getRef() + ":input"],
        });
        timer("input:parser");
      }
      timer("func:process");
      timer("func:init");
      const g = func({ context, input, build });
      let val = await g.next();
      timer("func:init");
      while (!val.done) {
        let y = val.value;
        if (behavior.yield ?? true) {
          timer("yield:parser");
          y = build.yield.parse(y, { path: [build.getRef() + ":yield"] });
          timer("yield:parser");
        }
        let next = yield y;
        if (behavior.next ?? true) {
          timer("next:parser");
          next = build.next.parse(next, { path: [build.getRef() + ":next"] });
          timer("next:parser");
        }
        timer("func:next");
        val = await g.next(next);
        timer("func:next");
      }
      let output = val.value;
      timer("func:process");
      if (behavior.output ?? true) {
        timer("output:parser");
        output = build.output.parse(output, {
          path: [build.getRef() + ":output"],
        });
        timer("output:parser");
      }
      return output;
    } satisfies AsyncGenerator.WrapperBuild;
  } else if (type === "function*") {
    Wrapper = function* ({ context, input, func, build }) {
      const timer = debugTime(context, build.getRef(), behavior.debug ?? false);
      if (behavior.input ?? true) {
        timer("input:parser");
        input = build.input.parse(input, {
          path: [build.getRef() + ":input"],
        });
        timer("input:parser");
      }
      timer("func:process");
      timer("func:init");
      const g = func({ context, input, build });
      let val = g.next();
      timer("func:init");
      while (!val.done) {
        let y = val.value;
        if (behavior.yield ?? true) {
          timer("yield:parser");
          y = build.yield.parse(y, { path: [build.getRef() + ":yield"] });
          timer("yield:parser");
        }
        let next = yield y;
        if (behavior.next ?? true) {
          timer("next:parser");
          next = build.next.parse(next, { path: [build.getRef() + ":next"] });
          timer("next:parser");
        }
        timer("func:next");
        val = g.next(next);
        timer("func:next");
      }
      let output = val.value;
      timer("func:process");
      if (behavior.output ?? true) {
        timer("output:parser");
        output = build.output.parse(output, {
          path: [build.getRef() + ":output"],
        });
        timer("output:parser");
      }
      return output;
    } satisfies SyncGenerator.WrapperBuild;
  } else {
    throw new Error("Unimplemented!");
  }
  assign(Wrapper, SafeParse);
  Object.assign(Wrapper, { [BS]: behavior });
  return Wrapper;
}
const BS = Symbol("behavior");
export function SafeParse_GetBehavior(w: any): {
  debug?: boolean;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
} {
  if (!is(w, SafeParse)) throw new Error("This is not SafeParse Wrapper!");
  return w[BS];
}
