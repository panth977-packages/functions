/**
 * Async Function builder
 * @module
 */
import type { z } from "zod";
import { type BuildContext, type Context, DefaultBuildContext } from "./context.ts";
import { unimplemented, wrap } from "../_helper.ts";

/**
 * Wrapper Type for Async Function
 */ export type WrapperBuild<
  I extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
  S = any,
  C extends Context = Context,
> = (
  context: C,
  input: I["_output"],
  func: (context: C, input: I["_output"]) => Promise<O["_input"]>,
  build: Build<I, O, S, C>,
) => Promise<O["_input"]>;
/**
 * Input Params for Async Function builder
 */ export type Params<
  I extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
  S = any,
  C extends Context = Context,
  W extends [] | [WrapperBuild<I, O, S, C>, ...WrapperBuild<I, O, S, C>[]] =
    | []
    | [WrapperBuild<I, O, S, C>, ...WrapperBuild<I, O, S, C>[]],
> = {
  namespace?: string;
  name?: string;
  input: I;
  output: O;
  static?: S;
  wrappers?: (_params: _Params<I, O, S, C>) => W;
  func?: (
    context: C,
    input: I["_output"],
    build: Build<I, O, S, C, W>,
  ) => Promise<O["_input"]>;
  buildContext?: BuildContext<C>;
};
/**
 * Params used for wrappers for type safe compatibility
 */ export type _Params<
  I extends z.ZodType = z.ZodType,
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
  output: O;
  static: undefined extends S ? undefined : S;
  type: "async function";
  buildContext: BuildContext<C extends unknown ? Context : C>;
};
/**
 * Build Type, Output of the Async Function builder
 */ export type Build<
  I extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
  S = any,
  C extends Context = Context,
  W extends [] | [WrapperBuild<I, O, S, C>, ...WrapperBuild<I, O, S, C>[]] =
    | []
    | [WrapperBuild<I, O, S, C>, ...WrapperBuild<I, O, S, C>[]],
> =
  & ((context: Context | string | null, input: I["_input"]) => Promise<O["_output"]>)
  & _Params<I, O, S, C>
  & { wrappers: W };

/**
 * A Async Function Builder
 * - This builder lets you define the schema for input & output
 * - Initialize local object to compile on global execution
 * - Context passthrough containing information about original trigger and custom log system
 * - Localized wrappers to wrap the implementation function around
 * @param params Input Params for Build
 * @returns Async Function Build
 *
 * @example
 * ```ts
 * const getUser = FUNCTIONS.AsyncFunction.build({
 *   input: z.object({userId: z.number().int().gt(0)}),
 *   output: z.object({name: z.string(),age: z.number()}).nullable(),
 *   static: {
 *     query: `SELECT * FROM users WHERE id = ? LIMIT 1`
 *   },
 *   wrappers: (params) => [
 *     FUNCTIONS.WRAPPERS.SafeParse(params, {input:true,output:false}),
 *   ],
 *   async func(context, {userId}, build) {
 *     const results = await db.query(build.static.query, [userId]);
 *     const userObj = results.rows[0];
 *     return userObj ?? null;
 *   }
 * });
 * ```
 */ export function build<
  I extends z.ZodType,
  O extends z.ZodType,
  S,
  C extends Context,
  W extends [] | [WrapperBuild<I, O, S, C>, ...WrapperBuild<I, O, S, C>[]],
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
      return `${params.namespace}['${params.name}']`;
    },
    input: params.input,
    output: params.output,
    type: "async function",
    static: params.static as never,
    buildContext: (params.buildContext ?? DefaultBuildContext) as never,
  };
  const func = (context: Context | string | null, input: I["_input"]) =>
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
