/**
 * Async Generator builder
 * @module
 */
import { z } from "zod";
import { type BuildContext, type Context, DefaultContext } from "./context.ts";
import {
  unimplemented,
  wrap,
  type extendObject,
  type inferArguments,
} from "../_helper.ts";

export type zInput = z.ZodType;
export type zYield = z.ZodType;
export type zNext = z.ZodType;
export type zOutput = z.ZodType;

/**
 * Wrapper Type for Async Generator
 */ export type WrapperBuild<
  I extends zInput = zInput,
  Y extends zYield = zYield,
  N extends zNext = zNext,
  O extends zOutput = zOutput,
  S extends Record<never, never> = Record<never, never>,
  C extends Context = Context
> = (arg: {
  context: C;
  input: I["_output"];
  func: (arg: {
    context: C;
    input: I["_output"];
    build: Build<I, Y, N, O, S, C, any>;
  }) => AsyncGenerator<Y["_input"], O["_input"], N["_output"]>;
  build: Build<I, Y, N, O, S, C, any>;
}) => AsyncGenerator<Y["_input"], O["_input"], N["_output"]>;
export type Wrappers<
  I extends zInput = zInput,
  Y extends zYield = zYield,
  N extends zNext = zNext,
  O extends zOutput = zOutput,
  S extends Record<never, never> = Record<never, never>,
  C extends Context = Context
> = [] | [WrapperBuild<I, Y, N, O, S, C>, ...WrapperBuild<I, Y, N, O, S, C>[]];
/**
 * Input Params for Async Generator builder
 */ export type Params<
  I extends zInput = zInput,
  Y extends zYield = zYield,
  N extends zNext = zNext,
  O extends zOutput = zOutput,
  S extends Record<never, never> = Record<never, never>,
  C extends Context = Context,
  W extends Wrappers<I, Y, N, O, S, C> = Wrappers<I, Y, N, O, S, C>
> = {
  namespace?: string;
  name?: string;
  input?: I;
  yield?: Y;
  next?: N;
  output?: O;
  wrappers?: (_params: _Params<I, Y, N, O, S, C>) => W;
  func?: (arg: {
    context: C;
    input: I["_output"];
    build: Build<I, Y, N, O, S, C, W>;
  }) => AsyncGenerator<Y["_input"], O["_input"], N["_output"]>;
  buildContext?: BuildContext<C>;
  static?: S;
};
/**
 * Params used for wrappers for type safe compatibility
 */ export type _Params<
  I extends zInput = zInput,
  Y extends zYield = zYield,
  N extends zNext = zNext,
  O extends zOutput = zOutput,
  S extends Record<never, never> = Record<never, never>,
  C extends Context = Context
> = extendObject<
  S,
  {
    getNamespace(): string;
    setNamespace(namespace: string): void;
    getName(): string;
    setName(name: string): void;
    getRef(): string;
    input: I;
    yield: Y;
    next: N;
    output: O;
    type: "async function*";
    buildContext: BuildContext<C extends unknown ? Context : C>;
  }
>;
/**
 * Build Type, Output of the Async Generator builder
 */ export type Build<
  I extends zInput = zInput,
  Y extends zYield = zYield,
  N extends zNext = zNext,
  O extends zOutput = zOutput,
  S extends Record<never, never> = Record<never, never>,
  C extends Context = Context,
  W extends Wrappers<I, Y, N, O, S, C> = Wrappers<I, Y, N, O, S, C>
> = ((
  arg: inferArguments<I>
) => AsyncGenerator<Y["_output"], O["_output"], N["_input"]>) &
  _Params<I, Y, N, O, S, C> & { wrappers: W };

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
 *   query: `
 *     SELECT U.*
 *     FROM users U
 *     JOIN friends F ON F.user = ? AND F.fiend = U.id
 *     ORDER BY F.created_at
 *     OFFSET ?
 *     LIMIT ?
 *   `,
 *   wrappers: (_params) => [
 *     FUNCTIONS.WRAPPERS.SafeParse({_params, input:true, output:false}),
 *   ],
 *   async *func({context, input: { userId, limit }, build}) {
 *     let results;
 *     let returnedCount = 0;
 *     do {
 *       results = await db.query(build.query, [userId, returnedCount, limit]);
 *       const next = yield results.rows;
 *       if (next?.limit) limit = next.limit;
 *       returnedCount += results.rows.length
 *     } while (results.rows.length);
 *   },
 * });
 * ```
 */ export function build<
  I extends zInput,
  Y extends zYield,
  N extends zNext,
  O extends zOutput,
  S extends Record<never, never>,
  C extends Context,
  W extends Wrappers<I, Y, N, O, S, C>
>({
  buildContext,
  func: _func,
  name: _name,
  namespace: _namespace,
  input: _input,
  yield: _yield,
  next: _next,
  output: _output,
  wrappers,
  static: others,
}: Params<I, Y, N, O, S, C, W>): Build<I, Y, N, O, S, C, W> {
  const _params: _Params<I, Y, N, O, S, C> = {
    ...(others ?? {}),
    getNamespace() {
      return `${_namespace}`;
    },
    setNamespace(namespace: string) {
      _namespace = namespace;
    },
    getName() {
      return `${_name}`;
    },
    setName(name: string) {
      _name = name;
    },
    getRef() {
      return `${_namespace}.${_name}`;
    },
    type: "async function*",
    input: _input ?? z.any(),
    output: _output ?? z.any(),
    next: _next ?? z.any(),
    yield: _yield ?? z.any(),
    buildContext: buildContext ?? DefaultContext.Builder,
  } as never;
  const func = ({ input, context }: inferArguments<I>) => {
    const c = build.buildContext.fromParent(context, build.getRef()) as C;
    const fn = [...build.wrappers, null].reduceRight(
      wrap,
      _func ?? unimplemented
    );
    return fn({ context: c, input, build });
  };
  const build = Object.assign(func, _params, {
    wrappers: wrappers?.(_params) ?? ([] as W),
  });
  return build;
}
