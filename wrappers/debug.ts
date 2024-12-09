import type {
  AsyncFunction,
  AsyncGenerator,
  Context,
  SyncFunction,
  SyncGenerator,
} from "../functions/index.ts";
import { getParams, type WrapperBuild } from "../_helper.ts";
import { assign } from "./_helper.ts";

export function Debug<
  //
  I extends AsyncFunction.zInput,
  O extends AsyncFunction.zOutput,
  S extends Record<never, never>,
  C extends Context
>(arg: {
  _params: AsyncFunction._Params<I, O, S, C>;
  maxTimeAllowed?: number;
  input?: boolean;
  output?: boolean;
}): AsyncFunction.WrapperBuild<I, O, S, C>;
export function Debug<
  //
  I extends SyncFunction.zInput,
  O extends SyncFunction.zOutput,
  S extends Record<never, never>,
  C extends Context
>(arg: {
  _params: SyncFunction._Params<I, O, S, C>;
  maxTimeAllowed?: number;
  input?: boolean;
  output?: boolean;
}): SyncFunction.WrapperBuild<I, O, S, C>;
export function Debug<
  //
  I extends SyncGenerator.zInput,
  Y extends SyncGenerator.zYield,
  N extends SyncGenerator.zNext,
  O extends SyncGenerator.zOutput,
  S extends Record<never, never>,
  C extends Context
>(arg: {
  _params: SyncGenerator._Params<I, Y, N, O, S, C>;
  maxTimeAllowed?: number;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): SyncGenerator.WrapperBuild<I, Y, N, O, S, C>;
export function Debug<
  //
  I extends AsyncGenerator.zInput,
  Y extends AsyncGenerator.zYield,
  N extends AsyncGenerator.zNext,
  O extends AsyncGenerator.zOutput,
  S extends Record<never, never>,
  C extends Context
>(arg: {
  _params: AsyncGenerator._Params<I, Y, N, O, S, C>;
  maxTimeAllowed?: number;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): AsyncGenerator.WrapperBuild<I, Y, N, O, S, C>;
export function Debug({
  _params,
  ...behavior
}: {
  _params: unknown;
  maxTimeAllowed?: number;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): WrapperBuild {
  const { type } = getParams(_params);
  let Wrapper: WrapperBuild | undefined;
  if (type === "function") {
    Wrapper = function ({ context, input, func, build }) {
      const start = Date.now();
      try {
        if (behavior.input) context.log(build.getRef(), "input", input);
        const output = func({ context, input, build });
        if (behavior.output) context.log(build.getRef(), "output", output);
        return output;
      } finally {
        const timeTaken = Date.now() - start;
        context.log(
          build.getRef(),
          "⏳ Time",
          timeTaken,
          behavior.maxTimeAllowed && behavior.maxTimeAllowed < timeTaken
            ? "⚠ throttle"
            : "",
          context.path.map((x) => "\n\t-->> " + x).join("")
        );
      }
    } satisfies SyncFunction.WrapperBuild;
  } else if (type === "async function") {
    Wrapper = async function ({ context, input, func, build }) {
      const start = Date.now();
      try {
        if (behavior.input) context.log("input", input);
        const output = await func({ context, input, build });
        if (behavior.output) context.log("output", output);
        return output;
      } finally {
        const timeTaken = Date.now() - start;
        context.log(
          build.getRef(),
          "⏳ Time",
          timeTaken,
          behavior.maxTimeAllowed && behavior.maxTimeAllowed < timeTaken
            ? "⚠ throttle"
            : "",
          context.path.map((x) => "\n\t-->> " + x).join("")
        );
      }
    } satisfies AsyncFunction.WrapperBuild;
  } else if (type === "async function*") {
    Wrapper = async function* ({ context, input, func, build }) {
      const start = Date.now();
      try {
        if (behavior.input) context.log(build.getRef(), "input", input);
        const g = func({ context, input, build });
        let val = await g.next();
        let i = 0;
        while (!val.done) {
          const timeTaken = Date.now() - start;
          context.log(
            build.getRef(),
            `yield ${i}`,
            "⏳ Time",
            timeTaken,
            behavior.maxTimeAllowed && behavior.maxTimeAllowed < timeTaken
              ? "⚠ throttle"
              : ""
          );
          i++;
          if (behavior.yield) context.log(build.getRef(), "yield", val.value);
          const next = yield val.value;
          if (behavior.next) context.log(build.getRef(), "next", next);
          val = await g.next(next);
        }
        if (behavior.output) context.log(build.getRef(), "output", val.value);
      } finally {
        context.log(
          build.getRef(),
          "⏳ Time",
          Date.now() - start,
          context.path.map((x) => "\n\t-->> " + x).join("")
        );
      }
    } satisfies AsyncGenerator.WrapperBuild;
  } else if (type === "function*") {
    Wrapper = function* ({ context, input, func, build }) {
      const start = Date.now();
      try {
        if (behavior.input) context.log(build.getRef(), "input", input);
        const g = func({ context, input, build });
        let val = g.next();
        let i = 0;
        while (!val.done) {
          const timeTaken = Date.now() - start;
          context.log(
            build.getRef(),
            `yield ${i}`,
            "⏳ Time",
            timeTaken,
            behavior.maxTimeAllowed && behavior.maxTimeAllowed < timeTaken
              ? "⚠ throttle"
              : ""
          );
          i++;
          if (behavior.yield) context.log(build.getRef(), "yield", val.value);
          const next = yield val.value;
          if (behavior.next) context.log(build.getRef(), "next", next);
          val = g.next(next);
        }
        if (behavior.output) context.log(build.getRef(), "output", val.value);
        return val.value;
      } finally {
        context.log(
          build.getRef(),
          "⏳ Time",
          Date.now() - start,
          context.path.map((x) => "\n\t-->> " + x).join("")
        );
      }
    } satisfies SyncGenerator.WrapperBuild;
  } else {
    throw new Error("Unimplemented!");
  }
  assign(Wrapper, Debug);
  return Wrapper;
}
