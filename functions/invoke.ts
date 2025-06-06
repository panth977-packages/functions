import type z from "zod/v4";
import {
  type FuncCbHandler,
  type FuncDeclaration,
  type FuncExported,
  type FuncInput,
  type FuncOutput,
  FunctionTypes,
  type FuncTypes,
} from "../exports.ts";
import { type Context, Func } from "./index.ts";

export type InvokableType = FunctionTypes["SyncFunc"] | FunctionTypes["AsyncFunc"] | FunctionTypes["AsyncCb"] | FunctionTypes["AsyncCancelableCb"];
export type InvokableResponse<OT> = { t: "Data"; d: OT } | { t: "Error"; e: unknown };
export type InvokableCbHandler<OT, Args extends [] | [unknown, ...unknown[]]> = (response: InvokableResponse<OT>, ...args: Args) => void;
export type InvokableCbReturn = () => void;
export type InvokableOutput<T> = T extends Invokable<infer R> ? R : never;

export function asFuncType<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, CheckType extends FuncTypes>(
  func: FuncExported<I, O, D, FuncTypes>,
  checkType: CheckType,
): FuncExported<I, O, D, CheckType> | null {
  if (typeof func === "function" && func.node instanceof Func && func.node.type === checkType) return func as any;
  return null;
}
function handlePromise<O extends FuncOutput, Args extends [] | [unknown, ...unknown[]]>(
  promise: z.infer<O> | Promise<z.infer<O>>,
  handler: InvokableCbHandler<z.infer<O>, Args>,
  ...args: Args
) {
  if (promise instanceof Promise) {
    promise.then((data) => handler({ t: "Data", d: data }, ...args), (error) => handler({ t: "Error", e: error }, ...args));
  } else {
    handler({ t: "Data", d: promise }, ...args);
  }
}
function cbHandler<O extends FuncOutput, Args extends [] | [unknown, ...unknown[]]>(
  handler: InvokableCbHandler<z.infer<O>, Args>,
  ...args: Args
): FuncCbHandler<O, FunctionTypes["AsyncCb"]> {
  return function (r) {
    handler(r, ...args);
  };
}
function fakeCancel() {}
function thenFnToMapper<OT, RT>(map: (out: OT) => RT): (out: InvokableResponse<OT>) => InvokableResponse<RT> {
  return function (r) {
    if (r.t === "Error") return r;
    return { t: "Data", d: map(r.d) };
  };
}
function catchFnToMapper<OT, RT>(map: (err: unknown) => RT): (out: InvokableResponse<OT>) => InvokableResponse<OT | RT> {
  return function (r) {
    if (r.t === "Error") return { t: "Data", d: map(r.e) };
    return r;
  };
}
export abstract class Invokable<OT> {
  asPro(context: Context): Promise<OT> {
    return new Promise((res, rej) => {
      this.asCb(context, (r) => {
        if (r.t === "Error") rej(r.e);
        else res(r.d);
      });
    });
  }
  pipe<RT>(mapper: (out: InvokableResponse<OT>) => InvokableResponse<RT>): PipeInvokable<OT, RT, this> {
    return new PipeInvokable(this, mapper);
  }
  then<RT>(map: (out: OT) => RT): PipeInvokable<OT, RT, this> {
    return new PipeInvokable(this, thenFnToMapper(map));
  }
  catch<RT>(map: (err: unknown) => RT): PipeInvokable<OT, OT | RT, this> {
    return new PipeInvokable(this, catchFnToMapper(map));
  }
  abstract asCb<Args extends [] | [unknown, ...unknown[]]>(
    context: Context,
    handler: InvokableCbHandler<OT, Args>,
    ...args: Args
  ): InvokableCbReturn;

  /**
   * Merge multiple invokables into a single invokable. Kind of like `Promise.all`.
   *
   * @example
   * ```ts
   * const fib = syncFunc()...
   * const fetchUser = asyncFunc()...
   * const fetchUserCb = asyncCb()...
   * const fetchUserCbCancel = asyncCancelableCb()...
   *
   * const invokable = Invokable.all([
   *   toInvokable(fib, 0),
   *   toInvokable(fetchUser, 0),
   *   toInvokable(fetchUserCb, 0),
   *   toInvokable(fetchUserCbCancel, 0),
   * ]);
   * ```
   */
  static all<T extends readonly unknown[] | []>(invokables: T): MergedInvokable<T> {
    return new MergedInvokable(invokables);
  }
}
export class FuncInvokable<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends InvokableType>
  extends Invokable<z.infer<O>> {
  readonly func: FuncExported<I, O, D, Type>;
  readonly input: z.infer<I>;
  constructor(func: FuncExported<I, O, D, Type>, input: z.infer<I>) {
    super();
    this.func = func;
    this.input = input;
  }
  asCb<Args extends [] | [unknown, ...unknown[]]>(context: Context, handler: InvokableCbHandler<z.infer<O>, Args>, ...args: Args): InvokableCbReturn {
    const func = this.func;
    const input = this.input;
    const syncFunc = asFuncType(func, FunctionTypes.SyncFunc);
    if (syncFunc) {
      try {
        handler({ t: "Data", d: syncFunc(context, input) }, ...args);
      } catch (e) {
        handler({ t: "Error", e }, ...args);
      }
      return fakeCancel;
    }
    const asyncFunc = asFuncType(func, FunctionTypes.AsyncFunc);
    if (asyncFunc) {
      try {
        handlePromise(asyncFunc(context, input), handler, ...args);
      } catch (e) {
        handler({ t: "Error", e }, ...args);
      }
      return fakeCancel;
    }
    const asyncCb = asFuncType(func, FunctionTypes.AsyncCb);
    if (asyncCb) {
      asyncCb(context, input, cbHandler(handler, ...args));
      return fakeCancel;
    }
    const asyncCancelableCb = asFuncType(func, FunctionTypes.AsyncCancelableCb);
    if (asyncCancelableCb) {
      return asyncCancelableCb(context, input, cbHandler(handler, ...args));
    }
    handler({ t: "Error", e: new Error("Unsupported function type") }, ...args);
    return fakeCancel;
  }
}
export class PipeInvokable<OT, RT, I extends Invokable<OT>> extends Invokable<RT> {
  readonly invokable: I;
  readonly mapper: (out: InvokableResponse<OT>) => InvokableResponse<RT>;
  constructor(invokable: I, mapper: (out: InvokableResponse<OT>) => InvokableResponse<RT>) {
    super();
    this.invokable = invokable;
    this.mapper = mapper;
  }
  asCb<Args extends [] | [unknown, ...unknown[]]>(
    context: Context,
    handler: InvokableCbHandler<RT, Args>,
    ...args: Args
  ): InvokableCbReturn {
    return this.invokable.asCb(context, (r, ...args) => {
      try {
        handler(this.mapper(r), ...args);
      } catch (e) {
        handler({ t: "Error", e }, ...args);
      }
    }, ...args);
  }
}
export class MergedInvokable<T extends readonly unknown[] | []> extends Invokable<{ -readonly [P in keyof T]: InvokableOutput<T[P]> }> {
  readonly invokables: T;
  constructor(invokables: T) {
    super();
    this.invokables = invokables;
    for (let i = 0; i < invokables.length; i++) {
      if (invokables[i] instanceof Invokable == false) {
        throw new Error("given values are not all invokable");
      }
    }
  }
  override asCb<Args extends [] | [unknown, ...unknown[]]>(
    context: Context,
    handler: InvokableCbHandler<{ -readonly [P in keyof T]: InvokableOutput<T[P]> }, Args>,
    ...args: Args
  ): InvokableCbReturn {
    const output: { -readonly [P in keyof T]: InvokableOutput<T[P]> } = new Array(this.invokables.length) as any;
    const finished: boolean[] = new Array(this.invokables.length).fill(false);
    const cancels: InvokableCbReturn[] = new Array(this.invokables.length);
    function onComplete(r: InvokableResponse<any>, i: number) {
      finished[i] = true;
      if (r.t === "Error") {
        handler(r, ...args);
      } else {
        (output as any)[i] = r.d;
        if (finished.every((b) => b)) {
          handler({ t: "Data", d: output }, ...args);
        }
      }
    }
    for (let i = 0; i < this.invokables.length; i++) {
      const c = (this.invokables[i] as Invokable<any>).asCb(context, onComplete, i);
      cancels.push(c);
    }
    return function () {
      for (let i = 0; i < cancels.length; i++) {
        if (!finished[i]) {
          cancels[i]();
        }
      }
    };
  }
}

/**
 * bind your api with a input.
 * @example
 * ```ts
 * const fib = syncFunc()...
 * const fetchUser = asyncFunc()...
 * const fetchUserCb = asyncCb()...
 * const fetchUserCbCancel = asyncCancelableCb()...
 *
 * const invokable1 = toInvokable(fib, 0)
 *   .pipe((r) => r.t === 'Error' ? ({t: 'Data', d: 0}) : r)
 *   .asPro(context); // syncFunc once converted to Invokable, becomes async.
 * const invokable2 = toInvokable(fetchUser, 0)
 *   .asCb(context, (r) => {}); // gose to callback world
 * const invokable3 = toInvokable(fetchUserCb, 0)
 *   .asPro(context) // gose to Promise world
 *   .then((x) => {});  // => event que. This gose to event que
 * const invokable4 = toInvokable(fetchUserCbCancel, 0)
 *   .then((x) => x.name) // !=> event que. This dont go to event que
 *   .catch(() => '<Unknown>')  // !=> event que
 *   .asCb(context, (r) => {}); // Get the value without ever going to event que.
 * ```
 */
export function toInvokable<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends InvokableType>(
  func: FuncExported<I, O, D, Type>,
  input: z.infer<I>,
): FuncInvokable<I, O, D, Type> {
  return new FuncInvokable(func, input);
}
