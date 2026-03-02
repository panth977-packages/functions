/**
 * Time Wrapper
 * @module
 */
import type z from "zod";
import { type Func, type FuncInput, type FuncInvokeStack, type FuncOutput, type FuncTypes, GenericFuncWrapper } from "../func.ts";
import type { Context } from "../context.ts";
import { T } from "@panth977/tools";

export class WFTimer<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> extends GenericFuncWrapper<I, O, Type> {
  constructor(public time = false) {
    super();
  }
  protected static logInit(context: Context): [number] {
    const now = Date.now();
    context.logDebug(context.node.refString("init"), `${now} epoc in ms`);
    return [now];
  }
  protected static logNextEvent(
    context: Context,
    label: string,
    timer: ReturnType<typeof WFTimer.logInit>,
  ): void {
    const now = Date.now();
    context.logDebug(
      context.node.refString(label),
      `after ${now - timer[0]} ms`,
    );
    timer[0] = now;
  }
  override SyncFunc(
    invokeStack: FuncInvokeStack<I, O, "SyncFunc">,
    context: Context<Func<I, O, "SyncFunc">>,
    input: z.infer<I>,
  ): z.infer<O> {
    const t = WFTimer.logInit(context);
    const output = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    return output;
  }
  override AsyncFunc(
    invokeStack: FuncInvokeStack<I, O, "AsyncFunc">,
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
  ): T.PPromise<z.infer<O>> {
    const t = WFTimer.logInit(context);
    const process = T.PPromise.from(invokeStack.$(context, input));
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    process.ondata(
      WFTimer.logNextEvent.bind(WFTimer, context, "AsyncCompleted", t),
    );
    process.onerror(
      WFTimer.logNextEvent.bind(WFTimer, context, "AsyncError", t),
    );
    process.oncancel(
      WFTimer.logNextEvent.bind(WFTimer, context, "AsyncCancel", t),
    );
    return process;
  }
  private streamOnNext(
    context: Context<Func<I, O, "StreamFunc">>,
    t: ReturnType<typeof WFTimer.logInit>,
    i: number,
    process: T.PStream<z.infer<O>>,
    _data: z.infer<O>,
  ) {
    WFTimer.logNextEvent(context, `StreamYield-${i}`, t);
    process.onnext(this.streamOnNext.bind(this, context, t, i + 1, process));
  }
  protected override StreamFunc(
    invokeStack: FuncInvokeStack<I, O, "StreamFunc">,
    context: Context<Func<I, O, "StreamFunc">>,
    input: z.infer<I>,
  ): T.PStream<z.infer<O>> {
    const t = WFTimer.logInit(context);
    const process = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    process.onnext(this.streamOnNext.bind(this, context, t, 0, process));
    process.onerror(
      WFTimer.logNextEvent.bind(WFTimer, context, "StreamError", t),
    );
    process.oncancel(
      WFTimer.logNextEvent.bind(WFTimer, context, "StreamCancel", t),
    );
    process.onfinish(
      WFTimer.logNextEvent.bind(WFTimer, context, "StreamComplete", t),
    );
    return process;
  }
  override ShouldIgnore(_: Func<I, O, Type>): boolean {
    return !this.time;
  }
}
