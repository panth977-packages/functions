/**
 * Time Wrapper
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

abstract class TimeWrapper<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends FuncWrapper<I, O, D, Type> {
  time: boolean;
  constructor({ time = false } = {}) {
    super();
    this.time = time;
  }
  protected logNextEvent(context: Context<Func<I, O, D, Type>>): null | ((label: string) => void) {
    if (!this.time) return null;
    let now = Date.now();
    context.logDebug(context.node.refString("init"), `${now} epoc in ms`);
    return (label: string) => {
      context.logDebug(context.node.refString(label), `after ${Date.now() - now} ms`);
      now = Date.now();
    };
  }
}
export class SyncFuncTime<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends TimeWrapper<I, O, D, FunctionTypes["SyncFunc"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["SyncFunc"]>,
    context: Context<Func<I, O, D, FunctionTypes["SyncFunc"]>>,
    input: z.core.output<I>,
  ): z.core.output<O> {
    const logTime = this.logNextEvent(context);
    const output = invokeStack.$(context, input);
    logTime?.("SyncCompleted");
    return output;
  }
}
export class AsyncFuncTime<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends TimeWrapper<I, O, D, FunctionTypes["AsyncFunc"]> {
  override async implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncFunc"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncFunc"]>>,
    input: z.core.output<I>,
  ): Promise<z.core.output<O>> {
    const logTime = this.logNextEvent(context);
    const _output = invokeStack.$(context, input);
    logTime?.("SyncCompleted");
    const output = await _output;
    logTime?.("AsyncCompleted");
    return output;
  }
}
export class AsyncCbTime<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends TimeWrapper<I, O, D, FunctionTypes["AsyncCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["AsyncCb"]>,
  ): FuncCbReturn<FunctionTypes["AsyncCb"]> {
    const logTime = this.logNextEvent(context);
    invokeStack.$(context, input, (res) => {
      logTime?.(`Cb${res.t}`);
      callback(res);
    });
    logTime?.("SyncCompleted");
  }
}
export class AsyncCancelableCbTime<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends TimeWrapper<I, O, D, FunctionTypes["AsyncCancelableCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncCancelableCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncCancelableCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["AsyncCancelableCb"]>,
  ): FuncCbReturn<FunctionTypes["AsyncCancelableCb"]> {
    const logTime = this.logNextEvent(context);
    const cancel = invokeStack.$(context, input, (res) => {
      logTime?.(`Cb${res.t}`);
      callback(res);
    });
    logTime?.("SyncCompleted");
    return () => {
      logTime?.("Canceled");
      cancel();
    };
  }
}
export class SubsCbTime<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration> extends TimeWrapper<I, O, D, FunctionTypes["SubsCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["SubsCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["SubsCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["SubsCb"]>,
  ): FuncCbReturn<FunctionTypes["SubsCb"]> {
    const logTime = this.logNextEvent(context);
    invokeStack.$(context, input, (res) => {
      logTime?.(`Cb${res.t}`);
      callback(res);
    });
    logTime?.("SyncCompleted");
  }
}
export class SubsCancelableCbTime<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends TimeWrapper<I, O, D, FunctionTypes["SubsCancelableCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["SubsCancelableCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["SubsCancelableCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["SubsCancelableCb"]>,
  ): FuncCbReturn<FunctionTypes["SubsCancelableCb"]> {
    const logTime = this.logNextEvent(context);
    const cancel = invokeStack.$(context, input, (res) => {
      logTime?.(`Cb${res.t}`);
      callback(res);
    });
    logTime?.("SyncCompleted");
    return () => {
      logTime?.("Canceled");
      cancel();
    };
  }
}
