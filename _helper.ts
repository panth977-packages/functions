import type { Context } from "./functions/context.ts";
import type * as AsyncFunction from "./functions/async-function.ts";
import type * as SyncFunction from "./functions/sync-function.ts";
import type * as SyncGenerator from "./functions/sync-generator.ts";
import type * as AsyncGenerator from "./functions/async-generator.ts";
import type { z } from "zod";

export function wrap<C extends Context, I, R, B>(
  func: (arg: { context: C; input: I; build: B }) => R,
  wrapper:
    | null
    | ((arg: {
        context: C;
        input: I;
        func: (arg: { context: C; input: I; build: B }) => R;
        build: B;
      }) => R)
): (arg: { context: C; input: I; build: B }) => R {
  if (wrapper) {
    return ({ context, input, build }) =>
      wrapper({ context, input, func, build });
  }
  return func;
}

export const unimplemented = (() => {
  throw new Error("Unimplemented");
}) as never;

export function getParams(params: unknown) {
  if (typeof params !== "object" || !params || "type" in params == false) {
    throw new Error("Expected to be an object with [type] props");
  }
  if (params.type === "function") return params as SyncFunction._Params;
  if (params.type === "async function") return params as AsyncFunction._Params;
  if (params.type === "async function*") {
    return params as AsyncGenerator._Params;
  }
  if (params.type === "function*") return params as SyncGenerator._Params;
  throw new Error("Unimplemented!");
}
export function getBuild(build: unknown) {
  if (typeof build !== "function" || "type" in build == false) {
    throw new Error("Expected to be a function with [type] props");
  }
  if (build.type === "function") return build as SyncFunction.Build;
  if (build.type === "async function") return build as AsyncFunction.Build;
  if (build.type === "async function*") return build as AsyncGenerator.Build;
  if (build.type === "function*") return build as SyncGenerator.Build;
  throw new Error("Unimplemented!");
}

export type WrapperBuild =
  | AsyncFunction.WrapperBuild
  | AsyncGenerator.WrapperBuild
  | SyncFunction.WrapperBuild
  | SyncGenerator.WrapperBuild;

export type extendObject<A extends object, B extends object> = {
  [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
};

export type inferArguments<I extends z.ZodType> = {
  context: Context;
} & (I["_input"] extends undefined
  ? { input?: I["_input"] }
  : { input: I["_input"] });
