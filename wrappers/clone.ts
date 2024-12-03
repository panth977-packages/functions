import type {
  AsyncFunction,
  AsyncGenerator,
  Context,
  SyncFunction,
  SyncGenerator,
} from "../functions/index.ts";
import { getParams, type WrapperBuild } from "../_helper.ts";
import { assign } from "./_helper.ts";

export function CloneData<
  //
  I extends AsyncFunction.zInput,
  O extends AsyncFunction.zOutput,
  L,
  C extends Context
>(arg: {
  _params: AsyncFunction._Params<I, O, L, C>;
  input?: boolean;
  output?: boolean;
}): AsyncFunction.WrapperBuild<I, O, L, C>;
export function CloneData<
  //
  I extends SyncFunction.zInput,
  O extends SyncFunction.zOutput,
  L,
  C extends Context
>(arg: {
  _params: SyncFunction._Params<I, O, L, C>;
  input?: boolean;
  output?: boolean;
}): SyncFunction.WrapperBuild<I, O, L, C>;
export function CloneData<
  //
  I extends SyncGenerator.zInput,
  Y extends SyncGenerator.zYield,
  N extends SyncGenerator.zNext,
  O extends SyncGenerator.zOutput,
  L,
  C extends Context
>(arg: {
  _params: SyncGenerator._Params<I, Y, N, O, L, C>;

  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): SyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function CloneData<
  //
  I extends AsyncGenerator.zInput,
  Y extends AsyncGenerator.zYield,
  N extends AsyncGenerator.zNext,
  O extends AsyncGenerator.zOutput,
  L,
  C extends Context
>(arg: {
  _params: AsyncGenerator._Params<I, Y, N, O, L, C>;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}): AsyncGenerator.WrapperBuild<I, Y, N, O, L, C>;
export function CloneData({
  _params,
  ...behavior
}: {
  _params: unknown;
  input?: boolean;
  output?: boolean;
  yield?: boolean;
  next?: boolean;
}):
  | AsyncFunction.WrapperBuild
  | SyncFunction.WrapperBuild
  | AsyncGenerator.WrapperBuild
  | SyncGenerator.WrapperBuild {
  const { type } = getParams(_params);
  let Wrapper: WrapperBuild | undefined;
  if (type === "function") {
    Wrapper = function ({ context, input, func, build }) {
      if (behavior.input ?? true) input = structuredClone(input);
      let output = func({ context, input, build });
      if (behavior.output ?? true) output = structuredClone(output);
      return output;
    } satisfies SyncFunction.WrapperBuild;
  } else if (type === "async function") {
    Wrapper = async function ({ context, input, func, build }) {
      if (behavior.input ?? true) input = structuredClone(input);
      let output = await func({ context, input, build });
      if (behavior.output ?? true) output = structuredClone(output);
      return output;
    } satisfies AsyncFunction.WrapperBuild;
  } else if (type === "async function*") {
    Wrapper = async function* ({ context, input, func, build }) {
      if (behavior.input ?? true) input = structuredClone(input);
      const g = func({ context, input, build });
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
  } else if (type === "function*") {
    Wrapper = function* ({ context, input, func, build }) {
      if (behavior.input ?? true) input = structuredClone(input);
      const g = func({ context, input, build });
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
