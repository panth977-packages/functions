import type {
  AsyncFunction,
  AsyncGenerator,
  Context,
  SyncFunction,
  SyncGenerator,
} from "../functions.ts";
import { getParams, type WrapperBuild } from "../_helper.ts";
import { assign } from "./_helper.ts";

export function Debug<
  //
  I extends AsyncFunction.zInput,
  O extends AsyncFunction.zOutput,
  L,
  C extends Context
>(
  _params: AsyncFunction._Params<I, O, L, C>,
  behavior?: { maxTimeAllowed?: number; input?: boolean; output?: boolean }
): AsyncFunction.WrapperBuild<I, O, L, C>;
export function Debug<
  //
  I extends SyncFunction.zInput,
  O extends SyncFunction.zOutput,
  L,
  C extends Context
>(
  _params: SyncFunction._Params<I, O, L, C>,
  behavior?: { maxTimeAllowed?: number; input?: boolean; output?: boolean }
): SyncFunction.WrapperBuild<I, O, L, C>;
export function Debug<
  //
  I extends SyncGenerator.zInput,
  Y extends SyncGenerator.zYield,
  N extends SyncGenerator.zNext,
  O extends SyncGenerator.zOutput,
  L,
  C extends Context
>(
  _params: SyncGenerator._Params<I, Y, N, O, L, C>,
  behavior?: {
    maxTimeAllowed?: number;
    input?: boolean;
    output?: boolean;
    yield?: boolean;
    next?: boolean;
  }
): SyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function Debug<
  //
  I extends AsyncGenerator.zInput,
  Y extends AsyncGenerator.zYield,
  N extends AsyncGenerator.zNext,
  O extends AsyncGenerator.zOutput,
  L,
  C extends Context
>(
  _params: AsyncGenerator._Params<I, Y, N, O, L, C>,
  behavior?: {
    maxTimeAllowed?: number;
    input?: boolean;
    output?: boolean;
    yield?: boolean;
    next?: boolean;
  }
): AsyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function Debug(
  _params: unknown,
  behavior: {
    maxTimeAllowed?: number;
    input?: boolean;
    output?: boolean;
    yield?: boolean;
    next?: boolean;
  } = {}
): WrapperBuild {
  const { type } = getParams(_params);
  let Wrapper: WrapperBuild | undefined;
  if (type === "function") {
    Wrapper = function (context, input, func, build) {
      const start = Date.now();
      try {
        if (behavior.input) context.log(build.getRef(), "input", input);
        const output = func(context, input);
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
          context.getStack()
        );
      }
    } satisfies SyncFunction.WrapperBuild;
  } else if (type === "async function") {
    Wrapper = async function (context, input, func, build) {
      const start = Date.now();
      try {
        if (behavior.input) context.log("input", input);
        const output = await func(context, input);
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
          context.getStack()
        );
      }
    } satisfies AsyncFunction.WrapperBuild;
  } else if (type === "async function*") {
    Wrapper = async function* (context, input, func, build) {
      const start = Date.now();
      try {
        if (behavior.input) context.log(build.getRef(), "input", input);
        const g = func(context, input);
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
          context.getStack()
        );
      }
    } satisfies AsyncGenerator.WrapperBuild;
  } else if (type === "function*") {
    Wrapper = function* (context, input, func, build) {
      const start = Date.now();
      try {
        if (behavior.input) context.log(build.getRef(), "input", input);
        const g = func(context, input);
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
          context.getStack()
        );
      }
    } satisfies SyncGenerator.WrapperBuild;
  } else {
    throw new Error("Unimplemented!");
  }
  assign(Wrapper, Debug);
  return Wrapper;
}
