import {
  type BuildContext,
  type Context,
  DefaultBuildContext,
} from "./context.ts";
import type * as AsyncFunction from "./async.ts";
import type * as SyncFunction from "./sync.ts";
import type * as SyncGenerator from "./sync-generator.ts";
import type * as AsyncGenerator from "./async-generator.ts";

export function Builder<P, I, R>({
  params,
  wrappers,
  buildContext,
  func = function () {
    throw new Error("Unimplemented");
  },
}: {
  params: P;
  wrappers?: ((
    context: Context,
    input: I,
    func: (context: Context, input: I) => R,
  ) => R)[];
  func?: (context: Context, input: I) => R;
  buildContext?: (context: Context | string) => Context;
}) {
  return (context: Context | string, input: I): R =>
    [...(wrappers ?? []), null].reduceRight<(context: Context, input: I) => R>(
      function (func, wrapper) {
        if (wrapper) {
          return (context, input): R => wrapper(context, input, func);
        }
        return (context, input) => func(context, input);
      },
      func,
    )(
      Object.assign((buildContext ?? DefaultBuildContext)(context), {
        params: params,
      } as never),
      input,
    );
}

export function BuildContextWithParamsBuilder<P, C extends Context>(
  params: P,
  buildContext: BuildContext<C>,
  ...args: Parameters<BuildContext<C & { params: P }>>
): ReturnType<BuildContext<C & { params: P }>> {
  return Object.assign(buildContext(...args), { params: params });
}

export function wrap<C extends Context, I, R>(
  func: (context: C, input: I) => R,
  wrapper:
    | null
    | ((context: C, input: I, func: (context: C, input: I) => R) => R),
): (context: C, input: I) => R {
  if (wrapper) {
    return (context, input) => wrapper(context, input, func);
  }
  return (context, input) => func(context, input);
}

export function unimplemented<C extends Context, I, R>(
  _context: C,
  _input: I,
): R {
  throw new Error("Unimplemented");
}

export function getParams(params: unknown) {
  if (
    typeof params === "object" &&
    params &&
    "type" in params &&
    params.type === "function"
  ) {
    return params as SyncFunction.Params;
  }
  if (
    typeof params === "object" &&
    params &&
    "type" in params &&
    params.type === "async function"
  ) {
    return params as AsyncFunction.Params;
  }
  if (
    typeof params === "object" &&
    params &&
    "type" in params &&
    params.type === "async function*"
  ) {
    return params as AsyncGenerator.Params;
  }
  if (
    typeof params === "object" &&
    params &&
    "type" in params &&
    params.type === "function*"
  ) {
    return params as SyncGenerator.Params;
  }
  throw new Error("Unimplemented!");
}
export function getBuild(build: unknown) {
  if (
    typeof build === "function" &&
    "type" in build &&
    build.type === "function"
  ) {
    return build as SyncFunction.Build;
  }
  if (
    typeof build === "function" &&
    "type" in build &&
    build.type === "async function"
  ) {
    return build as AsyncFunction.Build;
  }
  if (
    typeof build === "function" &&
    "type" in build &&
    build.type === "async function*"
  ) {
    return build as AsyncGenerator.Build;
  }
  if (
    typeof build === "function" &&
    "type" in build &&
    build.type === "function*"
  ) {
    return build as SyncGenerator.Build;
  }
  throw new Error("Unimplemented!");
}
export type WrapperBuild =
  | AsyncFunction.WrapperBuild
  | SyncFunction.WrapperBuild
  | AsyncGenerator.WrapperBuild
  | SyncGenerator.WrapperBuild;
