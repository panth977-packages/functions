/**
 * Sync Function builder
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
export type zOutput = z.ZodType;

/**
 * Wrapper Type for Sync Function
 */ export type WrapperBuild<
  I extends zInput = zInput,
  O extends zOutput = zOutput,
  S extends Record<never, never> = Record<never, never>,
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
  S extends Record<never, never> = Record<never, never>,
  C extends Context = Context
> = [] | [WrapperBuild<I, O, S, C>, ...WrapperBuild<I, O, S, C>[]];
/**
 * Input Params for Sync Function builder
 */ export type Params<
  I extends zInput = zInput,
  O extends zOutput = zOutput,
  S extends Record<never, never> = Record<never, never>,
  C extends Context = Context,
  W extends Wrappers<I, O, S, C> = Wrappers<I, O, S, C>
> = {
  namespace?: string;
  name?: string;
  input?: I;
  output?: O;
  wrappers?: (params: _Params<I, O, S, C>) => W;
  func?: (arg: {
    context: C;
    input: I["_output"];
    build: Build<I, O, S, C, W>;
  }) => O["_input"];
  buildContext?: BuildContext<C>;
  static?: S;
};
/**
 * Params used for wrappers for type safe compatibility
 */ export type _Params<
  I extends zInput = zInput,
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
    output: O;
    type: "function";
    buildContext: BuildContext<C extends unknown ? Context : C>;
  }
>;
/**
 * Build Type, Output of the Sync Function builder
 */ export type Build<
  I extends zInput = zInput,
  O extends zOutput = zOutput,
  S extends Record<never, never> = Record<never, never>,
  C extends Context = Context,
  W extends Wrappers<I, O, S, C> = Wrappers<I, O, S, C>
> = ((arg: inferArguments<I>) => O["_output"]) &
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
 *   memo: {} as Record<number, number>,
 *   wrappers: (_params) => [
 *     FUNCTIONS.WRAPPERS.SafeParse({_params, input:true, output:false}),
 *     function (context, input, func, build) {
 *       return build.memo[input] ??= func(context, input);
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
  S extends Record<never, never>,
  C extends Context,
  W extends Wrappers<I, O, S, C>
>({
  input: _input,
  output: _output,
  buildContext,
  func: _func,
  name: _name,
  namespace: _namespace,
  wrappers,
  static: others,
}: Params<I, O, S, C, W>): Build<I, O, S, C, W> {
  const _params: _Params<I, O, S, C> = {
    ...(others ?? ({})),
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
    type: "function",
    input: (_input ?? z.any()),
    output: (_output ?? z.any()),
    buildContext: (buildContext ?? DefaultContext.Builder),
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
