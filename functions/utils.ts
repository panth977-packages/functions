import type { z } from "zod/v4";
import {
  Func,
  type FuncCbHandler,
  type FuncDeclaration,
  type FuncExported,
  type FuncInput,
  type FuncOutput,
  FunctionTypes,
  type FuncTypes,
} from "../functions/index.ts";
import type { Context } from "../functions/context.ts";

export function isFuncType<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, CheckType extends FuncTypes>(
  func: Func<I, O, D, FuncTypes>,
  checkType: CheckType,
): func is Func<I, O, D, CheckType> {
  return func instanceof Func && func.type === checkType;
}
export type InvokeCbHandler<O extends FuncOutput, Args extends [] | [unknown, ...unknown[]]> = (
  response: { t: "Data"; d: z.infer<O> } | { t: "Error"; e: unknown },
  ...args: Args
) => void;
export type InvokeCbReturn = () => void;
function handlePromise<O extends FuncOutput, Args extends [] | [unknown, ...unknown[]]>(
  promise: Promise<z.infer<O>>,
  handler: InvokeCbHandler<O, Args>,
  ...args: Args
) {
  promise.then((data) => handler({ t: "Data", d: data }, ...args), (error) => handler({ t: "Error", e: error }, ...args));
}
function cbHandler<O extends FuncOutput, Args extends [] | [unknown, ...unknown[]]>(
  handler: InvokeCbHandler<O, Args>,
  ...args: Args
): FuncCbHandler<O, FunctionTypes["AsyncCb"]> {
  return function (r) {
    handler(r, ...args);
  };
}
function fakeCancel() {}
/**
 * handle all syntex in single api
 * ```ts
 * const fib = syncFunc()...
 * const fetchUser = asyncFunc()...
 * const fetchUserCb = asyncCb()...
 * const fetchUserCbCancel = asyncCancelableCb()...
 *
 * const context = new Context("", "No Reason", null);
 * invoke(context, fib, 0, () => {});
 * invoke(context, fetchUser, 0, () => {});
 * invoke(context, fetchUserCb, 0, () => {});
 * invoke(context, fetchUserCbCancel, 0, () => {});
 * ```
 */
export function invoke<
  I extends FuncInput,
  O extends FuncOutput,
  D extends FuncDeclaration,
  Type extends FuncTypes,
  Args extends [] | [unknown, ...unknown[]],
>(
  funcExp: FuncExported<I, O, D, Type>,
  context: Context,
  input: z.infer<I>,
  handler: InvokeCbHandler<O, Args>,
  ...args: Args
): InvokeCbReturn {
  const func = funcExp.node;
  if (isFuncType(func, FunctionTypes.SyncFunc)) {
    try {
      handler({ t: "Data", d: func.$(context, input) }, ...args);
    } catch (e) {
      handler({ t: "Error", e }, ...args);
    }
  } else if (isFuncType(func, FunctionTypes.AsyncFunc)) {
    try {
      handlePromise(func.$(context, input), handler, ...args);
    } catch (e) {
      handler({ t: "Error", e }, ...args);
    }
  } else if (isFuncType(func, FunctionTypes.AsyncCb)) {
    func.$(context, input, cbHandler(handler, ...args));
  } else if (isFuncType(func, FunctionTypes.AsyncCancelableCb)) {
    return func.$(context, input, cbHandler(handler, ...args));
  } else {
    handler({ t: "Error", e: new Error("Unsupported function type") }, ...args);
  }
  return fakeCancel;
}
export type Invokable<O extends FuncOutput, Args extends [] | [unknown, ...unknown[]]> = (
  context: Context,
  handler: InvokeCbHandler<O, Args>,
  ...args: Args
) => InvokeCbReturn;

/**
 * bind your api with a input.
 * ```ts
 * const fib = syncFunc()...
 * const fetchUser = asyncFunc()...
 * const fetchUserCb = asyncCb()...
 * const fetchUserCbCancel = asyncCancelableCb()...
 *
 * const invokable1 = toInvokable(fib, 0);
 * const invokable2 = toInvokable(fetchUser, 0);
 * const invokable3 = toInvokable(fetchUserCb, 0);
 * const invokable4 = toInvokable(fetchUserCbCancel, 0);
 * ```
 */
export function toInvokable<
  I extends FuncInput,
  O extends FuncOutput,
  D extends FuncDeclaration,
  Type extends FuncTypes,
  Args extends [] | [unknown, ...unknown[]],
>(
  func: FuncExported<I, O, D, Type>,
  input: z.infer<I>,
): Invokable<O, Args> {
  return function (context, handler, ...args: Args) {
    return invoke(func, context, input, handler, ...args);
  };
}
type TupleOfOutputsFromInvokables<I> = I extends [infer R, ...infer Rest]
  ? [R extends Invokable<infer O extends FuncOutput, any> ? O : never, ...TupleOfOutputsFromInvokables<Rest>]
  : [];
type zSchemaTupleInvokables<I extends [] | [unknown, ...unknown[]]> = z.ZodTuple<TupleOfOutputsFromInvokables<I>>;

/**
 * Merge multiple invokables into a single invokable. Kind of like `Promise.all`.
 *
 * ```ts
 * const fib = syncFunc()...
 * const fetchUser = asyncFunc()...
 * const fetchUserCb = asyncCb()...
 * const fetchUserCbCancel = asyncCancelableCb()...
 *
 * const invokable = _mergeInvokable([
 *   toInvokable(fib, 0),
 *   toInvokable(fetchUser, 0),
 *   toInvokable(fetchUserCb, 0),
 *   toInvokable(fetchUserCbCancel, 0),
 * ]);
 * ```
 */
export function _mergeInvokable<I extends [] | [unknown, ...unknown[]]>(invokables: I): Invokable<zSchemaTupleInvokables<I>, []> {
  return function (context, handler) {
    const output: z.infer<zSchemaTupleInvokables<I>> = new Array(invokables.length) as any;
    const bools: boolean[] = new Array(invokables.length).fill(false);
    const onComplete: InvokeCbHandler<z.ZodAny, [number]> = function (r, i) {
      bools[i] = true;
      if (r.t === "Error") {
        handler(r);
      } else {
        output[i] = r;
        if (bools.every((b) => b)) {
          handler({ t: "Data", d: output });
        }
      }
    };
    const cancels: InvokeCbReturn[] = [];
    for (let i = 0; i < invokables.length; i++) {
      const c = (invokables[i] as any)(context, onComplete, i);
      cancels.push(c);
    }
    return function () {
      for (const c of cancels) {
        c();
      }
    };
  };
}

export function _invokeAsCb<O extends FuncOutput>(
  context: Context,
  invokable: Invokable<O, []>,
  handler: InvokeCbHandler<O, []>,
): InvokeCbReturn {
  return invokable(context, handler);
}

export function _invokeAsPromise<O extends FuncOutput>(context: Context, invokable: Invokable<O, []>): Promise<z.infer<O>> {
  return new Promise((res, rej) => {
    invokable(context, (r) => {
      if (r.t === "Error") rej(r.e);
      else res(r.d);
    });
  });
}

/**
 * Merge multiple invokables into a single invokable. Kind of like `Promise.all`.
 *
 * ```ts
 * const fib = syncFunc()...
 * const fetchUser = asyncFunc()...
 * const fetchUserCb = asyncCb()...
 * const fetchUserCbCancel = asyncCancelableCb()...
 *
 * const invokable = mergeInvokableAsCb(context, [
 *   toInvokable(fib, 0),
 *   toInvokable(fetchUser, 0),
 *   toInvokable(fetchUserCb, 0),
 *   toInvokable(fetchUserCbCancel, 0),
 * ], (results) => {
 *   console.log(results);
 * });
 * ```
 */
export function mergeInvokableAsCb<I extends [] | [unknown, ...unknown[]]>(
  context: Context,
  invokables: I,
  handler: InvokeCbHandler<zSchemaTupleInvokables<I>, []>,
): InvokeCbReturn {
  return _invokeAsCb(context, _mergeInvokable(invokables), handler);
}

/**
 * Merge multiple invokables into a single invokable. Kind of like `Promise.all`.
 *
 * ```ts
 * const fib = syncFunc()...
 * const fetchUser = asyncFunc()...
 * const fetchUserCb = asyncCb()...
 * const fetchUserCbCancel = asyncCancelableCb()...
 *
 * const invokable = await mergeInvokableAsPromise(context, [
 *   toInvokable(fib, 0),
 *   toInvokable(fetchUser, 0),
 *   toInvokable(fetchUserCb, 0),
 *   toInvokable(fetchUserCbCancel, 0),
 * ]);
 * ```
 */
export function mergeInvokableAsPromise<I extends [] | [unknown, ...unknown[]]>(
  context: Context,
  invokables: I,
): Promise<z.infer<zSchemaTupleInvokables<I>>> {
  return _invokeAsPromise(context, _mergeInvokable(invokables));
}
