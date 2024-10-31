/**
 * Async Generator builder
 * @module
 */
import type { z } from "zod";
import { type BuildContext, type Context, DefaultBuildContext } from "./context.ts";
import { unimplemented, wrap } from "../_helper.ts";

/**
 * Wrapper Type for Async Generator
 */ export type WrapperBuild<
  I extends z.ZodType = z.ZodType,
  Y extends z.ZodType = z.ZodType,
  N extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
  S = any,
  C extends Context = Context,
> = (
  context: C,
  input: I["_output"],
  func: (
    context: C,
    input: I["_output"],
  ) => AsyncGenerator<Y["_input"], O["_input"], N["_output"]>,
  build: Build<I, Y, N, O, S, C>,
) => AsyncGenerator<Y["_input"], O["_input"], N["_output"]>;
/**
 * Input Params for Async Generator builder
 */ export type Params<
  I extends z.ZodType = z.ZodType,
  Y extends z.ZodType = z.ZodType,
  N extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
  S = any,
  C extends Context = Context,
  W extends
    | []
    | [WrapperBuild<I, Y, N, O, S, C>, ...WrapperBuild<I, Y, N, O, S, C>[]] =
      | []
      | [WrapperBuild<I, Y, N, O, S, C>, ...WrapperBuild<I, Y, N, O, S, C>[]],
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
    build: Build<I, Y, N, O, S, C, W>,
  ) => AsyncGenerator<Y["_input"], O["_input"], N["_output"]>;
  buildContext?: BuildContext<C>;
};
/**
 * Params used for wrappers for type safe compatibility
 */ export type _Params<
  I extends z.ZodType = z.ZodType,
  Y extends z.ZodType = z.ZodType,
  N extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
  S = any,
  C extends Context = Context,
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
  type: "async function*";
  buildContext: BuildContext<C extends unknown ? Context : C>;
};
/**
 * Build Type, Output of the Async Generator builder
 */ export type Build<
  I extends z.ZodType = z.ZodType,
  Y extends z.ZodType = z.ZodType,
  N extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
  S = any,
  C extends Context = Context,
  W extends
    | []
    | [WrapperBuild<I, Y, N, O, S, C>, ...WrapperBuild<I, Y, N, O, S, C>[]] =
      | []
      | [WrapperBuild<I, Y, N, O, S, C>, ...WrapperBuild<I, Y, N, O, S, C>[]],
> =
  & ((
    context: Context | string,
    input: I["_input"],
  ) => AsyncGenerator<Y["_output"], O["_output"], N["_input"]>)
  & _Params<I, Y, N, O, S, C>
  & { wrappers: W };

/**
 * A Async Generator Builder
 * - This builder lets you define the schema for input, yield, next & output
 * - Initialize local object to compile on global execution
 * - Context passthrough containing information about original trigger and custom log system
 * - Localized wrappers to wrap the implementation function around
 * @param params Input Params for Build
 * @returns Async Generator Build
 *
 * @example
 * ```ts
 * const getFriends = FUNCTIONS.AsyncGenerator.build({
 *   input: z.object({
 *     userId: z.number().int().gt(0),
 *     limit: z.number().int().gt(0),
 *   }),
 *   yield: z.object({ name: z.string(), age: z.number() }).array(),
 *   next: z.object({ limit: z.number().int().gt(0).optional() }).or(z.void()),
 *   output: z.void(),
 *   static: {
 *     query: `
 *       SELECT U.*
 *       FROM users U
 *       JOIN friends F ON F.user = ? AND F.fiend = U.id
 *       ORDER BY F.created_at
 *       OFFSET ?
 *       LIMIT ?
 *     `,
 *   },
 *   wrappers: (params) => [
 *     FUNCTIONS.WRAPPERS.SafeParse(params, {input:true,output:false}),
 *   ],
 *   async *func(context, { userId, limit }, build) {
 *     let results;
 *     let returnedCount = 0;
 *     do {
 *       results = await db.query(build.static.query, [userId, returnedCount, limit]);
 *       const next = yield results.rows;
 *       if (next?.limit) limit = next.limit;
 *       returnedCount += results.rows.length
 *     } while (results.rows.length);
 *   },
 * });
 * ```
 */ export function build<
  I extends z.ZodType,
  Y extends z.ZodType,
  N extends z.ZodType,
  O extends z.ZodType,
  S,
  C extends Context,
  W extends
    | []
    | [WrapperBuild<I, Y, N, O, S, C>, ...WrapperBuild<I, Y, N, O, S, C>[]],
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
    type: "async function*",
    next: params.next,
    yield: params.yield,
    static: params.static as never,
    buildContext: (params.buildContext ?? DefaultBuildContext) as never,
  };
  const func = (context: Context | string, input: I["_input"]) =>
    [...build.wrappers, null].reduceRight(wrap, params.func ?? unimplemented)(
      build.buildContext(context) as C,
      input,
      build,
    );
  const build = Object.assign(func, _params, {
    wrappers: params.wrappers?.(_params) ?? ([] as W),
  });
  return build;
}
