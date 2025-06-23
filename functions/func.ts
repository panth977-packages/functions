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
/** Default Func Declaration */
export type FuncDeclaration = Record<any, any>;
/** Default Func Return Type */
export type FuncReturn<
  O extends FuncOutput,
  Type extends FuncTypes,
> = Type extends "SyncFunc"
  ? z.infer<O>
  : Type extends "AsyncFunc"
    ? T.PPromise<z.infer<O>>
    : Type extends "StreamFunc"
      ? T.PStream<z.infer<O>>
      : never;
export type FuncExposed<
  I extends FuncInput,
  O extends FuncOutput,
  Type extends FuncTypes,
> = (context: Context, input: z.infer<I>) => FuncReturn<O, Type>;
export type FuncImplementation<
  I extends FuncInput,
  O extends FuncOutput,
  D extends FuncDeclaration,
  Type extends FuncTypes,
> = (
  context: Context<Func<I, O, D, Type>>,
  input: z.infer<I>,
) => FuncReturn<O, Type>;
export type FuncExported<
  I extends FuncInput,
  O extends FuncOutput,
  D extends FuncDeclaration,
  Type extends FuncTypes,
> = FuncExposed<I, O, Type> & {
  node: Func<I, O, D, Type>;
  output: z.infer<O>;
  input: z.infer<I>;
};

/** Base Func Wrapper */
export abstract class FuncWrapper<
  I extends FuncInput,
  O extends FuncOutput,
  D extends FuncDeclaration,
  Type extends FuncTypes,
> {
  abstract implementation(
    invokeStack: FuncInvokeStack<I, O, D, Type>,
    context: Context,
    input: z.infer<I>,
  ): ReturnType<FuncImplementation<I, O, D, Type>>;
  protected optimize(_: Func<I, O, D, Type>) {}
  static optimize<
    I extends FuncInput,
    O extends FuncOutput,
    D extends FuncDeclaration,
    Type extends FuncTypes,
  >(func: Func<I, O, D, Type>, wrapper: FuncWrapper<I, O, D, Type>) {
    wrapper.optimize(func);
  }
}

export abstract class GenericFuncWrapper<
  I extends FuncInput,
  O extends FuncOutput,
  D extends FuncDeclaration,
  Type extends FuncTypes,
> extends FuncWrapper<I, O, D, Type> {
  protected SyncFunc?(
    invokeStack: FuncInvokeStack<I, O, D, "SyncFunc">,
    context: Context<Func<I, O, D, "SyncFunc">>,
    input: z.infer<I>,
  ): FuncReturn<O, "SyncFunc">;
  protected AsyncFunc?(
    invokeStack: FuncInvokeStack<I, O, D, "AsyncFunc">,
    context: Context<Func<I, O, D, "AsyncFunc">>,
    input: z.infer<I>,
  ): FuncReturn<O, "AsyncFunc">;
  protected StreamFunc?(
    invokeStack: FuncInvokeStack<I, O, D, "StreamFunc">,
    context: Context<Func<I, O, D, "StreamFunc">>,
    input: z.infer<I>,
  ): FuncReturn<O, "StreamFunc">;
  protected ShouldIgnore?(func: Func<I, O, D, Type>): boolean;
  private ByPassImplementation(
    invokeStack: FuncInvokeStack<I, O, D, Type>,
    context: Context,
    input: z.infer<I>,
  ): FuncReturn<O, Type> {
    return invokeStack.$(context, input);
  }
  protected override optimize(func: Func<I, O, D, Type>): void {
    if (this.ShouldIgnore?.(func) ?? false) {
      this.implementation = this.ByPassImplementation;
      return;
    }
    this.implementation = this[func.type] as (
      invokeStack: FuncInvokeStack<I, O, D, Type>,
      context: Context<Func<I, O, D, Type>>,
      input: z.infer<I>,
    ) => FuncReturn<O, Type>;
    if (!this.implementation) {
      throw new Error(`No implementation found for ${func.type}`);
    }
  }
  implementation(
    _is: FuncInvokeStack<I, O, D, Type>,
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
  D extends FuncDeclaration,
  Type extends FuncTypes,
> {
  constructor(
    protected wrappers: FuncWrapper<I, O, D, Type>[],
    protected implementation: FuncImplementation<I, O, D, Type>,
  ) {
    Object.freeze(this.wrappers);
  }
  $(
    context: Context,
    input: z.infer<I>,
  ): ReturnType<FuncImplementation<I, O, D, Type>> {
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
  D extends FuncDeclaration,
  Type extends FuncTypes,
> extends FuncInvokeStack<I, O, D, Type> {
  static getWrapperOf<
    W extends typeof ClassXYZ,
    I extends FuncInput,
    O extends FuncOutput,
    D extends FuncDeclaration,
    Type extends FuncTypes,
  >(func: Func<I, O, D, Type>, wrapperClass: W): InstanceType<W>[] {
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
    readonly declaration: D,
    wrappers: FuncWrapper<I, O, D, Type>[],
    implementation: FuncImplementation<I, O, D, Type>,
    readonly ref: { namespace: string; name: string },
  ) {
    super(wrappers, implementation);
    Object.freeze(this.declaration);
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
    D extends FuncDeclaration,
  >(func: Func<I, O, D, "SyncFunc">): FuncExposed<I, O, "SyncFunc"> {
    return (context, input) => {
      const childContext = new Context(context, func.refString(), func);
      try {
        return func.$(childContext, input);
      } finally {
        Context.dispose(childContext);
      }
    };
  }
  static buildAsyncFunc<
    I extends FuncInput,
    O extends FuncOutput,
    D extends FuncDeclaration,
  >(func: Func<I, O, D, "AsyncFunc">): FuncExposed<I, O, "AsyncFunc"> {
    return (context, input) => {
      const childContext = new Context(context, func.refString(), func);
      try {
        const promise = func.$(childContext, input);
        promise.onend(Context.dispose.bind(Context, childContext));
        return T.PPromise.from(promise);
      } catch (error) {
        Context.dispose(childContext);
        return T.PPromise.reject(error);
      }
    };
  }
  static buildStreamFunc<
    I extends FuncInput,
    O extends FuncOutput,
    D extends FuncDeclaration,
  >(func: Func<I, O, D, "StreamFunc">): FuncExposed<I, O, "StreamFunc"> {
    return (context, input) => {
      const childContext = new Context(context, func.refString(), func);
      try {
        const process = func.$(childContext, input);
        process.onend(Context.dispose.bind(Context, childContext));
        return process;
      } catch (error) {
        Context.dispose(childContext);
        return T.PStream.reject(error);
      }
    };
  }

  create(): FuncExported<I, O, D, Type> {
    Object.freeze(this);
    let build: any;
    if (this.type === "AsyncFunc") {
      build = Func.buildAsyncFunc(this as any);
    } else if (this.type === "SyncFunc") {
      build = Func.buildSyncFunc(this as any);
    } else if (this.type === "StreamFunc") {
      build = Func.buildStreamFunc(this as any);
    } else {
      throw new Error(`Unsupported function type: ${this.type}`);
    }
    return Object.assign(build, { node: this });
  }
  createPort(
    cancelable = true,
  ): Type extends "AsyncFunc"
    ? [T.PPromisePort<z.infer<O>>, T.PPromise<z.infer<O>>]
    : Type extends "StreamFunc"
      ? [T.PStreamPort<z.infer<O>>, T.PStream<z.infer<O>>]
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
export type BuilderType = FuncTypes | "AsyncLike";
export type BuilderToFuncType<T extends BuilderType> = T extends "AsyncLike"
  ? "AsyncFunc"
  : T;
export type BuilderImplementation<
  I extends FuncInput,
  O extends FuncOutput,
  D extends FuncDeclaration,
  Type extends BuilderType,
> = Type extends "AsyncLike"
  ? (
      context: Context<Func<I, O, D, BuilderToFuncType<Type>>>,
      input: z.infer<I>,
    ) => PromiseLike<z.infer<O>>
  : FuncImplementation<I, O, D, BuilderToFuncType<Type>>;
/**
 * Base Func Builder, Use this to build a Func Node
 */
export class FuncBuilder<
  I extends FuncInput,
  O extends FuncOutput,
  D extends FuncDeclaration,
  Type extends BuilderType,
> {
  constructor(
    protected type: Type,
    protected input: I,
    protected output: O,
    protected declaration: D,
    protected wrappers: FuncWrapper<I, O, D, BuilderToFuncType<Type>>[],
    protected ref: { namespace: string; name: string },
  ) {}
  $input<I extends FuncInput>(input: I): FuncBuilder<I, O, D, Type> {
    if (this.wrappers.length) {
      throw new Error("Cannot set schema after setting wrappers!");
    }
    this.input = input as any;
    return this as never;
  }
  $output<O extends FuncOutput>(output: O): FuncBuilder<I, O, D, Type> {
    if (this.wrappers.length) {
      throw new Error("Cannot set schema after setting wrappers!");
    }
    this.output = output as any;
    return this as never;
  }
  $wrap(
    wrap: FuncWrapper<I, O, D, BuilderToFuncType<Type>>,
  ): FuncBuilder<I, O, D, Type> {
    this.wrappers.push(wrap);
    return this;
  }
  $declare<$D extends FuncDeclaration>(
    dec: $D,
  ): FuncBuilder<I, O, $D & D, Type> {
    Object.assign(this.declaration, dec);
    return this;
  }
  $ref(ref: { namespace: string; name: string }): FuncBuilder<I, O, D, Type> {
    this.ref = ref;
    return this;
  }
  private static _promised<
    I extends FuncInput,
    O extends FuncOutput,
    D extends FuncDeclaration,
  >(
    implementation: (
      context: Context<Func<I, O, D, "AsyncFunc">>,
      input: z.infer<I>,
    ) => PromiseLike<z.infer<O>>,
    context: Context<Func<I, O, D, "AsyncFunc">>,
    input: z.infer<I>,
  ): T.PPromise<z.infer<O>> {
    try {
      return T.PPromise.from(implementation(context, input));
    } catch (err) {
      return T.PPromise.reject(err);
    }
  }
  protected toFuncTypes(
    implementation: BuilderImplementation<I, O, D, Type>,
  ): [
    BuilderToFuncType<Type>,
    FuncImplementation<I, O, D, BuilderToFuncType<Type>>,
  ] {
    if (this.type === "AsyncLike") {
      return [
        "AsyncFunc",
        (FuncBuilder._promised<I, O, D>).bind(
          FuncBuilder,
          implementation as never,
        ),
      ] as never;
    }
    return [this.type, implementation] as never;
  }
  $(
    implementation: BuilderImplementation<I, O, D, Type>,
  ): FuncExported<I, O, D, BuilderToFuncType<Type>> {
    if ((this.input as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Input Schema!");
    }
    if ((this.output as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Output Schema!");
    }
    const [type, funcImp] = this.toFuncTypes(implementation);
    return new Func(
      type,
      this.input,
      this.output,
      this.declaration,
      this.wrappers,
      funcImp,
      this.ref,
    ).create();
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
export function syncFunc(): FuncBuilder<
  z.ZodNever,
  z.ZodNever,
  Record<never, never>,
  "SyncFunc"
> {
  return new FuncBuilder(
    "SyncFunc",
    unimplementedSchema,
    unimplementedSchema,
    {},
    [],
    {
      namespace: "Unknown",
      name: "Unknown",
    },
  );
}

/**
 * Base Func Builder for asynchronous functions
 * @example
 * ```ts
 * const fetchUser = asyncLike()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new WFParser({output: false}))
 *   .$wrap(new WFMemo())
 *   .$(async (context, input) => {
 *     const query = `SELECT name, age FROM users WHERE id = $1`;
 *     const result = await pg.query(query, [input]);
 *     if (!result.rowCount) throw HttpError.NotFound('User not found!');
 *     return result.rows[0];
 *   });
 * const context = new Context(null, "No Reason", null);
 * const user10 = await fetchUser(context, 10);
 * console.log(user10);
 * ```
 */
export function asyncLike(): FuncBuilder<
  z.ZodNever,
  z.ZodNever,
  Record<never, never>,
  "AsyncLike"
> {
  return new FuncBuilder(
    "AsyncLike",
    unimplementedSchema,
    unimplementedSchema,
    {},
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
export function asyncFunc(): FuncBuilder<
  z.ZodNever,
  z.ZodNever,
  Record<never, never>,
  "AsyncFunc"
> {
  return new FuncBuilder(
    "AsyncFunc",
    unimplementedSchema,
    unimplementedSchema,
    {},
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
export function streamFunc(): FuncBuilder<
  z.ZodNever,
  z.ZodNever,
  Record<never, never>,
  "StreamFunc"
> {
  return new FuncBuilder(
    "StreamFunc",
    unimplementedSchema,
    unimplementedSchema,
    {},
    [],
    { namespace: "Unknown", name: "Unknown" },
  );
}
