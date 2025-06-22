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
  type FuncReturn,
  type FuncTypes,
  GenericFuncWrapper,
} from "../functions/index.ts";
import type { Context } from "../functions/context.ts";
import type { Func } from "../functions/func.ts";
import type { T } from "@panth977/tools";

/**
 * this will ignore the cancel signal even if the function has cancel implementation.
 */
export class WFMemo<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends GenericFuncWrapper<I, O, D, Type> {
  protected cache: Map<z.infer<I>, FuncReturn<O, Type>> = new Map();
  override SyncFunc(
    invokeStack: FuncInvokeStack<I, O, D, "SyncFunc">,
    context: Context<Func<I, O, D, "SyncFunc">>,
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
    invokeStack: FuncInvokeStack<I, O, D, "AsyncFunc">,
    context: Context<Func<I, O, D, "AsyncFunc">>,
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
