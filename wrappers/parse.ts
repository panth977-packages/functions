/**
 * Parser Wrapper
 * @module
 */
import type z from "zod/v4";
import {
  type FuncCbHandler,
  type FuncCbReturn,
  type FuncDeclaration,
  type FuncInput,
  type FuncOutput,
  type FunctionTypes,
  type FuncTypes,
  FuncWrapper,
} from "../functions/index.ts";
import type { Context } from "../functions/context.ts";
import type { Func, FuncInvokeStack } from "../functions/func.ts";

abstract class ParserWrapper<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends FuncWrapper<I, O, D, Type> {
  input: boolean;
  output: boolean;
  time: boolean;
  constructor({ input = true, output = true, time = false } = {}) {
    super();
    this.input = input;
    this.output = output;
    this.time = time;
  }
}
abstract class FuncParserWrapper<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends ParserWrapper<I, O, D, Type> {
  protected parseInput(context: Context<Func<I, O, D, Type>>, input: z.infer<I>): z.infer<I> {
    if (!this.input) return input;
    const now = this.time ? Date.now() : 0;
    const result = context.node.input.safeParse(input);
    if (now) context.logDebug(context.node.refString("Input"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) throw result.error;
    return result.data;
  }

  protected parseOutput(context: Context<Func<I, O, D, Type>>, output: z.infer<O>): z.infer<O> {
    if (!this.output) return output;
    const now = this.time ? Date.now() : 0;
    const result = context.node.output.safeParse(output);
    if (now) context.logDebug(context.node.refString("Output"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) throw result.error;
    return result.data;
  }
}
export class SyncFuncParser<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends FuncParserWrapper<I, O, D, FunctionTypes["SyncFunc"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["SyncFunc"]>,
    context: Context<Func<I, O, D, FunctionTypes["SyncFunc"]>>,
    input: z.core.output<I>,
  ): z.core.output<O> {
    return this.parseOutput(context, invokeStack.$(context, this.parseInput(context, input)));
  }
}
export class AsyncFuncParser<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends FuncParserWrapper<I, O, D, FunctionTypes["AsyncFunc"]> {
  override async implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncFunc"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncFunc"]>>,
    input: z.core.output<I>,
  ): Promise<z.core.output<O>> {
    return this.parseOutput(context, await invokeStack.$(context, this.parseInput(context, input)));
  }
}
abstract class CbParserWrapper<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends ParserWrapper<I, O, D, Type> {
  protected parseInput(context: Context<Func<I, O, D, Type>>, input: z.infer<I>): { t: "Error"; e: Error } | { t: "Data"; d: z.infer<I> } {
    if (!this.input) return { t: "Data", d: input };
    const now = this.time ? Date.now() : 0;
    const result = context.node.input.safeParse(input);
    if (now) context.logDebug(context.node.refString("Input"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) return { t: "Error", e: result.error };
    return { t: "Data", d: result.data };
  }

  protected parseOutput(context: Context<Func<I, O, D, Type>>, output: z.infer<O>): { t: "Error"; e: Error } | { t: "Data"; d: z.infer<O> } {
    if (!this.output) return { t: "Data", d: output };
    const now = this.time ? Date.now() : 0;
    const result = context.node.output.safeParse(output);
    if (now) context.logDebug(context.node.refString("Output"), `parsed ${result.success ? "✅" : "❌"} in ${Date.now() - now} ms`);
    if (!result.success) return { t: "Error", e: result.error };
    return { t: "Data", d: result.data };
  }
}
function emptyCancel() {}
export class AsyncCbParser<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends CbParserWrapper<I, O, D, FunctionTypes["AsyncCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["AsyncCb"]>,
  ): FuncCbReturn<FunctionTypes["AsyncCb"]> {
    const r = this.parseInput(context, input);
    if (r.t === "Error") {
      callback(r);
      return;
    }
    input = r.d;
    invokeStack.$(context, input, (res) => {
      if (res.t === "Data") {
        res = this.parseOutput(context, res.d);
      }
      callback(res);
    });
  }
}
export class AsyncCancelableCbParser<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends CbParserWrapper<I, O, D, FunctionTypes["AsyncCancelableCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncCancelableCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncCancelableCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["AsyncCancelableCb"]>,
  ): FuncCbReturn<FunctionTypes["AsyncCancelableCb"]> {
    const r = this.parseInput(context, input);
    if (r.t === "Error") {
      callback(r);
      return emptyCancel;
    }
    input = r.d;
    return invokeStack.$(context, input, (res) => {
      if (res.t === "Data") {
        res = this.parseOutput(context, res.d);
      }
      callback(res);
    });
  }
}
export class SubsCbParser<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends CbParserWrapper<I, O, D, FunctionTypes["SubsCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["SubsCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["SubsCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["SubsCb"]>,
  ): FuncCbReturn<FunctionTypes["SubsCb"]> {
    const r = this.parseInput(context, input);
    if (r.t === "Error") {
      callback(r);
      return;
    }
    input = r.d;
    invokeStack.$(context, input, (res) => {
      if (res.t === "Data") {
        res = this.parseOutput(context, res.d);
      }
      callback(res);
    });
  }
}
export class SubsCancelableCbParser<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends CbParserWrapper<I, O, D, FunctionTypes["SubsCancelableCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["SubsCancelableCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["SubsCancelableCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["SubsCancelableCb"]>,
  ): FuncCbReturn<FunctionTypes["SubsCancelableCb"]> {
    const r = this.parseInput(context, input);
    if (r.t === "Error") {
      callback(r);
      return emptyCancel;
    }
    input = r.d;
    return invokeStack.$(context, input, (res) => {
      if (res.t === "Data") {
        res = this.parseOutput(context, res.d);
      }
      callback(res);
    });
  }
}
