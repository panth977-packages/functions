/**
 * Sync Function builder
 * @module
 */
import type { z } from "zod";
import {
  type BuildContext,
  type Context,
  DefaultBuildContext,
} from "./context.ts";
import { unimplemented, wrap } from "../_helper.ts";

export type zInput = z.ZodType;
export type zOutput = z.ZodType;

/**
 * Wrapper Type for Sync Function
 */ export type WrapperBuild<
  I extends zInput = zInput,
  O extends zOutput = zOutput,
  S = any,
  C extends Context = Context
> = (arg: {
  context: C;
  input: I["_output"];
  func: (arg: {
    context: C;
    input: I["_output"];
    build: Build<I, O, S, C, any>;
  }) => O["_input"];
  build: Build<I, O, S, C, any>;
}) => O["_input"];
export type Wrappers<
  I extends zInput = zInput,
  O extends zOutput = zOutput,
  S = any,
  C extends Context = Context
> = [] | [WrapperBuild<I, O, S, C>, ...WrapperBuild<I, O, S, C>[]];
/**
 * Input Params for Sync Function builder
 */ export type Params<
  I extends zInput = zInput,
  O extends zOutput = zOutput,
  S = any,
  C extends Context = Context,
  W extends Wrappers<I, O, S, C> = Wrappers<I, O, S, C>
> = {
  namespace?: string;
  name?: string;
  input: I;
  output: O;
  static?: S;
  wrappers?: (params: _Params<I, O, S, C>) => W;
  func?: (arg: {
    context: C;
    input: I["_output"];
    build: Build<I, O, S, C, W>;
  }) => O["_input"];
  buildContext?: BuildContext<C>;
};
/**
 * Params used for wrappers for type safe compatibility
 */ export type _Params<
  I extends zInput = zInput,
  O extends zOutput = zOutput,
  S = any,
  C extends Context = Context
> = {
  getNamespace(): string;
  setNamespace(namespace: string): void;
  getName(): string;
  setName(name: string): void;
  getRef(): string;
  input: I;
  output: O;
  static: undefined extends S ? undefined : S;
  type: "function";
  buildContext: BuildContext<C extends unknown ? Context : C>;
};
/**
 * Build Type, Output of the Sync Function builder
 */ export type Build<
  I extends zInput = zInput,
  O extends zOutput = zOutput,
  S = any,
  C extends Context = Context,
  W extends Wrappers<I, O, S, C> = Wrappers<I, O, S, C>
> = ((arg: {
  context?: Context | string | null;
  input: I["_input"];
}) => O["_output"]) &
  _Params<I, O, S, C> & { wrappers: W };

/**
 * A Sync Function Builder
 * - This builder lets you define the schema for input & output
 * - Initialize local object to compile on global execution
 * - Context passthrough containing information about original trigger and custom log system
 * - Localized wrappers to wrap the implementation function around
 * @param params Input Params for Build
 * @returns Sync Function Build
 *
 * @example
 * ```ts
 * const fib = FUNCTIONS.SyncFunction.build({
 *   input: z.number().int().gt(0),
 *   output: z.number(),
 *   static: {
 *     memo: {} as Record<number, number>,
 *   },
 *   wrappers: (_params) => [
 *     FUNCTIONS.WRAPPERS.SafeParse({_params, input:true, output:false}),
 *     function (context, input, func, build) {
 *       return build.static.memo[input] ??= func(context, input);
 *     }
 *   ],
 *   func({context, input: num, build}) {
 *     if (num <= 2) return 1;
 *     return build(context, num - 1) + build(context, num - 2);
 *   }
 * });
 * ```
 */ export function build<
  I extends zInput,
  O extends zOutput,
  S,
  C extends Context,
  W extends Wrappers<I, O, S, C>
>(params: Params<I, O, S, C, W>): Build<I, O, S, C, W> {
  const _params: _Params<I, O, S, C> = {
    getNamespace() {
      return `${params.namespace}`;
    },
    setNamespace(namespace) {
      params.namespace = namespace;
    },
    getName() {
      return `${params.name}`;
    },
    setName(name) {
      params.name = name;
    },
    getRef() {
      return `${params.namespace}.${params.name}`;
    },
    input: params.input,
    output: params.output,
    type: "function",
    static: params.static as never,
    buildContext: (params.buildContext ?? DefaultBuildContext) as never,
  };
  const func = ({
    input,
    context,
  }: {
    context?: Context | string | null;
    input: I["_input"];
  }) => {
    const c = build.buildContext(context) as C;
    const fn = [...build.wrappers, null].reduceRight(
      wrap,
      params.func ?? unimplemented
    );
    c.path.push(build.getRef());
    return fn({ context: c, input, build });
  };
  const build = Object.assign(func, _params, {
    wrappers: params.wrappers?.(_params) ?? ([] as W),
  });
  return build;
}
