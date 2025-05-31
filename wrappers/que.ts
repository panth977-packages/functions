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

export class WFuncQue<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>> extends FuncWrapper<I, O, D, true> {
  private que = new Array<() => Promise<void>>();
  readonly maxConcurrency: number;
  constructor(maxConcurrency = 1) {
    super();
    this.maxConcurrency = maxConcurrency;
  }

  private running = 0;
  private async runJob(): Promise<void> {
    if (this.running >= this.maxConcurrency) return;
    const job = this.que.shift();
    if (!job) return;
    this.running++;
    await job();
    this.running--;
    return this.runJob();
  }

  implementation(context: Context<Func<I, O, D, true>>, input: z.infer<I>, invokeStack: FuncInvokeStack<I, O, D, true>): zFuncReturn<O, true> {
    return new Promise((resolve, reject) => {
      this.que.push(() => invokeStack.$(context, input).then(resolve, reject));
      this.runJob();
    });
  }
}

export class WCbQue<I extends zCallbackInput, O extends zCallbackOutput, D extends Record<never, never>, Cancelable extends boolean>
  extends CallbackWrapper<I, O, D, false, Cancelable> {
  private que = new Array<(cb: VoidFunction) => void>();

  readonly maxConcurrency: number;
  constructor(maxConcurrency = 1) {
    super();
    this.maxConcurrency = maxConcurrency;
  }

  private running = 0;
  private runJob(): void {
    if (this.running >= this.maxConcurrency) return;
    const job = this.que.shift();
    if (!job) return;
    this.running++;
    job(() => {
      this.running--;
      this.runJob();
    });
  }

  implementation(
    context: Context<Callback<I, O, D, false, Cancelable>>,
    input: z.infer<I>,
    callback: zCallbackHandler<O, false>,
    invokeStack: CallbackInvokeStack<I, O, D, false, Cancelable>,
  ): zCallbackCancel<Cancelable> {
    let running = false;
    let cancel: null | zCallbackCancel<Cancelable> = null;
    const handler = (cb: VoidFunction) => {
      running = true;
      cancel = invokeStack.$(context, input, (r) => {
        running = false;
        cb();
        callback(r);
      });
    };
    this.que.push(handler);
    this.runJob();
    if (context.node.isCancelable) {
      return (() => {
        if (running) {
          cancel?.();
          cancel = null;
        } else {
          const i = this.que.indexOf(handler);
          if (i !== -1) {
            this.que.splice(i, 1);
          }
        }
      }) as zCallbackCancel<Cancelable>;
    }
    return undefined as zCallbackCancel<Cancelable>;
  }
}
