/**
 * Memoized Wrapper
 * @module
 */
import type z from "zod/v4";
import {
  type CallbackInvokeStack,
  CallbackWrapper,
  type Context,
  type FuncInvokeStack,
  FuncWrapper,
  type zCallbackCancel,
  type zCallbackHandler,
  type zCallbackInput,
  type zCallbackOutput,
  type zFuncInput,
  type zFuncOutput,
  type zFuncReturn,
} from "../functions/index.ts";
import type { Func } from "../functions/func.ts";
import type { Callback } from "../functions/callback.ts";

export class WFuncMemoized<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>, Async extends boolean>
  extends FuncWrapper<I, O, D, Async> {
  private cache = new Map<z.infer<I>, zFuncReturn<O, Async>>();

  private createAsyncCatchHandler(input: z.infer<I>): VoidFunction {
    return () => {
      this.cache.delete(input);
    };
  }

  implementation(context: Context<Func<I, O, D, Async>>, input: z.infer<I>, invokeStack: FuncInvokeStack<I, O, D, Async>): zFuncReturn<O, Async> {
    if (this.cache.has(input)) {
      return this.cache.get(input)!;
    }
    const output = invokeStack.$(context, input);
    this.cache.set(input, output);
    if (output instanceof Promise) {
      output.catch(this.createAsyncCatchHandler(input));
    }
    return output;
  }
}

export class WCbMemoized<I extends zCallbackInput, O extends zCallbackOutput, D extends Record<never, never>>
  extends CallbackWrapper<I, O, D, false, false> {
  private cache = new Map<z.infer<I>, z.infer<O>>();
  private pending = new Map<z.infer<I>, zCallbackHandler<O, false>[]>();
  allowParalledCalls: boolean;
  constructor({ allowParalledCalls = false } = {}) {
    super();
    this.allowParalledCalls = allowParalledCalls;
  }

  private addPending(input: z.infer<I>, callback: zCallbackHandler<O, false>): boolean {
    const cbs = this.pending.get(input) ?? [];
    cbs.push(callback);
    if (cbs.length === 1) {
      this.pending.set(input, cbs);
      return true;
    }
    return false;
  }

  private notifyPending(input: z.infer<I>, res: Parameters<zCallbackHandler<O, false>>[0]) {
    const cbs = this.pending.get(input);
    if (cbs === undefined) return;
    for (const cb of cbs) {
      cb(res);
    }
    this.pending.delete(input);
  }

  private createParallelInvokeHandler(input: z.infer<I>, callback: zCallbackHandler<O, false>): zCallbackHandler<O, false> {
    return (res) => {
      if (res.t === "Data") {
        this.cache.set(input, res.d);
      }
      callback(res);
    };
  }
  private createFirstInvokeHandler(input: z.infer<I>): zCallbackHandler<O, false> {
    return (res) => {
      if (res.t === "Data") {
        this.cache.set(input, res.d);
      }
      this.notifyPending(input, res);
    };
  }
  implementation(
    context: Context<Callback<I, O, D, false, false>>,
    input: z.infer<I>,
    callback: zCallbackHandler<O, false>,
    invokeStack: CallbackInvokeStack<I, O, D, false, false>,
  ): zCallbackCancel<false> {
    if (this.cache.has(input)) {
      callback({ t: "Data", d: this.cache.get(input)! });
    } else if (this.allowParalledCalls) {
      invokeStack.$(context, input, this.createParallelInvokeHandler(input, callback));
    } else {
      const isFirst = this.addPending(input, callback);
      if (isFirst) {
        invokeStack.$(context, input, this.createFirstInvokeHandler(input));
      }
    }
  }
}
