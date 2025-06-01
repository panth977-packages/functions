/**
 * Memoized Wrapper
 * @module
 */
import type z from "zod/v4";
import {
  type Context,
  type FuncCbHandler,
  type FuncCbReturn,
  type FuncDeclaration,
  type FuncInput,
  type FuncInvokeStack,
  type FuncOutput,
  type FuncReturn,
  type FunctionTypes,
  FuncWrapper,
} from "../functions/index.ts";
import type { Func } from "../functions/func.ts";
export class SyncFuncMemo<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends FuncWrapper<I, O, D, FunctionTypes["SyncFunc"]> {
  protected cache: Map<z.infer<I>, FuncReturn<O, FunctionTypes["SyncFunc"]>> = new Map();
  implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["SyncFunc"]>,
    context: Context<Func<I, O, D, FunctionTypes["SyncFunc"]>>,
    input: z.infer<I>,
  ): FuncReturn<O, FunctionTypes["SyncFunc"]> {
    if (this.cache.has(input)) {
      return this.cache.get(input)!;
    }
    const output = invokeStack.$(context, input);
    this.cache.set(input, output);
    return output;
  }
}
export class AsyncFuncMemo<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends FuncWrapper<I, O, D, FunctionTypes["AsyncFunc"]> {
  protected cache: Map<z.infer<I>, FuncReturn<O, FunctionTypes["AsyncFunc"]>> = new Map();
  createAsyncCatchHandler(input: z.infer<I>): () => void {
    return () => this.cache.delete(input);
  }
  implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncFunc"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncFunc"]>>,
    input: z.infer<I>,
  ): FuncReturn<O, FunctionTypes["AsyncFunc"]> {
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
export class AsyncCbMemo<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration>
  extends FuncWrapper<I, O, D, FunctionTypes["AsyncCb"]> {
  protected cache: Map<z.infer<I>, z.infer<O>> = new Map();
  protected pending: Map<z.infer<I>, FuncCbHandler<O, FunctionTypes["AsyncCb"]>[]> = new Map();
  private addPending(input: z.infer<I>, callback: FuncCbHandler<O, FunctionTypes["AsyncCb"]>): boolean {
    const cbs = this.pending.get(input) ?? [];
    cbs.push(callback);
    if (cbs.length === 1) {
      this.pending.set(input, cbs);
      return true;
    }
    return false;
  }

  private notifyPending(input: z.infer<I>, res: Parameters<FuncCbHandler<O, FunctionTypes["AsyncCb"]>>[0]) {
    const cbs = this.pending.get(input);
    if (cbs === undefined) return;
    for (const cb of cbs) {
      cb(res);
    }
    this.pending.delete(input);
  }
  private createFirstInvokeHandler(input: z.infer<I>): FuncCbHandler<O, FunctionTypes["AsyncCb"]> {
    return ((res: any) => {
      if (res.t === "Data") {
        this.cache.set(input, res.d);
      }
      this.notifyPending(input, res);
    }) as any;
  }
  implementation(
    invokeStack: FuncInvokeStack<I, O, D, FunctionTypes["AsyncCb"]>,
    context: Context<Func<I, O, D, FunctionTypes["AsyncCb"]>>,
    input: z.infer<I>,
    callback: FuncCbHandler<O, FunctionTypes["AsyncCb"]>,
  ): FuncCbReturn<FunctionTypes["AsyncCb"]> {
    if (this.cache.has(input)) {
      callback({ t: "Data", d: this.cache.get(input)! });
    } else {
      const isFirst = this.addPending(input, callback);
      if (isFirst) {
        invokeStack.$(context, input, this.createFirstInvokeHandler(input));
      }
    }
  }
}
