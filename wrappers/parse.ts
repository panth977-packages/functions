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
import type { AsyncCbReceiver } from "../functions/handle_async.ts";
import type { SubsCbReceiver } from "../functions/handle_subs.ts";

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
  ): Promise<z.core.output<O>> {
    if (this.input) {
      input = WFParser.parseInput(context, this.time, input);
    }
    let promise = invokeStack.$(context, input);
    if (this.output) {
      promise = promise.then((WFParser.parseOutput<z.infer<O>>).bind(WFParser, context, this.time));
    }
    return promise;
  }
  override AsyncCb(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncCb">,
    context: Context<Func<I, O, D, "AsyncCb">>,
    input: z.core.output<I>,
  ): AsyncCbReceiver<z.core.output<O>> {
    if (this.input) {
      input = WFParser.parseInput(context, this.time, input);
    }
    let process = invokeStack.$(context, input);
    if (this.output) {
      process = process.pipeThen((WFParser.parseOutput<z.infer<O>>).bind(WFParser, context, this.time));
    }
    return process;
  }
  override SubsCb(
    invokeStack: FuncInvokeStack<I, O, D, "SubsCb">,
    context: Context<Func<I, O, D, "SubsCb">>,
    input: z.core.output<I>,
  ): SubsCbReceiver<z.core.output<O>> {
    if (this.input) {
      input = WFParser.parseInput(context, this.time, input);
    }
    let process = invokeStack.$(context, input);
    if (this.output) {
      process = process.pipeEmit((WFParser.parseOutput<z.infer<O>>).bind(WFParser, context, this.time));
    }
    return process;
  }
  override ShouldIgnore(_: Func<I, O, D, Type>): boolean {
    return !this.input && !this.output;
  }
}
