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
import type { T } from "@panth977/tools";

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
  private handler(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncFunc">,
    context: Context<Func<I, O, D, "AsyncFunc">>,
    input: z.core.output<I>,
    port: T.PPromisePort<z.core.output<O>>,
    done: VoidFunction,
  ) {
    const process = invokeStack.$(context, input);
    process.onend(done);
    process.ondata(port.return);
    process.onerror(port.throw);
    port.oncancel(process.cancel.bind(process));
  }
  override AsyncFunc(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncFunc">,
    context: Context<Func<I, O, D, "AsyncFunc">>,
    input: z.core.output<I>,
  ): T.PPromise<z.core.output<O>> {
    const [port, promise] = context.node.createPort();
    invokeStack.$.bind(invokeStack, context, input);
    const handler = this.handler.bind(this, invokeStack, context, input, port);
    port.oncancel(this.removeJob.bind(this, handler));
    this.addJob(handler);
    return promise;
  }
}
