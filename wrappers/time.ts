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

export class WFuncTime<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>, Async extends boolean>
  extends FuncWrapper<I, O, D, Async> {
  private time: boolean;
  constructor({ time = true } = {}) {
    super();
    this.time = time;
  }
  getOptions(): { time: boolean } {
    return { time: this.time };
  }
  setOptions({ time }: { time?: boolean }): void {
    this.time = time ?? this.time;
  }

  private logNextEvent(context: Context<Func<I, O, D, Async>>): null | ((label: string) => void) {
    if (!this.time) return null;
    let now = Date.now();
    context.logDebug(context.node.refString("init"), `${now} epoc in ms`);
    return (label: string) => {
      context.logDebug(context.node.refString(label), `after ${Date.now() - now} ms`);
      now = Date.now();
    };
  }

  private createAsyncThenHandler(logTime: null | ((label: string) => void)) {
    return (output: z.infer<O>) => {
      logTime?.("AsyncCompleted");
      return output;
    };
  }

  implementation(context: Context<Func<I, O, D, Async>>, input: z.infer<I>, invokeStack: FuncInvokeStack<I, O, D, Async>): zFuncReturn<O, Async> {
    const logTime = this.logNextEvent(context);
    let output = invokeStack.$(context, input);
    logTime?.("SyncCompleted");
    if (output instanceof Promise) {
      output = output.then(this.createAsyncThenHandler(logTime));
    }
    return output;
  }
}

export class WCbTime<
  I extends zCallbackInput,
  O extends zCallbackOutput,
  D extends Record<never, never>,
  Multi extends boolean,
  Cancelable extends boolean,
> extends CallbackWrapper<I, O, D, Multi, Cancelable> {
  private time: boolean;

  constructor({ time = true } = {}) {
    super();
    this.time = time;
  }
  getOptions(): { time: boolean } {
    return { time: this.time };
  }
  setOptions({ time }: { time?: boolean }): void {
    this.time = time ?? this.time;
  }

  private logNextEvent(context: Context<Callback<I, O, D, Multi, Cancelable>>): null | ((label: string) => void) {
    if (!this.time) return null;
    let now = Date.now();
    context.logDebug(context.node.refString("init"), `${now} epoc in ms`);
    return (label: string) => {
      context.logDebug(context.node.refString(label), `after ${Date.now() - now} ms`);
      now = Date.now();
    };
  }

  private createHandler(
    logTime: null | ((type: string) => void),
    callback: zCallbackHandler<O, Multi>,
  ): zCallbackHandler<O, Multi> {
    return (res: any) => {
      logTime?.(res.t);
      callback(res);
    };
  }
  private createCancelHandler(logTime: null | ((type: string) => void), cancel: VoidFunction): zCallbackCancel<Cancelable> {
    return (() => {
      logTime?.("Canceled");
      cancel();
    }) as zCallbackCancel<Cancelable>;
  }

  implementation(
    context: Context<Callback<I, O, D, Multi, Cancelable>>,
    input: z.infer<I>,
    callback: zCallbackHandler<O, Multi>,
    invokeStack: CallbackInvokeStack<I, O, D, Multi, Cancelable>,
  ): zCallbackCancel<Cancelable> {
    const logTime = this.logNextEvent(context);
    const cancel = invokeStack.$(context, input, this.createHandler(logTime, callback));
    logTime?.("SyncCompleted");
    if (typeof cancel === "function") {
      return this.createCancelHandler(logTime, cancel);
    }
    return undefined as zCallbackCancel<Cancelable>;
  }
}
