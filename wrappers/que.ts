/**
 * Memoized Wrapper
 * @module
 */
import type z from "zod/v4";
import {
  type FuncDeclaration,
  type FuncInput,
  type FuncInvokeStack,
  type FuncOutput,
  type FuncTypes,
  GenericFuncWrapper,
} from "../functions/index.ts";
import type { Context } from "../functions/context.ts";
import type { Func } from "../functions/func.ts";
import type { AsyncCbReceiver } from "../functions/handle_async.ts";
import { AsyncCbSender } from "../exports.ts";

export class WFQue<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends GenericFuncWrapper<I, O, D, Type> {
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
  override AsyncFunc(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncFunc">,
    context: Context<Func<I, O, D, "AsyncFunc">>,
    input: z.core.output<I>,
  ): Promise<z.core.output<O>> {
    return new Promise((resolve, reject) => {
      this.addJob((done) => invokeStack.$(context, input).then(resolve, reject).then(done));
    });
  }
  override AsyncCb(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncCb">,
    context: Context<Func<I, O, D, "AsyncCb">>,
    input: z.core.output<I>,
  ): AsyncCbReceiver<z.core.output<O>> {
    const port = new AsyncCbSender<z.infer<O>>();
    invokeStack.$.bind(invokeStack, context, input);
    function handler(done: VoidFunction) {
      const process = invokeStack.$(context, input);
      process.finally(done);
      process.then(port.return.bind(port));
      process.catch(port.throw.bind(port));
      port.on("cancel", process.cancel.bind(process));
    }
    port.on("cancel", this.removeJob.bind(this, handler));
    this.addJob(handler);
    return port.getHandler();
  }
}
