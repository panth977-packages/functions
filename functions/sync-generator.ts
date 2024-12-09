/**
 * Sync Generator builder
 * @module
 */
import { z } from "zod";
import { type BuildContext, type Context, DefaultContext } from "./context.ts";
import { unimplemented, wrap, type inferArguments } from "../_helper.ts";

export type zInput = z.ZodType;
export type zYield = z.ZodType;
export type zNext = z.ZodType;
export type zOutput = z.ZodType;

/**
 * Wrapper Type for Sync Generator
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
  }) => Generator<Y["_input"], O["_input"], N["_output"]>;
  build: Build<I, Y, N, O, S, C, any>;
}) => Generator<Y["_input"], O["_input"], N["_output"]>;
export type Wrappers<
  I extends zInput = zInput,
  Y extends zYield = zYield,
  N extends zNext = zNext,
  O extends zOutput = zOutput,
  S extends Record<never, never> = Record<never, never>,
  C extends Context = Context
> = [] | [WrapperBuild<I, Y, N, O, S, C>, ...WrapperBuild<I, Y, N, O, S, C>[]];
/**
 * Input Params for Sync Generator builder
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
  }) => Generator<Y["_input"], O["_input"], N["_output"]>;
  buildContext?: BuildContext<C>;
  static: S;
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
  type: "function*";
  buildContext: BuildContext<C extends unknown ? Context : C>;
} & S;
/**
 * Build Type, Output of the Sync Generator builder
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
 *   memo: {} as Record<number, number>,
 *   wrappers: (_params) => [
 *     FUNCTIONS.WRAPPERS.SafeParse({_params, input:true, output:false}),
 *   ],
 *   *func({context, input: limit, build}) {
 *     let n = 1;
 *     while (true) {
 *       const fibs = [];
 *       for (; limit > 0 ; limit--) {
 *         if (n <= 2) {
 *           fibs.push(1);
 *         } else {
 *           fibs.push((build.memo[n] ??= build.memo[n - 1] + build.memo[n - 2]));
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
  static: others
}: Params<I, Y, N, O, S, C, W>): Build<I, Y, N, O, S, C, W> {
  const _params: _Params<I, Y, N, O, S, C> = {
    getNamespace() {
      return `${_namespace}`;
    },
    setNamespace(namespace) {
      _namespace = namespace;
    },
    getName() {
      return `${_name}`;
    },
    setName(name) {
      _name = name;
    },
    getRef() {
      return `${_namespace}.${_name}`;
    },
    type: "function*",
    input: (_input ?? z.any()) as never,
    output: (_output ?? z.any()) as never,
    next: (_next ?? z.any()) as never,
    yield: (_yield ?? z.any()) as never,
    buildContext: (buildContext ?? DefaultContext.Builder) as never,
    ...(others ?? {} as never),
  };
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
