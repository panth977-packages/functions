/**
 * Function builder
 * @module
 */
import { z } from "zod/v4";
import { Context } from "./context.ts";
import { T } from "@panth977/tools";

export const unimplementedSchema: z.ZodNever = z.never();

/** All supported function types */
export type FuncTypes = "SyncFunc" | "AsyncFunc" | "StreamFunc";
/** Default Func Input Schema */
export type FuncInput = z.ZodType;
/** Default Func Output Schema */
export type FuncOutput = z.ZodType;
/** Default Func Return Type */
export type FuncReturn<
  O extends FuncOutput,
  Type extends FuncTypes,
> = Type extends "SyncFunc" ? z.infer<O>
  : Type extends "AsyncFunc" ? T.PPromise<z.infer<O>>
  : Type extends "StreamFunc" ? T.PStream<z.infer<O>>
  : never;
export type FuncExposed<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> = (context: Context, input: z.infer<I>) => FuncReturn<O, Type>;
export type FuncImplementation<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> = (
  context: Context<Func<I, O, Type>>,
  input: z.infer<I>,
) => FuncReturn<O, Type>;
export type FuncExported<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> = FuncExposed<I, O, Type> & {
  node: Func<I, O, Type>;
  output: z.infer<O>;
  input: z.infer<I>;
};

/** Base Func Wrapper */
export abstract class FuncWrapper<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> {
  abstract implementation(
    invokeStack: FuncInvokeStack<I, O, Type>,
    context: Context<Func<I, O, Type>>,
    input: z.infer<I>,
  ): ReturnType<FuncImplementation<I, O, Type>>;
  protected optimize(_: Func<I, O, Type>) {}
  static optimize<
    I extends FuncInput,
    O extends FuncOutput,
    Type extends FuncTypes,
  >(func: Func<I, O, Type>, wrapper: FuncWrapper<I, O, Type>) {
    wrapper.optimize(func);
  }
}

export abstract class GenericFuncWrapper<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> extends FuncWrapper<I, O, Type> {
  protected SyncFunc?(
    invokeStack: FuncInvokeStack<I, O, "SyncFunc">,
    context: Context<Func<I, O, "SyncFunc">>,
    input: z.infer<I>,
  ): FuncReturn<O, "SyncFunc">;
  protected AsyncFunc?(
    invokeStack: FuncInvokeStack<I, O, "AsyncFunc">,
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
  ): FuncReturn<O, "AsyncFunc">;
  protected StreamFunc?(
    invokeStack: FuncInvokeStack<I, O, "StreamFunc">,
    context: Context<Func<I, O, "StreamFunc">>,
    input: z.infer<I>,
  ): FuncReturn<O, "StreamFunc">;
  protected ShouldIgnore?(func: Func<I, O, Type>): boolean;
  private ByPassImplementation(
    invokeStack: FuncInvokeStack<I, O, Type>,
    context: Context,
    input: z.infer<I>,
  ): FuncReturn<O, Type> {
    return invokeStack.$(context, input);
  }
  protected override optimize(func: Func<I, O, Type>): void {
    if (this.ShouldIgnore?.(func) ?? false) {
      this.implementation = this.ByPassImplementation;
      return;
    }
    this.implementation = this[func.type] as (
      invokeStack: FuncInvokeStack<I, O, Type>,
      context: Context<Func<I, O, Type>>,
      input: z.infer<I>,
    ) => FuncReturn<O, Type>;
    if (!this.implementation) {
      throw new Error(`No implementation found for ${func.type}`);
    }
  }
  implementation(
    _is: FuncInvokeStack<I, O, Type>,
    _c: Context,
    _i: z.infer<I>,
  ): FuncReturn<O, Type> {
    throw new Error(`Not implemented`);
  }
}

/** Base Func Invoke Stack */
export class FuncInvokeStack<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> {
  constructor(
    protected wrappers: FuncWrapper<I, O, Type>[],
    protected implementation: FuncImplementation<I, O, Type>,
  ) {
    Object.freeze(this.wrappers);
  }
  $(
    context: Context,
    input: z.infer<I>,
  ): ReturnType<FuncImplementation<I, O, Type>> {
    if (this.wrappers.length) {
      return this.wrappers[0].implementation(
        new FuncInvokeStack(this.wrappers.slice(1), this.implementation),
        context,
        input,
      );
    } else {
      return this.implementation(context, input);
    }
  }
}
declare abstract class ClassXYZ {
  constructor(..._: any[]);
}
/**
 * Base Func Node [Is one of node used in Context.node]
 */
export class Func<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> extends FuncInvokeStack<I, O, Type> {
  static getWrapperOf<
    W extends typeof ClassXYZ,
    I extends FuncInput,
    O extends FuncOutput,
    Type extends FuncTypes,
  >(func: Func<I, O, Type>, wrapperClass: W): InstanceType<W>[] {
    const w: InstanceType<W>[] = [];
    for (const x of func.wrappers) {
      if (x instanceof wrapperClass) {
        w.push(x as InstanceType<W>);
      }
    }
    return w;
  }
  constructor(
    readonly type: Type,
    readonly input: I,
    readonly output: O,
    wrappers: FuncWrapper<I, O, Type>[],
    implementation: FuncImplementation<I, O, Type>,
    readonly ref: { namespace: string; name: string },
  ) {
    super(wrappers, implementation);
    for (const wrapper of wrappers) {
      FuncWrapper.optimize(this, wrapper);
    }
  }
  refString(suffix?: string): string {
    if (suffix) return `${this.ref.namespace}:${this.ref.name}:${suffix}`;
    return `${this.ref.namespace}:${this.ref.name}`;
  }

  static buildSyncFunc<
    I extends FuncInput,
    O extends FuncOutput,
  >(
    func: Func<I, O, "SyncFunc">,
    context: Context,
    input: z.infer<I>,
  ): FuncReturn<O, "SyncFunc"> {
    const childContext = new Context(context, func.refString(), func);
    try {
      return func.$(childContext, input);
    } finally {
      Context.dispose(childContext);
    }
  }
  static buildAsyncFunc<
    I extends FuncInput,
    O extends FuncOutput,
  >(
    func: Func<I, O, "AsyncFunc">,
    context: Context,
    input: z.infer<I>,
  ): FuncReturn<O, "AsyncFunc"> {
    const childContext = new Context(context, func.refString(), func);
    try {
      const promise = func.$(childContext, input);
      promise.onend(Context.dispose.bind(Context, childContext));
      return T.PPromise.from(promise);
    } catch (error) {
      Context.dispose(childContext);
      return T.PPromise.reject(error);
    }
  }
  static buildStreamFunc<
    I extends FuncInput,
    O extends FuncOutput,
  >(
    func: Func<I, O, "StreamFunc">,
    context: Context,
    input: z.infer<I>,
  ): FuncReturn<O, "StreamFunc"> {
    const childContext = new Context(context, func.refString(), func);
    try {
      const process = func.$(childContext, input);
      process.onend(Context.dispose.bind(Context, childContext));
      return process;
    } catch (error) {
      Context.dispose(childContext);
      return T.PStream.reject(error);
    }
  }

  create(): FuncExported<I, O, Type> {
    Object.freeze(this);
    let build: any;
    if (this.type === "AsyncFunc") {
      build = Func.buildAsyncFunc.bind(Func, this as any);
    } else if (this.type === "SyncFunc") {
      build = Func.buildSyncFunc.bind(Func, this as any);
    } else if (this.type === "StreamFunc") {
      build = Func.buildStreamFunc.bind(Func, this as any);
    } else {
      throw new Error(`Unsupported function type: ${this.type}`);
    }
    return Object.assign(build, { node: this });
  }
  createPort(
    cancelable = true,
  ): Type extends "AsyncFunc" ? [T.PPromisePort<z.infer<O>>, T.PPromise<z.infer<O>>]
    : Type extends "StreamFunc" ? [T.PStreamPort<z.infer<O>>, T.PStream<z.infer<O>>]
    : never {
    if (this.type === "AsyncFunc") {
      return T.$async(cancelable) as never;
    } else if (this.type === "StreamFunc") {
      return T.$stream() as never;
    } else {
      throw new Error(`Unsupported function type: ${this.type}`);
    }
  }
}
// type BuilderTypeMapping = {
//   "SyncFunc": "SyncFunc";
//   "AsyncFunc": "AsyncFunc";
//   "AsyncLike": "AsyncFunc";
//   "AsyncBuilder": "AsyncFunc";
//   "StreamFunc": "StreamFunc";
//   "AsyncStream": "StreamFunc";
//   "StreamBuilder": "StreamFunc";
// };
// export type BuilderType = keyof BuilderTypeMapping;
// export type BuilderToFuncType<T extends BuilderType> = BuilderTypeMapping[T];

// export type BuilderImplementation<
//   I extends FuncInput,
//   O extends FuncOutput,
//   Type extends BuilderType,
// > = {
//   "SyncFunc": (context: Context<Func<I, O, "SyncFunc">>, input: z.infer<I>) => z.infer<O>;
//   "AsyncFunc": (context: Context<Func<I, O, "AsyncFunc">>, input: z.infer<I>) => z.infer<O> | T.PPromise<z.infer<O>>;
//   "AsyncLike": (context: Context<Func<I, O, "AsyncFunc">>, input: z.infer<I>) => z.infer<O> | PromiseLike<z.infer<O>>;
//   "AsyncBuilder": (
//     context: Context<Func<I, O, "AsyncFunc">>,
//     input: z.infer<I>,
//     port: T.PPromisePort<z.infer<O>>,
//     promise: Promise<z.infer<O>>,
//   ) => void;
//   "StreamFunc": (context: Context<Func<I, O, "StreamFunc">>, input: z.infer<I>) => z.infer<O> | T.PStream<z.infer<O>>;
//   "AsyncStream": (
//     context: Context<Func<I, O, "StreamFunc">>,
//     input: z.infer<I>,
//   ) => z.infer<O> | PromiseLike<z.infer<O>> | PromiseLike<T.PStream<z.infer<O>>>;
//   "StreamBuilder": (
//     context: Context<Func<I, O, "StreamFunc">>,
//     input: z.infer<I>,
//     port: T.PStreamPort<z.infer<O>>,
//     stream: T.PStream<z.infer<O>>,
//   ) => void;
// }[Type];

/**
 * Base Func Builder, Use this to build a Func Node
 */
export class FuncBuilder<I extends FuncInput, O extends FuncOutput, Type extends FuncTypes> {
  constructor(
    protected type: Type,
    protected input: I,
    protected output: O,
    protected wrappers: FuncWrapper<I, O, Type>[],
    protected ref: { namespace: string; name: string },
  ) {}
  $input<I extends FuncInput>(input: I): FuncBuilder<I, O, Type> {
    if (this.wrappers.length) {
      throw new Error("Cannot set schema after setting wrappers!");
    }
    this.input = input as any;
    return this as never;
  }
  $output<O extends FuncOutput>(output: O): FuncBuilder<I, O, Type> {
    if (this.wrappers.length) {
      throw new Error("Cannot set schema after setting wrappers!");
    }
    this.output = output as any;
    return this as never;
  }
  $wrap(
    wrap: FuncWrapper<I, O, Type>,
  ): FuncBuilder<I, O, Type> {
    this.wrappers.push(wrap);
    return this;
  }
  $ref(ref: { namespace: string; name: string }): FuncBuilder<I, O, Type> {
    this.ref = ref;
    return this;
  }
  protected builder(implementation: FuncImplementation<I, O, Type>): FuncExported<I, O, Type> {
    if ((this.input as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Input Schema!");
    }
    if ((this.output as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Output Schema!");
    }
    return new Func(
      this.type,
      this.input,
      this.output,
      this.wrappers,
      implementation,
      this.ref,
    ).create();
  }
  $(implementation: FuncImplementation<I, O, Type>): FuncExported<I, O, Type> {
    return this.builder(implementation);
  }
}

/**
 * Base Func Builder for synchronous functions
 * @example
 * ```ts
 * const fib = syncFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.number().int().positive())
 *   .$wrap(new WFMemo())
 *   .$((context, input) => {
 *     if (input < 3) return 1;
 *     return fib(context, input - 1) + fib(context, input - 2);
 *   });
 * const context = new Context(null, "No Reason", null);
 * const fib10 = fib(context, 10);
 * console.log(fib10);
 * ```
 */
export function syncFunc(): FuncBuilder<z.ZodNever, z.ZodNever, "SyncFunc"> {
  return new FuncBuilder(
    "SyncFunc",
    unimplementedSchema,
    unimplementedSchema,
    [],
    {
      namespace: "Unknown",
      name: "Unknown",
    },
  );
}

/**
 * Base Async Callback Builder for asynchronous functions
 * @example
 * ```ts
 * const fetchUser = asyncFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new WFParser({output: false}))
 *   .$wrap(new WFMemo())
 *   .$((context, input) => {
 *     const [port, promise] = context.node.createPort(); // T.$async<typeof fetchUser.output>(true);
 *     const query = `SELECT name, age FROM users WHERE id = $1`;
 *     const jobId = pg.query(query, [input], (result) => {
 *       if (!result.rowCount) {
 *         port.throw(HttpError.NotFound('User not found!'));
 *       } else {
 *         port.return(result.rows[0]);
 *       }
 *     });
 *     port.onCancel = () => pg.cancel(jobId);
 *     return promise;
 *   });
 * const context = new Context(null, "No Reason", null);
 * fetchUser(context, 10).then(console.log).catch(console.error);
 * ```
 */
export function asyncFunc(): FuncBuilder<z.ZodNever, z.ZodNever, "AsyncFunc"> {
  return new FuncBuilder(
    "AsyncFunc",
    unimplementedSchema,
    unimplementedSchema,
    [],
    { namespace: "Unknown", name: "Unknown" },
  );
}

/**
 * Base Multi Callback Builder for subscriptions
 * @example
 * ```ts
 * const listenUserChanges = streamFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new WFParser({output: false}))
 *   .$((context, input) => {
 *     const port = context.node.createPort();
 *     const client = new Mqtt({...});
 *     client.on('message', (topic, message) => {
 *       port.yield(JSON.parse(message.toString()));
 *     });
 *     client.on('error', port.throw.bind(port));
 *     client.on('error', client.end.bind(client));
 *     client.on('close', client.end.bind(client));
 *     client.connect();
 *     client.subscribe(`/changes/user/${input}`);
 *     return port.getHandler();
 *   });
 * const context = new Context(null, "No Reason", null);
 * const process = listenUserChanges(context, 10);
 * process.listen(console.log).startFlush();
 * setTimeout(process.cancel.bind(process), 1000 * 3600);
 * ```
 */
export function streamFunc(): FuncBuilder<z.ZodNever, z.ZodNever, "StreamFunc"> {
  return new FuncBuilder(
    "StreamFunc",
    unimplementedSchema,
    unimplementedSchema,
    [],
    { namespace: "Unknown", name: "Unknown" },
  );
}
