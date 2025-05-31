/**
 * Function builder
 * @module
 */
import { z } from "zod/v4";
import { Context } from "./context.ts";

export const unimplementedFunc = (() => {
  throw new Error("Unimplemented");
}) as never;
export const unimplementedFuncSchema = z.never();

/** Default Func Input Schema */
export type zFuncInput = z.ZodType;
/** Default Func Output Schema */
export type zFuncOutput = z.ZodType;
/** Default Func Return Type */
export type zFuncReturn<O extends zFuncOutput, Async extends boolean> = Async extends true ? Promise<z.infer<O>> : z.infer<O>;

/** Base Func Wrapper */
export abstract class FuncWrapper<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>, Async extends boolean> {
  abstract implementation(
    context: Context<Func<I, O, D, Async>>,
    input: z.infer<I>,
    invokeStack: FuncInvokeStack<I, O, D, Async>,
  ): zFuncReturn<O, Async>;
  optimize(_: Func<I, O, D, Async>) {}
}

/** Base Func Invoke Stack */
export class FuncInvokeStack<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>, Async extends boolean> {
  protected wrappers: FuncWrapper<I, O, D, Async>[];
  protected implementation: (context: Context<Func<I, O, D, Async>>, input: z.infer<I>) => zFuncReturn<O, Async>;
  constructor(
    wrappers: FuncWrapper<I, O, D, Async>[],
    implementation: (context: Context<Func<I, O, D, Async>>, input: z.infer<I>) => zFuncReturn<O, Async>,
  ) {
    this.wrappers = wrappers;
    this.implementation = implementation;
    Object.freeze(this.wrappers);
  }
  $(context: Context<Func<I, O, D, Async>>, input: z.infer<I>): zFuncReturn<O, Async> {
    if (this.wrappers.length) {
      return this.wrappers[0].implementation(context, input, new FuncInvokeStack(this.wrappers.slice(1), this.implementation));
    } else {
      return this.implementation(context, input);
    }
  }
}

/**
 * Base Func Node [Is one of node used in Context.node]
 */
export class Func<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>, Async extends boolean>
  extends FuncInvokeStack<I, O, D, Async> {
  readonly isAsync: Async;
  readonly input: I;
  readonly output: O;
  readonly declaration: D;
  readonly ref: { namespace: string; name: string };
  constructor(
    isAsync: Async,
    input: I,
    output: O,
    declaration: D,
    wrappers: FuncWrapper<I, O, D, Async>[],
    implementation: (context: Context<Func<I, O, D, Async>>, input: z.infer<I>) => zFuncReturn<O, Async>,
    ref: { namespace: string; name: string },
  ) {
    super(wrappers, implementation);
    this.isAsync = isAsync;
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
  create(): ((context: Context, input: z.infer<I>) => zFuncReturn<O, Async>) & { node: Func<I, O, D, Async> } {
    Object.freeze(this);
    let build: (context: Context, input: z.infer<I>) => zFuncReturn<O, Async>;
    if (this.isAsync) {
      build = async (context: Context, input: z.infer<I>): Promise<zFuncReturn<O, Async>> => {
        const childContext = new Context(context, this.refString(), this);
        try {
          return await this.$(childContext, input);
        } finally {
          Context.dispose(childContext);
        }
      };
    } else {
      build = (context: Context, input: z.infer<I>): zFuncReturn<O, Async> => {
        const childContext = new Context(context, this.refString(), this);
        try {
          return this.$(childContext, input);
        } finally {
          Context.dispose(childContext);
        }
      };
    }
    return Object.assign(build, { node: this });
  }
}
/**
 * Base Func Builder, Use this to build a Func Node
 */
export class FuncBuilder<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>, Async extends boolean> {
  protected isAsync: Async;
  protected input: I;
  protected output: O;
  protected wrappers: FuncWrapper<I, O, D, Async>[];
  protected declaration: D;
  protected implementation: (context: Context<Func<I, O, D, Async>>, input: z.infer<I>) => zFuncReturn<O, Async>;
  protected ref: { namespace: string; name: string };
  constructor(
    isAsync: Async,
    input: I,
    output: O,
    declaration: D,
    wrappers: FuncWrapper<I, O, D, Async>[],
    implementation: (
      context: Context<Func<I, O, D, Async>>,
      input: z.infer<I>,
    ) => zFuncReturn<O, Async>,
    ref: { namespace: string; name: string },
  ) {
    this.isAsync = isAsync;
    this.ref = ref;
    this.input = input;
    this.output = output;
    this.declaration = declaration;
    this.wrappers = wrappers;
    this.implementation = implementation;
  }
  $input<I extends zFuncInput>(input: I): FuncBuilder<I, O, D, Async> {
    if (this.wrappers.length) {
      throw new Error("Cannot set schema after setting wrappers!");
    }
    if (this.implementation !== unimplementedFunc) {
      throw new Error("Cannot set schema after setting implementation!");
    }
    this.input = input as any;
    return this as never;
  }
  $output<O extends zFuncOutput>(output: O): FuncBuilder<I, O, D, Async> {
    if (this.wrappers.length) {
      throw new Error("Cannot set schema after setting wrappers!");
    }
    if (this.implementation !== unimplementedFunc) {
      throw new Error("Cannot set schema after setting implementation!");
    }
    this.output = output as any;
    return this as never;
  }
  $wrap(wrap: FuncWrapper<I, O, D, Async>): FuncBuilder<I, O, D, Async> {
    if (this.implementation !== unimplementedFunc) {
      throw new Error("Cannot set wrapper after setting implementation!");
    }
    this.wrappers.push(wrap);
    return this;
  }
  $declare<$D extends Record<any, any>>(dec: $D): FuncBuilder<I, O, $D & D, Async> {
    if (this.implementation !== unimplementedFunc) {
      throw new Error("Cannot set schema after setting implementation!");
    }
    Object.assign(this.declaration, dec);
    return this;
  }
  $ref(ref: { namespace: string; name: string }): FuncBuilder<I, O, D, Async> {
    this.ref = ref;
    return this;
  }
  $(
    implementation: (context: Context<Func<I, O, D, Async>>, input: z.infer<I>) => zFuncReturn<O, Async>,
  ): ((context: Context, input: z.infer<I>) => zFuncReturn<O, Async>) & { node: Func<I, O, D, Async> } {
    if ((this.input as z.ZodType) === unimplementedFuncSchema) {
      throw new Error("Unimplemented Input Schema!");
    }
    if ((this.output as z.ZodType) === unimplementedFuncSchema) {
      throw new Error("Unimplemented Output Schema!");
    }
    if (this.implementation === unimplementedFunc) {
      throw new Error("Unimplemented implementation function!");
    }
    return new Func(this.isAsync, this.input, this.output, this.declaration, this.wrappers, implementation, this.ref).create();
  }
}

/**
 * Base Func Builder for synchronous functions
 * ```ts
 * const fib = syncFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.number().int().positive())
 *   .$declare({ cache: {} as Record<number, number> })
 *   .$((context, input) => {
 *     if (input < 3) return 1;
 *     return context.node.declaration.cache[input] ??= fib(context, input - 1) + fib(context, input - 2);
 *   });
 * const context = new Context(null, "No Reason", null);
 * const fib10 = fib(context, 10);
 * console.log(fib10);
 * ```
 */
export function syncFc(): FuncBuilder<z.ZodNever, z.ZodNever, Record<never, never>, false> {
  return new FuncBuilder(false, unimplementedFuncSchema, unimplementedFuncSchema, {}, [], unimplementedFunc, {
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
 *   .$wrap(new FuncSafeParse({output: false}))
 *   .$wrap(new FuncMemoized())
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
export function asyncFc(): FuncBuilder<z.ZodNever, z.ZodNever, Record<never, never>, true> {
  return new FuncBuilder(true, unimplementedFuncSchema, unimplementedFuncSchema, {}, [], unimplementedFunc, {
    namespace: "Unknown",
    name: "Unknown",
  });
}
