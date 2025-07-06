/**
 * Memoized Wrapper
 * @module
 */
import type z from "zod/v4";
import { type Func, type FuncInput, type FuncInvokeStack, type FuncOutput, type FuncReturn, type FuncTypes, GenericFuncWrapper } from "../func.ts";
import type { Context } from "../context.ts";
import type { T } from "@panth977/tools";

/**
 * this will ignore the cancel signal even if the function has cancel implementation.
 */
export class WFMemo<I extends FuncInput, O extends FuncOutput, Type extends FuncTypes> extends GenericFuncWrapper<I, O, Type> {
  protected cache: Map<z.infer<I>, FuncReturn<O, Type>> = new Map();
  override SyncFunc(
    invokeStack: FuncInvokeStack<I, O, "SyncFunc">,
    context: Context<Func<I, O, "SyncFunc">>,
    input: z.core.output<I>,
  ): z.core.output<O> {
    const cache = this.cache as Map<z.infer<I>, FuncReturn<O, "SyncFunc">>;
    if (cache.has(input)) {
      return cache.get(input)!;
    }
    const output = invokeStack.$(context, input);
    cache.set(input, output);
    return output;
  }
  protected override AsyncFunc(
    invokeStack: FuncInvokeStack<I, O, "AsyncFunc">,
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.core.output<I>,
  ): T.PPromise<z.core.output<O>> {
    const cache = this.cache as Map<z.infer<I>, FuncReturn<O, "AsyncFunc">>;
    if (cache.has(input)) {
      return cache.get(input)!;
    }
    const output = invokeStack.$(context, input);
    cache.set(input, output);
    output.onerror(cache.delete.bind(this.cache, input));
    output.oncancel(cache.delete.bind(this.cache, input));
    return output;
  }
}
