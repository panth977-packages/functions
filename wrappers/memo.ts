/**
 * Memoized Wrapper
 * @module
 */
import type z from "zod/v4";
import {
  AsyncCbSender,
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
import type { AsyncCbReceiver } from "../functions/handle_async.ts";

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
  override AsyncFunc(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncFunc">,
    context: Context<Func<I, O, D, "AsyncFunc">>,
    input: z.core.output<I>,
  ): Promise<z.core.output<O>> {
    const cache = this.cache as Map<z.infer<I>, FuncReturn<O, "AsyncFunc">>;
    if (cache.has(input)) {
      return cache.get(input)!;
    }
    const output = invokeStack.$(context, input);
    cache.set(input, output);
    output.catch(cache.delete.bind(this.cache, input));
    return output;
  }
  override AsyncCb(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncCb">,
    context: Context<Func<I, O, D, "AsyncCb">>,
    input: z.core.output<I>,
  ): AsyncCbReceiver<z.core.output<O>> {
    const cache = this.cache as Map<z.infer<I>, FuncReturn<O, "AsyncCb">>;
    if (cache.has(input)) {
      return cache.get(input)!;
    }
    const port = new AsyncCbSender<z.infer<O>>();
    const handler = port.getHandler();
    cache.set(input, handler);
    const process = invokeStack.$(context, input);
    process.catch(cache.delete.bind(cache, input));
    process.then(port.return.bind(port));
    process.catch(port.throw.bind(port));
    return handler;
  }
}
