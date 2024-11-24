/**
 * Sync Generator builder
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
export type zYield = z.ZodType;
export type zNext = z.ZodType;
export type zOutput = z.ZodType;
export type defaultZInput = z.ZodType;
export type defaultZYield = z.ZodType;
export type defaultZNext = z.ZodType;
export type defaultZOutput = z.ZodType;
/**
 * Wrapper Type for Sync Generator
 */ export type WrapperBuild<
  I extends zInput = defaultZInput,
  Y extends zYield = defaultZYield,
  N extends zNext = defaultZNext,
  O extends zOutput = defaultZOutput,
  S = any,
  C extends Context = Context
> = (
  context: C,
  input: I["_output"],
  func: (
    context: C,
    input: I["_output"]
  ) => Generator<Y["_input"], O["_input"], N["_output"]>,
  build: Build<I, Y, N, O, S, C>
) => Generator<Y["_input"], O["_input"], N["_output"]>;
export type Wrappers<
  I extends zInput = defaultZInput,
  Y extends zYield = defaultZYield,
  N extends zNext = defaultZNext,
  O extends zOutput = defaultZOutput,
  S = any,
  C extends Context = Context
> = [] | [WrapperBuild<I, Y, N, O, S, C>, ...WrapperBuild<I, Y, N, O, S, C>[]];
/**
 * Input Params for Sync Generator builder
 */ export type Params<
  I extends zInput = defaultZInput,
  Y extends zYield = defaultZYield,
  N extends zNext = defaultZNext,
  O extends zOutput = defaultZOutput,
  S = any,
  C extends Context = Context,
  W extends Wrappers<I, Y, N, O, S, C> = Wrappers<I, Y, N, O, S, C>
> = {
  namespace?: string;
  name?: string;
  input: I;
  yield: Y;
  next: N;
  output: O;
  static?: S;
  wrappers?: (_params: _Params<I, Y, N, O, S, C>) => W;
  func?: (
    context: C,
    input: I["_output"],
    build: Build<I, Y, N, O, S, C, W>
  ) => Generator<Y["_input"], O["_input"], N["_output"]>;
  buildContext?: BuildContext<C>;
};
/**
 * Params used for wrappers for type safe compatibility
 */ export type _Params<
  I extends zInput = defaultZInput,
  Y extends zYield = defaultZYield,
  N extends zNext = defaultZNext,
  O extends zOutput = defaultZOutput,
  S = any,
  C extends Context = Context
> = {
  getNamespace(): string;
  setNamespace(namespace: string): void;
  getName(): string;
  setName(name: string): void;
  getRef(): string;
  input: I;
  yield: Y;
  next: N;
  output: O;
  static: undefined extends S ? undefined : S;
  type: "function*";
  buildContext: BuildContext<C extends unknown ? Context : C>;
};
/**
 * Build Type, Output of the Sync Generator builder
 */ export type Build<
  I extends zInput = defaultZInput,
  Y extends zYield = defaultZYield,
  N extends zNext = defaultZNext,
  O extends zOutput = defaultZOutput,
  S = any,
  C extends Context = Context,
  W extends Wrappers<I, Y, N, O, S, C> = Wrappers<I, Y, N, O, S, C>
> = ((
  context: Context | string | null,
  input: I["_input"]
) => Generator<Y["_output"], O["_output"], N["_input"]>) &
  _Params<I, Y, N, O, S, C> & { wrappers: W };

/**
 * A Sync Generator Builder
 * - This builder lets you define the schema for input, yield, next & output
 * - Initialize local object to compile on global execution
 * - Context passthrough containing information about original trigger and custom log system
 * - Localized wrappers to wrap the implementation function around
 * @param params Input Params for Build
 * @returns Sync Generator Build
 *
 * @example
 * ```ts
 * const getFibs = FUNCTIONS.SyncGenerator.build({
 *   input: z.number().int().gt(0),
 *   yield: z.number().array(),
 *   next: z.number().int().gt(0).or(z.void()).optional(),
 *   output: z.void(),
 *   static: {
 *     memo: {} as Record<number, number>,
 *   },
 *   wrappers: (params) => [
 *     FUNCTIONS.WRAPPERS.SafeParse(params, {input:true,output:false}),
 *   ],
 *   *func(context, limit, build) {
 *     let n = 1;
 *     while (true) {
 *       const fibs = [];
 *       for (; limit > 0 ; limit--) {
 *         if (n <= 2) {
 *           fibs.push(1);
 *         } else {
 *           fibs.push((build.static.memo[n] ??= build.static.memo[n - 1] + build.static.memo[n - 2]));
 *         }
 *         n++;
 *       }
 *       const next = yield fibs;
 *       if (!next) break;
 *       limit = next;
 *     }
 *   }
 * });
 * ```
 */ export function build<
  I extends zInput,
  Y extends zYield,
  N extends zNext,
  O extends zOutput,
  S,
  C extends Context,
  W extends Wrappers<I, Y, N, O, S, C>
>(params: Params<I, Y, N, O, S, C, W>): Build<I, Y, N, O, S, C, W> {
  const _params: _Params<I, Y, N, O, S, C> = {
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
      return `${params.namespace}['${params.name}']`;
    },
    input: params.input,
    output: params.output,
    type: "function*",
    next: params.next,
    yield: params.yield,
    static: params.static as never,
    buildContext: (params.buildContext ?? DefaultBuildContext) as never,
  };
  const func = (context: Context | string | null, input: I["_input"]) =>
    [...build.wrappers, null].reduceRight(wrap, params.func ?? unimplemented)(
      build.buildContext(context) as C,
      input,
      build
    );
  const build = Object.assign(func, _params, {
    wrappers: params.wrappers?.(_params) ?? ([] as W),
  });
  return build;
}
