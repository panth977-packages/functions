import type { Context } from "./functions/context.ts";
import type * as AsyncFunction from "./functions/async-function.ts";
import type * as SyncFunction from "./functions/sync-function.ts";
import type * as SyncGenerator from "./functions/sync-generator.ts";
import type * as AsyncGenerator from "./functions/async-generator.ts";

export function wrap<C extends Context, I, R, B>(
  func: (context: C, input: I, build: B) => R,
  wrapper:
    | null
    | ((context: C, input: I, func: (context: C, input: I) => R, build: B) => R),
): (context: C, input: I, build: B) => R {
  if (wrapper) {
    return (context, input, build) =>
      wrapper(
        context,
        input,
        (context, input) => func(context, input, build),
        build,
      );
  }
  return (context, input, build) => func(context, input, build);
}

export function unimplemented<C extends Context, I, R, B>(
  _context: C,
  _input: I,
  _build: B,
): R {
  throw new Error("Unimplemented");
}

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
