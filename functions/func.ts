/**
 * Function builder
 * @module
 */
import { z } from "zod/v4";
import { Context } from "./context.ts";

const unimplemented = (() => {
  throw new Error("Unimplemented");
}) as never;
const unimplementedSchema = z.never();

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
}

/** Base Func Invoke Stack */
export class FuncInvokeStack<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>, Async extends boolean> {
  private wrappers: FuncWrapper<I, O, D, Async>[];
  private implementation: (context: Context<Func<I, O, D, Async>>, input: z.infer<I>) => zFuncReturn<O, Async>;
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
    Object.freeze(this);
    Object.freeze(this.declaration);
  }
  refString(suffix?: string): string {
    if (suffix) return `${this.ref.namespace}:${this.ref.name}:${suffix}`;
    return `${this.ref.namespace}:${this.ref.name}`;
  }
  create(): ((context: Context, input: z.infer<I>) => zFuncReturn<O, Async>) & { node: Func<I, O, D, Async> } {
    const build = (context: Context, input: z.infer<I>): zFuncReturn<O, Async> => {
      const childContext = new Context(context, this.refString(), this);
      return this.$(childContext, input);
    };
    build.bind(this);
    return Object.assign(build, { node: this });
  }
}
/**
 * Base Func Builder, Use this to build a Func Node
 */
export class FuncBuilder<I extends zFuncInput, O extends zFuncOutput, D extends Record<any, any>, Async extends boolean> {
  private isAsync: Async;
  private input: I;
  private output: O;
  private wrappers: FuncWrapper<I, O, D, Async>[];
  private declaration: D;
  private implementation: (context: Context<Func<I, O, D, Async>>, input: z.infer<I>) => zFuncReturn<O, Async>;
  private ref: { namespace: string; name: string };
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
    if (this.implementation !== unimplemented) {
      throw new Error("Cannot set schema after setting implementation!");
    }
    return new FuncBuilder(this.isAsync, input, this.output, this.declaration, [], unimplemented, this.ref);
  }
  $output<O extends zFuncOutput>(output: O): FuncBuilder<I, O, D, Async> {
    if (this.wrappers.length) {
      throw new Error("Cannot set schema after setting wrappers!");
    }
    if (this.implementation !== unimplemented) {
      throw new Error("Cannot set schema after setting implementation!");
    }
    return new FuncBuilder(this.isAsync, this.input, output, this.declaration, [], unimplemented, this.ref);
  }
  $wrap(
    wrap: FuncWrapper<I, O, D, Async>,
    updateType?: (wrap: FuncWrapper<I, O, D, Async>) => FuncWrapper<I, O, D, Async>,
  ): FuncBuilder<I, O, D, Async> {
    if (this.implementation !== unimplemented) {
      throw new Error("Cannot set wrapper after setting implementation!");
    }
    if (updateType) {
      wrap = updateType(wrap);
    }
    return new FuncBuilder(this.isAsync, this.input, this.output, this.declaration, [...this.wrappers, wrap], unimplemented, this.ref);
  }
  $declare<$D extends Record<any, any>>(dec: $D): FuncBuilder<I, O, $D & D, Async> {
    if (this.implementation !== unimplemented) {
      throw new Error("Cannot set schema after setting implementation!");
    }
    return new FuncBuilder(this.isAsync, this.input, this.output, { ...dec, ...this.declaration }, this.wrappers, unimplemented, this.ref);
  }
  $ref(ref: { namespace: string; name: string }): FuncBuilder<I, O, D, Async> {
    return new FuncBuilder(this.isAsync, this.input, this.output, this.declaration, this.wrappers, unimplemented, ref);
  }
  $(
    implementation: (context: Context<Func<I, O, D, Async>>, input: z.infer<I>) => zFuncReturn<O, Async>,
  ): ((context: Context, input: z.infer<I>) => zFuncReturn<O, Async>) & { node: Func<I, O, D, Async> } {
    if ((this.input as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Input Schema!");
    }
    if ((this.output as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Output Schema!");
    }
    if (this.implementation === unimplemented) {
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
export function syncFc() {
  return new FuncBuilder(false, unimplementedSchema, unimplementedSchema, {}, [], unimplemented, { namespace: "Unknown", name: "Unknown" });
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
export function asyncFc() {
  return new FuncBuilder(true, unimplementedSchema, unimplementedSchema, {}, [], unimplemented, { namespace: "Unknown", name: "Unknown" });
}
