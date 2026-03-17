/**
 * Memoized Wrapper
 * @module
 */
import type z from "zod";
import {
  type Func,
  type FuncInput,
  type FuncInvokeStack,
  type FuncOutput,
  type FuncTypes,
  GenericFuncWrapper,
} from "../func.ts";
import type { Context } from "../context.ts";

export class WFQue<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> extends GenericFuncWrapper<I, O, Type> {
  protected que: Array<(cb: VoidFunction) => void> = [];
  constructor(readonly maxConcurrency = 1) {
    super();
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
  protected addJob(handler: (cb: VoidFunction) => void) {
    this.que.push(handler);
    this.runJob();
  }
  protected removeJob(handler: (cb: VoidFunction) => void) {
    const index = this.que.indexOf(handler);
    if (index !== -1) {
      this.que.splice(index, 1);
    }
  }
  private handler(
    invokeStack: FuncInvokeStack<I, O, "AsyncFunc">,
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
    resolve: (value: z.infer<O>) => void,
    reject: (reason: unknown) => void,
    done: VoidFunction,
  ) {
    const process = invokeStack.$(context, input);
    process.then(
      (value) => {
        resolve(value);
        done();
      },
      (error) => {
        reject(error);
        done();
      },
    );
  }
  override AsyncFunc(
    invokeStack: FuncInvokeStack<I, O, "AsyncFunc">,
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
  ): Promise<z.infer<O>> {
    let resolve!: (value: z.infer<O>) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<z.infer<O>>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const handler = this.handler.bind(
      this,
      invokeStack,
      context,
      input,
      resolve,
      reject,
    );
    this.addJob(handler);
    return promise;
  }
}
