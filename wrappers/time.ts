/**
 * Time Wrapper
 * @module
 */
import type z from "zod/v4";
import { type FuncDeclaration, type FuncInput, type FuncOutput, type FuncTypes, GenericFuncWrapper } from "../functions/index.ts";
import type { Context } from "../functions/context.ts";
import type { Func, FuncInvokeStack } from "../functions/func.ts";
import type { T } from "@panth977/tools";

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
  ): T.PPromise<z.core.output<O>> {
    const t = WFTimer.logInit(context);
    const process = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    process.ondata(WFTimer.logNextEvent.bind(WFTimer, context, "AsyncCompleted", t));
    process.onerror(WFTimer.logNextEvent.bind(WFTimer, context, "AsyncError", t));
    process.oncancel(WFTimer.logNextEvent.bind(WFTimer, context, "AsyncCancel", t));
    return process;
  }
  private streamOnNext(
    context: Context<Func<I, O, D, "SreamFunc">>,
    t: ReturnType<typeof WFTimer.logInit>,
    i: number,
    process: T.PStream<z.core.output<O>>,
    _data: z.infer<O>,
  ) {
    WFTimer.logNextEvent(context, `StreamYield-${i}`, t);
    process.onnext(this.streamOnNext.bind(this, context, t, i + 1, process));
  }
  protected override SreamFunc(
    invokeStack: FuncInvokeStack<I, O, D, "SreamFunc">,
    context: Context<Func<I, O, D, "SreamFunc">>,
    input: z.core.output<I>,
  ): T.PStream<z.core.output<O>> {
    const t = WFTimer.logInit(context);
    const process = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    process.onnext(this.streamOnNext.bind(this, context, t, 0, process));
    process.onerror(WFTimer.logNextEvent.bind(WFTimer, context, "StreamError", t));
    process.oncancel(WFTimer.logNextEvent.bind(WFTimer, context, "StreamCancel", t));
    process.onfinish(WFTimer.logNextEvent.bind(WFTimer, context, "StreamComplete", t));
    return process;
  }
  override ShouldIgnore(_: Func<I, O, D, Type>): boolean {
    return !this.time;
  }
}
