/**
 * Time Wrapper
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
  ): Promise<z.infer<O>> {
    const t = WFTimer.logInit(context);
    const process = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    process.then(
      () => WFTimer.logNextEvent(context, "AsyncCompleted", t),
      () => WFTimer.logNextEvent(context, "AsyncError", t),
    );
    return process;
  }
  protected override StreamFunc(
    invokeStack: FuncInvokeStack<I, O, "StreamFunc">,
    context: Context<Func<I, O, "StreamFunc">>,
    input: z.infer<I>,
  ): ReadableStream<z.infer<O>> {
    const t = WFTimer.logInit(context);
    const process = invokeStack.$(context, input);
    WFTimer.logNextEvent(context, "SyncCompleted", t);
    let i = 0;
    return process.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          WFTimer.logNextEvent(context, `StreamYield-${i++}`, t);
          controller.enqueue(chunk);
        },
        flush() {
          WFTimer.logNextEvent(context, "StreamComplete", t);
        },
        cancel() {
          WFTimer.logNextEvent(context, "StreamCancel", t);
        },
      }),
    );
  }
  override ShouldIgnore(_: Func<I, O, Type>): boolean {
    return !this.time;
  }
}
