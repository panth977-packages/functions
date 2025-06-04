/**
 * Function builder
 * @module
 */
import { z } from "zod/v4";
import { Context } from "./context.ts";

export const unimplementedSchema: z.ZodNever = z.never();

export const FunctionTypes: Readonly<{
  SyncFunc: "sync-func";
  AsyncFunc: "async-func";
  AsyncCb: "async-cb";
  AsyncCancelableCb: "async-cancelable-cb";
  SubsCb: "subs-cb";
  SubsCancelableCb: "subs-cancelable-cb";
}> = Object.freeze({
  SyncFunc: "sync-func",
  AsyncFunc: "async-func",
  AsyncCb: "async-cb",
  AsyncCancelableCb: "async-cancelable-cb",
  SubsCb: "subs-cb",
  SubsCancelableCb: "subs-cancelable-cb",
});
export type FunctionTypes = typeof FunctionTypes;
/** All supported function types */
export type FuncTypes = FunctionTypes[keyof FunctionTypes];
/** Default Func Input Schema */
export type FuncInput = z.ZodType;
/** Default Func Output Schema */
export type FuncOutput = z.ZodType;
/** Default Func Declaration */
export type FuncDeclaration = Record<any, any>;
/** Default Func Return Type */
export type FuncReturn<O extends FuncOutput, Type extends FuncTypes> = Type extends FunctionTypes["AsyncFunc"] ? Promise<z.infer<O>>
  : Type extends FunctionTypes["SyncFunc"] ? z.infer<O>
  : never;
export type FuncCbHandler<O extends FuncOutput, Type extends FuncTypes> = Type extends FunctionTypes["AsyncCb"] | FunctionTypes["AsyncCancelableCb"]
  ? (response: { t: "Data"; d: z.infer<O> } | { t: "Error"; e: unknown }) => void
  : Type extends FunctionTypes["SubsCb"] | FunctionTypes["SubsCancelableCb"]
    ? (response: { t: "Data"; d: z.infer<O> } | { t: "Error"; e: unknown } | { t: "End" }) => void
  : never;
export type FuncCbReturn<Type extends FuncTypes> = Type extends FunctionTypes["AsyncCancelableCb"] | FunctionTypes["SubsCancelableCb"] ? () => void
  : Type extends FunctionTypes["AsyncCb"] | FunctionTypes["SubsCb"] ? void
  : never;
export type FuncExposed<I extends FuncInput, O extends FuncOutput, Type extends FuncTypes> = Type extends
  FunctionTypes["SyncFunc"] | FunctionTypes["AsyncFunc"] ? (context: Context, input: z.infer<I>) => FuncReturn<O, Type>
  : Type extends FunctionTypes["AsyncCb"] | FunctionTypes["AsyncCancelableCb"] | FunctionTypes["SubsCb"] | FunctionTypes["SubsCancelableCb"]
    ? (context: Context, input: z.infer<I>, handler: FuncCbHandler<O, Type>) => FuncCbReturn<Type>
  : never;
export type FuncImplementation<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes> = Type extends
  FunctionTypes["SyncFunc"] | FunctionTypes["AsyncFunc"] ? (context: Context<Func<I, O, D, Type>>, input: z.infer<I>) => FuncReturn<O, Type>
  : Type extends FunctionTypes["AsyncCb"] | FunctionTypes["AsyncCancelableCb"] | FunctionTypes["SubsCb"] | FunctionTypes["SubsCancelableCb"]
    ? (context: Context<Func<I, O, D, Type>>, input: z.infer<I>, handler: FuncCbHandler<O, Type>) => FuncCbReturn<Type>
  : never;
export type FuncExported<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes> = FuncExposed<I, O, Type> & {
  node: Func<I, O, D, Type>;
};

/** Base Func Wrapper */
export abstract class FuncWrapper<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes> {
  abstract implementation(
    invokeStack: FuncInvokeStack<I, O, D, Type>,
    ...args: Parameters<FuncImplementation<I, O, D, Type>>
  ): ReturnType<FuncImplementation<I, O, D, Type>>;
  optimize(_: Func<I, O, D, Type>) {}
}

/** Base Func Invoke Stack */
export class FuncInvokeStack<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes> {
  protected wrappers: FuncWrapper<I, O, D, Type>[];
  protected implementation: FuncImplementation<I, O, D, Type>;
  constructor(
    wrappers: FuncWrapper<I, O, D, Type>[],
    implementation: FuncImplementation<I, O, D, Type>,
  ) {
    this.wrappers = wrappers;
    this.implementation = implementation;
    Object.freeze(this.wrappers);
  }
  $(...args: Parameters<FuncImplementation<I, O, D, Type>>): ReturnType<FuncImplementation<I, O, D, Type>> {
    if (this.wrappers.length) {
      return this.wrappers[0].implementation(new FuncInvokeStack(this.wrappers.slice(1), this.implementation), ...args);
    } else {
      return (this as any).implementation(...args);
    }
  }
}
declare abstract class ClassXYZ {
  constructor(..._: any[]);
}
/**
 * Base Func Node [Is one of node used in Context.node]
 */
export class Func<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>
  extends FuncInvokeStack<I, O, D, Type> {
  readonly type: Type;
  readonly input: I;
  readonly output: O;
  readonly declaration: D;
  readonly ref: { namespace: string; name: string };
  static getWrapperOf<W extends typeof ClassXYZ, I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes>(
    func: Func<I, O, D, Type>,
    wrapperClass: W,
  ): InstanceType<W>[] {
    const w: InstanceType<W>[] = [];
    for (const x of func.wrappers) {
      if (x instanceof (wrapperClass as any)) {
        w.push(x as InstanceType<W>);
      }
    }
    return w;
  }
  constructor(
    type: Type,
    input: I,
    output: O,
    declaration: D,
    wrappers: FuncWrapper<I, O, D, Type>[],
    implementation: FuncImplementation<I, O, D, Type>,
    ref: { namespace: string; name: string },
  ) {
    super(wrappers, implementation);
    this.type = type;
    this.input = input;
    this.output = output;
    this.declaration = declaration;
    this.ref = ref;
    Object.freeze(this.declaration);
    for (const wrapper of wrappers) {
      wrapper.optimize(this);
    }
  }
  refString(suffix?: string): string {
    if (suffix) return `${this.ref.namespace}:${this.ref.name}:${suffix}`;
    return `${this.ref.namespace}:${this.ref.name}`;
  }
  create(): FuncExported<I, O, D, Type> {
    Object.freeze(this);
    let build: any;
    if (this.type === FunctionTypes.AsyncFunc) {
      build = async (context: Context, input: z.infer<I>) => {
        const childContext = new Context(context, this.refString(), this);
        try {
          return await (this as any).$(childContext, input);
        } finally {
          Context.dispose(childContext);
        }
      };
    } else if (this.type === FunctionTypes.SyncFunc) {
      build = (context: Context, input: z.infer<I>) => {
        const childContext = new Context(context, this.refString(), this);
        try {
          return (this as any).$(childContext, input);
        } finally {
          Context.dispose(childContext);
        }
      };
    } else if (this.type === FunctionTypes.AsyncCb) {
      build = (context: Context, input: z.infer<I>, callback: FuncCbHandler<O, Type>) => {
        const childContext = new Context(context, this.refString(), this);
        return (this as any).$(childContext, input, (r: any) => {
          callback(r);
          Context.dispose(childContext);
        });
      };
    } else if (this.type === FunctionTypes.AsyncCancelableCb) {
      build = (context: Context, input: z.infer<I>, callback: FuncCbHandler<O, Type>) => {
        const childContext = new Context(context, this.refString(), this);
        const cancel = (this as any).$(childContext, input, (r: any) => {
          callback(r);
          Context.dispose(childContext);
        }) as VoidFunction;
        return () => {
          cancel();
          Context.dispose(childContext);
        };
      };
    } else if (this.type === FunctionTypes.SubsCb) {
      build = (context: Context, input: z.infer<I>, callback: FuncCbHandler<O, Type>) => {
        const childContext = new Context(context, this.refString(), this);
        return (this as any).$(childContext, input, (r: any) => {
          callback(r);
          if (r.t === "End") {
            Context.dispose(childContext);
          }
        });
      };
    } else if (this.type === FunctionTypes.SubsCancelableCb) {
      build = (context: Context, input: z.infer<I>, callback: FuncCbHandler<O, Type>) => {
        const childContext = new Context(context, this.refString(), this);
        const cancel = (this as any).$(childContext, input, (r: any) => {
          callback(r);
          if (r.t === "End") {
            Context.dispose(childContext);
          }
        }) as VoidFunction;
        return () => {
          cancel();
          Context.dispose(childContext);
        };
      };
    } else {
      throw new Error(`Unsupported function type: ${this.type}`);
    }
    return Object.assign(build, { node: this });
  }
}
/**
 * Base Func Builder, Use this to build a Func Node
 */
export class FuncBuilder<I extends FuncInput, O extends FuncOutput, D extends FuncDeclaration, Type extends FuncTypes> {
  protected type: Type;
  protected input: I;
  protected output: O;
  protected wrappers: FuncWrapper<I, O, D, Type>[];
  protected declaration: D;
  protected ref: { namespace: string; name: string };
  constructor(
    type: Type,
    input: I,
    output: O,
    declaration: D,
    wrappers: FuncWrapper<I, O, D, Type>[],
    ref: { namespace: string; name: string },
  ) {
    this.type = type;
    this.ref = ref;
    this.input = input;
    this.output = output;
    this.declaration = declaration;
    this.wrappers = wrappers;
  }
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
  $wrap(wrap: FuncWrapper<I, O, D, Type>): FuncBuilder<I, O, D, Type> {
    this.wrappers.push(wrap);
    return this;
  }
  $declare<$D extends FuncDeclaration>(dec: $D): FuncBuilder<I, O, $D & D, Type> {
    Object.assign(this.declaration, dec);
    return this;
  }
  $ref(ref: { namespace: string; name: string }): FuncBuilder<I, O, D, Type> {
    this.ref = ref;
    return this;
  }
  $(
    implementation: FuncImplementation<I, O, D, Type>,
  ): FuncExported<I, O, D, Type> {
    if ((this.input as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Input Schema!");
    }
    if ((this.output as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Output Schema!");
    }
    return new Func(this.type, this.input, this.output, this.declaration, this.wrappers, implementation, this.ref).create();
  }
}

/**
 * Base Func Builder for synchronous functions
 * ```ts
 * const fib = syncFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.number().int().positive())
 *   .$wrap(new SyncFuncMemo())
 *   .$((context, input) => {
 *     if (input < 3) return 1;
 *     return fib(context, input - 1) + fib(context, input - 2);
 *   });
 * const context = new Context(null, "No Reason", null);
 * const fib10 = fib(context, 10);
 * console.log(fib10);
 * ```
 */
export function syncFunc(): FuncBuilder<z.ZodNever, z.ZodNever, Record<never, never>, FunctionTypes["SyncFunc"]> {
  return new FuncBuilder(FunctionTypes.SyncFunc, unimplementedSchema, unimplementedSchema, {}, [], {
    namespace: "Unknown",
    name: "Unknown",
  });
}

/**
 * Base Func Builder for asynchronous functions
 * ```ts
 * const fetchUser = asyncFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new AsyncFuncParser({output: false}))
 *   .$wrap(new AsyncFuncMemo())
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
export function asyncFunc(): FuncBuilder<z.ZodNever, z.ZodNever, Record<never, never>, FunctionTypes["AsyncFunc"]> {
  return new FuncBuilder(FunctionTypes.AsyncFunc, unimplementedSchema, unimplementedSchema, {}, [], {
    namespace: "Unknown",
    name: "Unknown",
  });
}

/**
 * Base Async Callback Builder for asynchronous functions
 * ```ts
 * const fetchUser = asyncCb()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new AsyncCbParser({output: false}))
 *   .$wrap(new AsyncCbMemo())
 *   .$((context, input, callback) => {
 *     const query = `SELECT name, age FROM users WHERE id = $1`;
 *     pg.query(query, [input], (result) => {
 *       if (!result.rowCount) {
 *         callback({t: "Error", e: HttpError.NotFound('User not found!')});
 *       } else {
 *         callback({t: "Data", d: result.rows[0]});
 *       }
 *     });
 *   });
 * const context = new Context(null, "No Reason", null);
 * fetchUser(context, 10, (user) => console.log(user));
 * ```
 */
export function asyncCb(): FuncBuilder<z.ZodNever, z.ZodNever, Record<never, never>, FunctionTypes["AsyncCb"]> {
  return new FuncBuilder(FunctionTypes.AsyncCb, unimplementedSchema, unimplementedSchema, {}, [], { namespace: "Unknown", name: "Unknown" });
}

/**
 * Base Async Cancelable Callback Builder for asynchronous functions
 * ```ts
 * const fetchUser = asyncCancelableCb()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new AsyncCancelableCbParser({output: false}))
 *   .$((context, input, callback) => {
 *     const query = `SELECT name, age FROM users WHERE id = $1`;
 *     const job = pg.query(query, [input], (result) => {
 *       if (!result.rowCount) {
 *         callback({t: "Error", e: HttpError.NotFound('User not found!')});
 *       } else {
 *         callback({t: "Data", d: result.rows[0]});
 *       }
 *     });
 *     // If you have a way to cancel.
 *     return () => pg.cancel(job);
 *   });
 * const context = new Context(null, "No Reason", null);
 * const cancel = fetchUser(context, 10, (user) => console.log(user));
 * setTimeout(cancel, 1000);
 * ```
 */
export function asyncCancelableCb(): FuncBuilder<z.ZodNever, z.ZodNever, Record<never, never>, FunctionTypes["AsyncCancelableCb"]> {
  return new FuncBuilder(FunctionTypes.AsyncCancelableCb, unimplementedSchema, unimplementedSchema, {}, [], {
    namespace: "Unknown",
    name: "Unknown",
  });
}

/**
 * Base Multi Callback Builder for subscriptions
 * ```ts
 * const listenUserChanges = subCb()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new SubsCbParser({output: false}))
 *   .$((context, input, callback) => {
 *     const client = new Mqtt({...});
 *     client.on('message', (topic, message) => {
 *       callback({t: "Data", d: JSON.parse(message.toString())});
 *     });
 *     client.on('error', (error) => {
 *       callback({t: "Error", d: error});
 *     });
 *     client.on('close', () => {
 *       callback({t: "End"});
 *     });
 *     client.connect();
 *     client.subscribe(`/changes/user/${input}`);
 *   });
 * const context = new Context(null, "No Reason", null);
 * listenUserChanges(context, 10, (user) => console.log(user));
 * ```
 */
export function subsCb(): FuncBuilder<z.ZodNever, z.ZodNever, Record<never, never>, FunctionTypes["SubsCb"]> {
  return new FuncBuilder(FunctionTypes.SubsCb, unimplementedSchema, unimplementedSchema, {}, [], { namespace: "Unknown", name: "Unknown" });
}

/**
 * Base Multi Cancelable Callback Builder for subscriptions
 * ```ts
 * const listenUserChanges = subCb()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new SubsCancelableCbParser({output: false}))
 *   .$((context, input, callback) => {
 *     const client = new Mqtt({...});
 *     client.on('message', (topic, message) => {
 *       callback({t: "Data", d: JSON.parse(message.toString())});
 *     });
 *     client.on('error', (error) => {
 *       callback({t: "Error", d: error});
 *     });
 *     client.on('close', () => {
 *       callback({t: "End"});
 *     });
 *     client.connect();
 *     client.subscribe(`/changes/user/${input}`);
 *     return () => {
 *       client.end();
 *     };
 *   });
 * const context = new Context(null, "No Reason", null);
 * const cancel = listenUserChanges(context, 10, (user) => console.log(user));
 * setTimeout(() => cancel(), 5000);
 * ```
 */
export function subsCancelableCb(): FuncBuilder<z.ZodNever, z.ZodNever, Record<never, never>, FunctionTypes["SubsCancelableCb"]> {
  return new FuncBuilder(FunctionTypes.SubsCancelableCb, unimplementedSchema, unimplementedSchema, {}, [], { namespace: "Unknown", name: "Unknown" });
}
