/**
 * Memoized Wrapper
 * @module
 */
import type z from "zod/v4";
import {
  type FuncCbHandler,
  type FuncCbReturn,
  type FuncDeclaration,
  type FuncInput,
  type FuncInvokeStack,
  type FuncOutput,
  type FunctionTypes,
  type FuncTypes,
  FuncWrapper,
} from "../functions/index.ts";
import type { Context } from "../functions/context.ts";
import type { Func } from "../functions/func.ts";

abstract class CbQue<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends FuncWrapper<I, O, D, Type> {
  protected que: Array<(cb: VoidFunction) => void> = [];
  readonly maxConcurrency: number;
  constructor(maxConcurrency = 1) {
    super();
    this.maxConcurrency = maxConcurrency;
  }
  protected running = 0;
  protected runJob(): void {
    if (this.running >= this.maxConcurrency) return;
    const job = this.que.shift();
    if (!job) return;
    this.running++;
    job(() => {
      this.running--;
      this.runJob();
    });
  }
}

export class AsyncFuncQue<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration> extends CbQue<I, O, D, FunctionTypes["AsyncFunc"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncFunc"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncFunc"]>>,
    input: z.core.output<I>,
  ): Promise<z.core.output<O>> {
    return new Promise((resolve, reject) => {
      this.que.push((done) => invokeStack.$(context, input).then(resolve, reject).then(done));
      this.runJob();
    });
  }
}

export class AsyncCbQue<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration> extends CbQue<I, O, D, FunctionTypes["AsyncCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["AsyncCb"]>,
  ): FuncCbReturn<FunctionTypes["AsyncCb"]> {
    this.que.push((cb) => {
      invokeStack.$(context, input, (r) => {
        cb();
        callback(r);
      });
    });
    this.runJob();
  }
}
export class AsyncCancelableCbQue<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends CbQue<I, O, D, FunctionTypes["AsyncCancelableCb"]> {
  override implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncCancelableCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncCancelableCb"]>>,
    input: z.core.output<I>,
    callback: FuncCbHandler<O, FunctionTypes["AsyncCancelableCb"]>,
  ): FuncCbReturn<FunctionTypes["AsyncCancelableCb"]> {
    let cancel: FuncCbReturn<FunctionTypes["AsyncCancelableCb"]> | null = null;
    const handler = (cb: VoidFunction) => {
      cancel = invokeStack.$(context, input, (r) => {
        cb();
        callback(r);
      });
    };
    this.que.push(handler);
    this.runJob();
    return () => {
      const i = this.que.indexOf(handler);
      if (i !== -1) {
        this.que.splice(i, 1);
      }
      cancel?.();
      cancel = null;
    };
  }
}
