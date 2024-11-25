import type { AsyncFunction, Context, SyncFunction } from "../functions/index.ts";
import { getParams, type WrapperBuild } from "../_helper.ts";
import { assign } from "./_helper.ts";

export function MemoData<
  I extends AsyncFunction.zInput,
  O extends AsyncFunction.zOutput,
  L,
  C extends Context
>(
  _params: AsyncFunction._Params<I, O, L, C>,
  behavior: { getKey(input: I["_output"]): string | null; expSec: number }
): AsyncFunction.WrapperBuild<I, O, L, C>;
export function MemoData<
  I extends SyncFunction.zInput,
  O extends SyncFunction.zOutput,
  L,
  C extends Context
>(
  _params: SyncFunction._Params<I, O, L, C>,
  behavior: { getKey(input: I["_output"]): string | null; expSec: number }
): SyncFunction.WrapperBuild<I, O, L, C>;
export function MemoData(
  _params: unknown,
  behavior: { getKey(input: unknown): string | null; expSec: number }
): WrapperBuild {
  const { type } = getParams(_params);
  const cache: Record<string, unknown> = {};
  let Wrapper: WrapperBuild | undefined;
  if (type === "function") {
    Wrapper = function (context, input, func) {
      const key = behavior.getKey(input);
      if (key === null) return func(context, input);
      if (key in cache === false) {
        cache[key] = func(context, input);
        setTimeout(() => delete cache[key], behavior.expSec * 1000);
      }
      return cache[key];
    } satisfies SyncFunction.WrapperBuild;
  } else if (type === "async function") {
    Wrapper = async function (context, input, func) {
      const key = behavior.getKey(input);
      if (key === null) return func(context, input);
      if (key in cache === false) {
        cache[key] = func(context, input);
        setTimeout(() => delete cache[key], behavior.expSec * 1000);
      }
      return await cache[key];
    } satisfies AsyncFunction.WrapperBuild;
  } else {
    throw new Error("Unimplemented!");
  }
  assign(Wrapper, MemoData);
  return Wrapper;
}
