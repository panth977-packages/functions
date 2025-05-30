/**
 * Callback builder
 * @module
 */
import { z } from "zod/v4";
import { Context } from "../exports.ts";

const unimplemented = ((_c: Context, _i: any, cb: (o: { t: "Error"; e: Error }) => void) => {
  cb({ t: "Error", e: new Error("Unimplemented") });
}) as never;
const unimplementedSchema = z.never();

/** Default Callback Input Schema */
export type zCallbackInput = z.ZodType;
/** Default Callback Output Schema */
export type zCallbackOutput = z.ZodType;
/** Default Callback Callback Schema */
export type zCallbackHandler<O extends zCallbackOutput, Multi extends boolean> = Multi extends true
  ? (response: { t: "Data"; d: z.infer<O> } | { t: "Error"; e: Error } | { t: "End" }) => void
  : (response: { t: "Data"; d: z.infer<O> } | { t: "Error"; e: Error }) => void;
export type zCallbackCancel<Cancelable extends boolean> = Cancelable extends true ? { (): void } : void;

export abstract class CallbackWrapper<
  I extends zCallbackInput,
  O extends zCallbackOutput,
  D extends Record<never, never>,
  Multi extends boolean,
  Cancelable extends boolean,
> {
  abstract implementation(
    context: Context<Callback<I, O, D, Multi, Cancelable>>,
    input: z.infer<I>,
    callback: zCallbackHandler<O, Multi>,
    invokeStack: CallbackInvokeStack<I, O, D, Multi, Cancelable>,
  ): zCallbackCancel<Cancelable>;
  optimize(_: Callback<I, O, D, Multi, Cancelable>) {}
}

export class CallbackInvokeStack<
  I extends zCallbackInput,
  O extends zCallbackOutput,
  D extends Record<never, never>,
  Multi extends boolean,
  Cancelable extends boolean,
> {
  protected wrappers: CallbackWrapper<I, O, D, Multi, Cancelable>[];
  protected implementation: (
    context: Context<Callback<I, O, D, Multi, Cancelable>>,
    input: z.infer<I>,
    callback: zCallbackHandler<O, Multi>,
  ) => zCallbackCancel<Cancelable>;
  constructor(
    wrappers: CallbackWrapper<I, O, D, Multi, Cancelable>[],
    implementation: (
      context: Context<Callback<I, O, D, Multi, Cancelable>>,
      input: z.infer<I>,
      callback: zCallbackHandler<O, Multi>,
    ) => zCallbackCancel<Cancelable>,
  ) {
    this.wrappers = wrappers;
    this.implementation = implementation;
    Object.freeze(this.wrappers);
  }
  $(context: Context<any>, input: z.infer<I>, callback: zCallbackHandler<O, Multi>): zCallbackCancel<Cancelable> {
    if (this.wrappers.length) {
      return this.wrappers[0].implementation(context, input, callback, new CallbackInvokeStack(this.wrappers.slice(1), this.implementation));
    } else {
      return this.implementation(context, input, callback);
    }
  }
}

export class Callback<
  I extends zCallbackInput,
  O extends zCallbackOutput,
  D extends Record<any, any>,
  Multi extends boolean,
  Cancelable extends boolean,
> extends CallbackInvokeStack<I, O, D, Multi, Cancelable> {
  readonly isCancelable: Cancelable;
  readonly isMulti: Multi;
  readonly input: I;
  readonly output: O;
  private declaration: D;
  private ref: { namespace: string; name: string };
  constructor(
    isCancelable: Cancelable,
    isMulti: Multi,
    input: I,
    output: O,
    declaration: D,
    wrappers: CallbackWrapper<I, O, D, Multi, Cancelable>[],
    implementation: (
      context: Context<Callback<I, O, D, Multi, Cancelable>>,
      input: z.infer<I>,
      callback: zCallbackHandler<O, Multi>,
    ) => zCallbackCancel<Cancelable>,
    ref: { namespace: string; name: string },
  ) {
    super(wrappers, implementation);
    this.isCancelable = isCancelable;
    this.isMulti = isMulti;
    this.input = input;
    this.output = output;
    this.declaration = declaration;
    this.ref = ref;
    Object.freeze(this);
    Object.freeze(this.declaration);
    for (const wrapper of wrappers) {
      wrapper.optimize(this);
    }
  }
  refString(suffix?: string): string {
    if (suffix) return `${this.ref.namespace}:${this.ref.name}:${suffix}`;
    return `${this.ref.namespace}:${this.ref.name}`;
  }
  create(): ((context: Context, input: z.infer<I>, callback: zCallbackHandler<O, Multi>) => zCallbackCancel<Cancelable>) & {
    node: Callback<I, O, D, Multi, Cancelable>;
  } {
    let build: (context: Context, input: z.infer<I>, callback: zCallbackHandler<O, Multi>) => zCallbackCancel<Cancelable>;
    if (!this.isMulti) {
      if (!this.isCancelable) {
        build = (context: Context, input: z.infer<I>, callback: zCallbackHandler<O, Multi>): zCallbackCancel<Cancelable> => {
          const childContext = new Context(context, this.refString(), this);
          return this.$(childContext, input, (r: any) => {
            callback(r);
            Context.dispose(childContext);
          });
        };
      } else {
        build = (context: Context, input: z.infer<I>, callback: zCallbackHandler<O, Multi>): zCallbackCancel<Cancelable> => {
          const childContext = new Context(context, this.refString(), this);
          const cancel = this.$(childContext, input, (r: any) => {
            callback(r);
            Context.dispose(childContext);
          }) as VoidFunction;
          return (() => {
            cancel();
            Context.dispose(childContext);
          }) as zCallbackCancel<Cancelable>;
        };
      }
    } else {
      if (!this.isCancelable) {
        build = (context: Context, input: z.infer<I>, callback: zCallbackHandler<O, Multi>): zCallbackCancel<Cancelable> => {
          const childContext = new Context(context, this.refString(), this);
          return this.$(childContext, input, (r: any) => {
            callback(r);
            if (r.t === "End") {
              Context.dispose(childContext);
            }
          });
        };
      } else {
        build = (context: Context, input: z.infer<I>, callback: zCallbackHandler<O, Multi>): zCallbackCancel<Cancelable> => {
          const childContext = new Context(context, this.refString(), this);
          const cancel = this.$(childContext, input, (r: any) => {
            callback(r);
            if (r.t === "End") {
              Context.dispose(childContext);
            }
          }) as VoidFunction;
          return (() => {
            cancel();
            Context.dispose(childContext);
          }) as zCallbackCancel<Cancelable>;
        };
      }
    }
    return Object.assign(build, { node: this });
  }
}

export class CallbackBuilder<
  I extends zCallbackInput,
  O extends zCallbackOutput,
  D extends Record<any, any>,
  Multi extends boolean,
  Cancelable extends boolean,
> {
  private isCancelable: Cancelable;
  private isMulti: Multi;
  private input: I;
  private output: O;
  private wrappers: CallbackWrapper<I, O, D, Multi, Cancelable>[];
  private declaration: D;
  private implementation: (
    context: Context<Callback<I, O, D, Multi, Cancelable>>,
    input: z.infer<I>,
    callback: zCallbackHandler<O, Multi>,
  ) => zCallbackCancel<Cancelable>;
  private ref: { namespace: string; name: string };
  constructor(
    isCancelable: Cancelable,
    isMulti: Multi,
    input: I,
    output: O,
    declaration: D,
    wrappers: CallbackWrapper<I, O, D, Multi, Cancelable>[],
    implementation: (
      context: Context<Callback<I, O, D, Multi, Cancelable>>,
      input: z.infer<I>,
      callback: zCallbackHandler<O, Multi>,
    ) => zCallbackCancel<Cancelable>,
    ref: { namespace: string; name: string },
  ) {
    this.isCancelable = isCancelable;
    this.isMulti = isMulti;
    this.ref = ref;
    this.input = input;
    this.output = output;
    this.declaration = declaration;
    this.wrappers = wrappers;
    this.implementation = implementation;
  }
  $input<I extends zCallbackInput>(input: I): CallbackBuilder<I, O, D, Multi, Cancelable> {
    if (this.wrappers.length) {
      throw new Error("Cannot set schema after setting wrappers!");
    }
    if (this.implementation !== unimplemented) {
      throw new Error("Cannot set schema after setting implementation!");
    }
    return new CallbackBuilder(this.isCancelable, this.isMulti, input, this.output, this.declaration, [], unimplemented, this.ref);
  }
  $output<O extends zCallbackOutput>(output: O): CallbackBuilder<I, O, D, Multi, Cancelable> {
    if (this.wrappers.length) {
      throw new Error("Cannot set schema after setting wrappers!");
    }
    if (this.implementation !== unimplemented) {
      throw new Error("Cannot set schema after setting implementation!");
    }
    return new CallbackBuilder(this.isCancelable, this.isMulti, this.input, output, this.declaration, [], unimplemented, this.ref);
  }
  $wrap(wrap: CallbackWrapper<I, O, D, Multi, Cancelable>): CallbackBuilder<I, O, D, Multi, Cancelable> {
    if (this.implementation !== unimplemented) {
      throw new Error("Cannot set wrapper after setting implementation!");
    }
    return new CallbackBuilder(
      this.isCancelable,
      this.isMulti,
      this.input,
      this.output,
      this.declaration,
      [...this.wrappers, wrap],
      unimplemented,
      this.ref,
    );
  }
  $declare<$D extends Record<any, any>>(dec: $D): CallbackBuilder<I, O, $D & D, Multi, Cancelable> {
    if (this.implementation !== unimplemented) {
      throw new Error("Cannot set schema after setting implementation!");
    }
    return new CallbackBuilder(
      this.isCancelable,
      this.isMulti,
      this.input,
      this.output,
      { ...dec, ...this.declaration },
      this.wrappers,
      unimplemented,
      this.ref,
    );
  }
  $ref(ref: { namespace: string; name: string }): CallbackBuilder<I, O, D, Multi, Cancelable> {
    return new CallbackBuilder(this.isCancelable, this.isMulti, this.input, this.output, this.declaration, this.wrappers, unimplemented, ref);
  }
  $(
    implementation: (
      context: Context<Callback<I, O, D, Multi, Cancelable>>,
      input: z.infer<I>,
      callback: zCallbackHandler<O, Multi>,
    ) => zCallbackCancel<Cancelable>,
  ): ((context: Context, input: z.TypeOf<I>, callback: zCallbackHandler<O, Multi>) => zCallbackCancel<Cancelable>) & {
    node: Callback<I, O, D, Multi, Cancelable>;
  } {
    if ((this.input as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Input Schema!");
    }
    if ((this.output as z.ZodType) === unimplementedSchema) {
      throw new Error("Unimplemented Output Schema!");
    }
    if (this.implementation === unimplemented) {
      throw new Error("Unimplemented implementation function!");
    }
    return new Callback(this.isCancelable, this.isMulti, this.input, this.output, this.declaration, this.wrappers, implementation, this.ref).create();
  }
}

/**
 * Base Async Callback Builder for asynchronous functions
 * ```ts
 * const fetchUser = asyncCb()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new CbSafeParse({output: false}))
 *   .$wrap(new CbMemoized())
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
export function asyncCb(): CallbackBuilder<z.ZodNever, z.ZodNever, Record<never, never>, false, false> {
  return new CallbackBuilder(false, false, unimplementedSchema, unimplementedSchema, {}, [], unimplemented, {
    namespace: "Unknown",
    name: "Unknown",
  });
}

/**
 * Base Async Cancelable Callback Builder for asynchronous functions
 * ```ts
 * const fetchUser = asyncCancelableCb()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new CbSafeParse({output: false}))
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
export function asyncCancelableCb(): CallbackBuilder<z.ZodNever, z.ZodNever, Record<never, never>, false, true> {
  return new CallbackBuilder(true, false, unimplementedSchema, unimplementedSchema, {}, [], unimplemented, {
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
 *   .$wrap(new CbSafeParse({output: false}))
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
export function subCb(): CallbackBuilder<z.ZodNever, z.ZodNever, Record<never, never>, true, false> {
  return new CallbackBuilder(false, true, unimplementedSchema, unimplementedSchema, {}, [], unimplemented, { namespace: "Unknown", name: "Unknown" });
}

/**
 * Base Multi Cancelable Callback Builder for subscriptions
 * ```ts
 * const listenUserChanges = subCb()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new CbSafeParse({output: false}))
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
export function subCancelableCb(): CallbackBuilder<z.ZodNever, z.ZodNever, Record<never, never>, true, true> {
  return new CallbackBuilder(true, true, unimplementedSchema, unimplementedSchema, {}, [], unimplemented, { namespace: "Unknown", name: "Unknown" });
}
