/**
 * Parser Wrapper
 * @module
 */
import type z from "zod/v4";
import { FuncWrapper } from "../functions/func.ts";
import {
  type Callback,
  type CallbackInvokeStack,
  CallbackWrapper,
  type Context,
  type Func,
  type FuncInvokeStack,
  type zCallbackCancel,
  type zCallbackHandler,
  type zCallbackInput,
  type zCallbackOutput,
  type zFuncInput,
  type zFuncOutput,
  type zFuncReturn,
} from "../functions/index.ts";

export class FuncSafeParse<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>, Async extends boolean>
  extends FuncWrapper<I, O, D, Async> {
  private input: boolean;
  private output: boolean;
  private time: boolean;
  constructor({ input = true, output = true, time = false } = {}) {
    super();
    this.input = input;
    this.output = output;
    this.time = time;
  }
  getOptions(): { input: boolean; output: boolean; time: boolean } {
    return { input: this.input, output: this.output, time: this.time };
  }
  setOptions({ input, output, time }: { input?: boolean; output?: boolean; time?: boolean }): void {
    this.input = input ?? this.input;
    this.output = output ?? this.output;
    this.time = time ?? this.time;
  }

  private parseInput(context: Context<Func<I, O, D, Async>>, input: z.infer<I>): z.infer<I> {
    if (!this.input) return input;
    const now = Date.now();
    const result = context.node.input.safeParse(input);
    if (this.time) context.logDebug(context.node.refString("Input"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) throw result.error;
    return result.data;
  }

  private parseOutput(context: Context<Func<I, O, D, Async>>, output: z.infer<O>): z.infer<O> {
    if (!this.output) return output;
    const now = Date.now();
    const result = context.node.output.safeParse(output);
    if (this.time) context.logDebug(context.node.refString("Output"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) throw result.error;
    return result.data;
  }

  private createAsyncThenHandler(context: Context<Func<I, O, D, Async>>) {
    return (output: z.infer<O>) => {
      output = this.parseOutput(context, output);
      return output;
    };
  }

  implementation(context: Context<Func<I, O, D, Async>>, input: z.infer<I>, invokeStack: FuncInvokeStack<I, O, D, Async>): zFuncReturn<O, Async> {
    input = this.parseInput(context, input);
    let output = invokeStack.$(context, input);
    if (output instanceof Promise) {
      output = output.then(this.createAsyncThenHandler(context));
    } else {
      output = this.parseOutput(context, output as z.infer<O>) as zFuncReturn<O, Async>;
    }
    return output;
  }
}

export class CbSafeParse<
  I extends zCallbackInput,
  O extends zCallbackOutput,
  D extends Record<never, never>,
  Multi extends boolean,
  Cancelable extends boolean,
> extends CallbackWrapper<I, O, D, Multi, Cancelable> {
  private input: boolean;
  private output: boolean;
  private time: boolean;

  constructor({ input = true, output = true, time = false } = {}) {
    super();
    this.input = input;
    this.output = output;
    this.time = time;
  }
  getOptions(): { input: boolean; output: boolean; time: boolean } {
    return { input: this.input, output: this.output, time: this.time };
  }
  setOptions({ input, output, time }: { input?: boolean; output?: boolean; time?: boolean }): void {
    this.input = input ?? this.input;
    this.output = output ?? this.output;
    this.time = time ?? this.time;
  }

  private parseInput(
    context: Context<Callback<I, O, D, Multi, Cancelable>>,
    input: z.infer<I>,
  ): { t: "Error"; e: Error } | { t: "Data"; d: z.infer<I> } {
    if (!this.input) return { t: "Data", d: input };
    const now = Date.now();
    const result = context.node.input.safeParse(input);
    if (this.time) context.logDebug(context.node.refString("Input"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) return { t: "Error", e: result.error };
    return { t: "Data", d: result.data };
  }

  private parseOutput(
    context: Context<Callback<I, O, D, Multi, Cancelable>>,
    output: z.infer<O>,
  ): { t: "Error"; e: Error } | { t: "Data"; d: z.infer<O> } {
    if (!this.output) return { t: "Data", d: output };
    const now = Date.now();
    const result = context.node.output.safeParse(output);
    if (this.time) context.logDebug(context.node.refString("Output"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) return { t: "Error", e: result.error };
    return { t: "Data", d: result.data };
  }

  private static fakeCancel() {}

  private createHandler(
    context: Context<Callback<I, O, D, Multi, Cancelable>>,
    callback: zCallbackHandler<O, Multi>,
  ): zCallbackHandler<O, Multi> {
    return (res: any) => {
      if (this.output && res.t === "Data") {
        const r = this.parseOutput(context, res.d);
        if (r.t === "Error") {
          res = r;
        } else {
          res.d = r.d;
        }
      }
      callback(res);
    };
  }

  implementation(
    context: Context<Callback<I, O, D, Multi, Cancelable>>,
    input: z.infer<I>,
    callback: zCallbackHandler<O, Multi>,
    invokeStack: CallbackInvokeStack<I, O, D, Multi, Cancelable>,
  ): zCallbackCancel<Cancelable> {
    const r = this.parseInput(context, input);
    if (r.t === "Error") {
      callback(r);
      if (context.node.isCancelable) {
        return CbSafeParse.fakeCancel as zCallbackCancel<Cancelable>;
      }
      return undefined as zCallbackCancel<Cancelable>;
    }
    input = r.d;
    return invokeStack.$(context, input, this.createHandler(context, callback));
  }
}
