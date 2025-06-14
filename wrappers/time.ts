/**
 * Time Wrapper
 * @module
 */
import type z from "zod/v4";
import {
  type AsyncCbReceiver,
  AsyncCbSender,
  type FuncDeclaration,
  type FuncInput,
  type FuncOutput,
  type FuncTypes,
  GenericFuncWrapper,
  type SubsCbReceiver,
  SubsCbSender,
} from "../functions/index.ts";
import type { Context } from "../functions/context.ts";
import type { Func, FuncInvokeStack } from "../functions/func.ts";

export class WFTimer<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends GenericFuncWrapper<I, O, D, Type> {
  constructor(public time = false) {
    super();
  }
  protected static logInit(context: Context): [number] {
    const now = Date.now();
    context.logDebug(context.node.refString("init"), `${now} epoc in ms`);
    return [now];
  }
  protected static logNextEvent(context: Context, label: string, timer: ReturnType<typeof WFTimer.logInit>): void {
    const now = Date.now();
    context.logDebug(context.node.refString(label), `after ${now - timer[0]} ms`);
    timer[0] = now;
  }
  override SyncFunc(
    invokeStack: FuncInvokeStack<I, O, D, "SyncFunc">,
    context: Context<Func<I, O, D, "SyncFunc">>,
    input: z.core.output<I>,
  ): z.core.output<O> {
    const t = WFTimer.logInit(context);
    const output = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    return output;
  }
  override AsyncFunc(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncFunc">,
    context: Context<Func<I, O, D, "AsyncFunc">>,
    input: z.core.output<I>,
  ): Promise<z.core.output<O>> {
    const t = WFTimer.logInit(context);
    const _output = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    _output.then(WFTimer.logNextEvent.bind(WFTimer, context, "AsyncCompleted", t));
    return _output;
  }
  override AsyncCb(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncCb">,
    context: Context<Func<I, O, D, "AsyncCb">>,
    input: z.core.output<I>,
  ): AsyncCbReceiver<z.core.output<O>> {
    const t = WFTimer.logInit(context);
    const process = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    const port = new AsyncCbSender<z.infer<O>>();
    process.then(WFTimer.logNextEvent.bind(WFTimer, context, "AsyncCbCompleted", t));
    process.then(port.return.bind(port));
    process.catch(port.throw.bind(port));
    port.on("cancel", WFTimer.logNextEvent.bind(WFTimer, context, "AsyncCancelled", t));
    port.on("cancel", process.cancel.bind(process));
    return port.getHandler();
  }
  override SubsCb(
    invokeStack: FuncInvokeStack<I, O, D, "SubsCb">,
    context: Context<Func<I, O, D, "SubsCb">>,
    input: z.core.output<I>,
  ): SubsCbReceiver<z.core.output<O>> {
    const t = WFTimer.logInit(context);
    const process = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    const port = new SubsCbSender<z.infer<O>>();
    process.listen(WFTimer.logNextEvent.bind(WFTimer, context, "SubsCbYielded", t));
    process.listen(port.yield.bind(port));
    process.catch(port.throw.bind(port));
    process.onEnd(WFTimer.logNextEvent.bind(WFTimer, context, "SubsCbEnded", t));
    process.onEnd(port.end.bind(port));
    port.on("cancel", WFTimer.logNextEvent.bind(WFTimer, context, "AsyncCancelled", t));
    port.on("cancel", process.cancel.bind(process));
    return port.getHandler();
  }
  override ShouldIgnore(_: Func<I, O, D, Type>): boolean {
    return !this.time;
  }
}
