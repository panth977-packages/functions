/**
 * Parser Wrapper
 * @module
 */
import type z from "zod/v4";
import {
  type FuncDeclaration,
  type FuncInput,
  type FuncInvokeStack,
  type FuncOutput,
  type FuncTypes,
  GenericFuncWrapper,
} from "../functions/index.ts";
import type { Context } from "../functions/context.ts";
import type { Func } from "../functions/func.ts";
import type { T } from "@panth977/tools";

export class WFParser<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends GenericFuncWrapper<I, O, D, Type> {
  constructor(public input = true, public output = true, public time = false) {
    super();
  }
  static parseInput<T>(
    context: Context,
    time: boolean,
    input: T,
  ): T {
    const now = time ? Date.now() : 0;
    const func = (context.node) as Func<z.ZodType<T>, any, any, any>;
    const result = func.input.safeParse(input);
    if (now !== 0) context.logDebug(func.refString("Input"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) throw result.error;
    return result.data;
  }
  static parseOutput<T>(
    context: Context,
    time: boolean,
    output: T,
  ): T {
    const now = time ? Date.now() : 0;
    const func = (context.node) as Func<any, z.ZodType<T>, any, any>;
    const result = func.output.safeParse(output);
    if (now !== 0) context.logDebug(func.refString("Output"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) throw result.error;
    return result.data;
  }
  override SyncFunc(
    invokeStack: FuncInvokeStack<I, O, D, "SyncFunc">,
    context: Context<Func<I, O, D, "SyncFunc">>,
    input: z.core.output<I>,
  ): z.core.output<O> {
    if (this.input) {
      input = WFParser.parseInput(context, this.time, input);
    }
    let output = invokeStack.$(context, input);
    if (this.output) {
      output = WFParser.parseOutput(context, this.time, output);
    }
    return output;
  }
  override AsyncFunc(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncFunc">,
    context: Context<Func<I, O, D, "AsyncFunc">>,
    input: z.core.output<I>,
  ): T.PPromise<z.core.output<O>> {
    if (this.input) {
      input = WFParser.parseInput(context, this.time, input);
    }
    const promise = invokeStack.$(context, input);
    if (this.output) {
      return promise.then((WFParser.parseOutput<z.infer<O>>).bind(WFParser, context, this.time));
    }
    return promise;
  }
  protected override StreamFunc(
    invokeStack: FuncInvokeStack<I, O, D, "StreamFunc">,
    context: Context<Func<I, O, D, "StreamFunc">>,
    input: z.core.output<I>,
  ): T.PStream<z.core.output<O>> {
    if (this.input) {
      input = WFParser.parseInput(context, this.time, input);
    }
    const process = invokeStack.$(context, input);
    if (this.output) {
      return process.map((WFParser.parseOutput<z.infer<O>>).bind(WFParser, context, this.time), process.cancel.bind(process));
    }
    return process;
  }
  override ShouldIgnore(_: Func<I, O, D, Type>): boolean {
    return !this.input && !this.output;
  }
}
