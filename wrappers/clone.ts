import type { z } from "zod";
import type { AsyncFunction, AsyncGenerator, Context, SyncFunction, SyncGenerator } from "../functions.ts";
import { getParams, type WrapperBuild } from "../_helper.ts";
import { assign } from "./instance.ts";

export function CloneData<
  //
  I extends z.ZodType,
  O extends z.ZodType,
  L,
  C extends Context,
>(
  params: AsyncFunction._Params<I, O, L, C>,
  behavior?: { input?: boolean; output?: boolean },
): AsyncFunction.WrapperBuild<I, O, L, C>;
export function CloneData<
  //
  I extends z.ZodType,
  O extends z.ZodType,
  L,
  C extends Context,
>(
  params: SyncFunction._Params<I, O, L, C>,
  behavior?: { input?: boolean; output?: boolean },
): SyncFunction.WrapperBuild<I, O, L, C>;
export function CloneData<
  //
  I extends z.ZodType,
  Y extends z.ZodType,
  N extends z.ZodType,
  O extends z.ZodType,
  L,
  C extends Context,
>(
  params: SyncGenerator._Params<I, Y, N, O, L, C>,
  behavior?: {
    input?: boolean;
    output?: boolean;
    yield?: boolean;
    next?: boolean;
  },
): SyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function CloneData<
  //
  I extends z.ZodType,
  Y extends z.ZodType,
  N extends z.ZodType,
  O extends z.ZodType,
  L,
  C extends Context,
>(
  params: AsyncGenerator._Params<I, Y, N, O, L, C>,
  behavior?: {
    input?: boolean;
    output?: boolean;
    yield?: boolean;
    next?: boolean;
  },
): AsyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function CloneData(
  params_: unknown,
  behavior: {
    input?: boolean;
    output?: boolean;
    yield?: boolean;
    next?: boolean;
  } = {},
):
  | AsyncFunction.WrapperBuild
  | SyncFunction.WrapperBuild
  | AsyncGenerator.WrapperBuild
  | SyncGenerator.WrapperBuild {
  const params = getParams(params_);
  let Wrapper: WrapperBuild | undefined;
  if (params.type === "function") {
    Wrapper = function (context, input, func) {
      if (behavior.input ?? true) input = structuredClone(input);
      let output = func(context, input);
      if (behavior.output ?? true) output = structuredClone(output);
      return output;
    } satisfies SyncFunction.WrapperBuild;
  } else if (params.type === "async function") {
    Wrapper = async function (context, input, func) {
      if (behavior.input ?? true) input = structuredClone(input);
      let output = await func(context, input);
      if (behavior.output ?? true) output = structuredClone(output);
      return output;
    } satisfies AsyncFunction.WrapperBuild;
  } else if (params.type === "async function*") {
    Wrapper = async function* (context, input, func) {
      if (behavior.input ?? true) input = structuredClone(input);
      const g = func(context, input);
      let val = await g.next();
      while (!val.done) {
        let y = val.value;
        if (behavior.yield ?? true) y = structuredClone(y);
        let next = yield y;
        if (behavior.next ?? true) next = structuredClone(next);
        val = await g.next(next);
      }
      let output = val.value;
      if (behavior.output ?? true) output = structuredClone(output);
      return output;
    } satisfies AsyncGenerator.WrapperBuild;
  } else if (params.type === "function*") {
    Wrapper = function* (context, input, func) {
      if (behavior.input ?? true) input = structuredClone(input);
      const g = func(context, input);
      let val = g.next();
      while (!val.done) {
        let y = val.value;
        if (behavior.yield ?? true) y = structuredClone(y);
        let next = yield y;
        if (behavior.next ?? true) next = structuredClone(next);
        val = g.next(next);
      }
      let output = val.value;
      if (behavior.output ?? true) output = structuredClone(output);
      return output;
    } satisfies SyncGenerator.WrapperBuild;
  } else {
    throw new Error("Unimplemented!");
  }
  assign(Wrapper, CloneData);
  return Wrapper;
}
