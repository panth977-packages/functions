/**
 * Parser Wrapper
 * @module
 */
import type z from "zod";
import { type Func, type FuncInput, type FuncInvokeStack, type FuncOutput, type FuncTypes, GenericFuncWrapper } from "../func.ts";
import type { Context } from "../context.ts";
import type { T } from "@panth977/tools";

export class WFParser<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> extends GenericFuncWrapper<I, O, Type> {
  constructor(
    public input = true,
    public output = true,
    public time = false,
  ) {
    super();
  }
  static parseInput<T>(context: Context<Func<any, any, any>>, time: boolean, input: T): T {
    const now = time ? Date.now() : 0;
    const func = context.node;
    const result = func.input.safeParse(input, { path: [func.refString("Input")] });
    if (now !== 0) {
      context.logDebug(
        func.refString("Input"),
        `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`,
      );
    }
    if (!result.success) throw result.error;
    return result.data;
  }
  static parseOutput<T>(context: Context, time: boolean, output: T): T {
    const now = time ? Date.now() : 0;
    const func = context.node as Func<any, z.ZodType<T>, any>;
    const result = func.output.safeParse(output, { path: [func.refString("Output")] });
    if (now !== 0) {
      context.logDebug(
        func.refString("Output"),
        `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`,
      );
    }
    if (!result.success) throw result.error;
    return result.data;
  }
  override SyncFunc(
    invokeStack: FuncInvokeStack<I, O, "SyncFunc">,
    context: Context<Func<I, O, "SyncFunc">>,
    input: z.infer<I>,
  ): z.infer<O> {
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
    invokeStack: FuncInvokeStack<I, O, "AsyncFunc">,
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
  ): T.PPromise<z.infer<O>> {
    if (this.input) {
      input = WFParser.parseInput(context, this.time, input);
    }
    const promise = invokeStack.$(context, input);
    if (this.output) {
      return promise.then(
        (WFParser.parseOutput<z.infer<O>>).bind(WFParser, context, this.time),
      );
    }
    return promise;
  }
  protected override StreamFunc(
    invokeStack: FuncInvokeStack<I, O, "StreamFunc">,
    context: Context<Func<I, O, "StreamFunc">>,
    input: z.infer<I>,
  ): T.PStream<z.infer<O>> {
    if (this.input) {
      input = WFParser.parseInput(context, this.time, input);
    }
    const process = invokeStack.$(context, input);
    if (this.output) {
      return process.map(
        (WFParser.parseOutput<z.infer<O>>).bind(WFParser, context, this.time),
        process.cancel.bind(process),
      );
    }
    return process;
  }
  override ShouldIgnore(_: Func<I, O, Type>): boolean {
    return !this.input && !this.output;
  }
}
