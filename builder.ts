import type { z } from "zod/v4";
import type { Context, Func, FuncImplementation, FuncInput, FuncOutput } from "./exports.ts";
import { T } from "@panth977/tools";

function _AsyncLike_<I extends FuncInput, O extends FuncOutput>(
  implementation: (context: Context<Func<I, O, "AsyncFunc">>, input: z.infer<I>) => z.infer<O> | PromiseLike<z.infer<O>>,
  context: Context<Func<I, O, "AsyncFunc">>,
  input: z.infer<I>,
): T.PPromise<z.infer<O>> {
  try {
    return T.PPromise.resolve(implementation(context, input));
  } catch (err) {
    return T.PPromise.reject(err);
  }
}

/**
 * @example
 * ```ts
 * const fetchUser = asyncFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({name: z.string(), age: z.number().int().positive(), ...}))
 *   .$wrap(new WFParser())
 *   .$wrap(new WFMemo())
 *   .$(AsyncLike(async (context, input) => {
 *     const query = `SELECT name, age FROM users WHERE id = $1`;
 *     const result = await pg.query(query, [input]);
 *     if (!result.rowCount) throw HttpError.NotFound('User not found!');
 *     return result.rows[0];
 *   }));
 * ```
 */
export function AsyncLike<I extends FuncInput, O extends FuncOutput>(
  implementation: (context: Context<Func<I, O, "AsyncFunc">>, input: z.infer<I>) => z.infer<O> | PromiseLike<z.infer<O>>,
): FuncImplementation<I, O, "AsyncFunc"> {
  return (_AsyncLike_<I, O>).bind(null, implementation);
}

function _AsyncWithPort_<I extends FuncInput, O extends FuncOutput>(
  implementation: (
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
    port: T.PPromisePort<z.infer<O>>,
    promise: T.PPromise<z.infer<O>>,
  ) => any,
  context: Context<Func<I, O, "AsyncFunc">>,
  input: z.infer<I>,
): T.PPromise<z.infer<O>> {
  const [port, promise] = T.$async<z.infer<O>>(true);
  try {
    implementation(context, input, port, promise);
  } catch (err) {
    port.throw(err);
  }
  return promise;
}

/**
 * @example
 * ```ts
 * const fetchUser = asyncFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({ name: z.string(), age: z.number().int().positive() }))
 *   .$wrap(new WFParser())
 *   .$wrap(new WFMemo())
 *   .$(AsyncWithPort((context, input, port) => {
 *     const query = `SELECT name, age FROM users WHERE id = $1`;
 *     const process = pg.query(query, [input], (err, result) => {
 *       if (err) {
 *         port.throw(err);
 *         return;
 *       }
 *       if (!result.rowCount) {
 *         port.throw(HttpError.NotFound("User not found!"));
 *         return;
 *       }
 *       port.return(result.rows[0]);
 *     });
 *     port.oncancel(pg.cancelJob.bind(pg, process));
 *   }));
 * ```
 */
export function AsyncWithPort<I extends FuncInput, O extends FuncOutput>(
  implementation: (
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
    port: T.PPromisePort<z.infer<O>>,
    promise: T.PPromise<z.infer<O>>,
  ) => any,
): FuncImplementation<I, O, "AsyncFunc"> {
  return (_AsyncWithPort_<I, O>).bind(null, implementation);
}

class BaseAsyncClass<I extends FuncInput, O extends FuncOutput> {
  constructor(
    readonly context: Context<Func<I, O, "AsyncFunc">>,
    public input: z.infer<I>,
    readonly port: T.PPromisePort<z.infer<O>>,
    readonly promise: T.PPromise<z.infer<O>>,
  ) {}

  $(): any {
    throw new Error("Method not implemented.");
  }
}
function _AsyncClass_<
  I extends FuncInput,
  O extends FuncOutput,
  Cls extends BaseAsyncClass<I, O>,
>(
  implementation: new (
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
    port: T.PPromisePort<z.infer<O>>,
    promise: T.PPromise<z.infer<O>>,
  ) => Cls,
  context: Context<Func<I, O, "AsyncFunc">>,
  input: z.infer<I>,
): T.PPromise<z.infer<O>> {
  const [port, promise] = T.$async<z.infer<O>>(true);
  try {
    new implementation(context, input, port, promise).$();
  } catch (err) {
    port.throw(err);
  }
  return promise;
}
/**
 * @example
 * ```ts
 * const fetchUser = asyncFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({ name: z.string(), age: z.number().int().positive() }))
 *   .$wrap(new WFParser())
 *   .$wrap(new WFMemo())
 *   .$(AsyncClass((Cls) =>
 *     class extends Cls {
 *       onData(err: unknown, result: any) {
 *         if (err) {
 *           this.port.throw(err);
 *         } else if (!result.rowCount) {
 *           this.port.throw(HttpError.NotFound("User not found!"));
 *         } else {
 *           this.port.return(result.rows[0]);
 *         }
 *       }
 *       $() {
 *         const query = `SELECT name, age FROM users WHERE id = $1`;
 *         const process = pg.query(query, [input], this.onData.bind(this));
 *         this.port.oncancel(pg.cancelJob.bind(pg, process));
 *       }
 *     }
 *   ));
 * ```
 */
export function AsyncClass<
  I extends FuncInput,
  O extends FuncOutput,
  Cls extends BaseAsyncClass<I, O>,
>(
  implementationBuilder: (
    BaseAsyncClass: new (
      context: Context<Func<I, O, "AsyncFunc">>,
      input: z.infer<I>,
      port: T.PPromisePort<z.infer<O>>,
      promise: T.PPromise<z.infer<O>>,
    ) => BaseAsyncClass<I, O>,
  ) => new (
    context: Context<Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
    port: T.PPromisePort<z.infer<O>>,
    promise: T.PPromise<z.infer<O>>,
  ) => Cls,
): FuncImplementation<I, O, "AsyncFunc"> {
  return (_AsyncClass_<I, O, Cls>).bind(null, implementationBuilder(BaseAsyncClass<I, O>));
}

class BaseStreamClass<I extends FuncInput, O extends FuncOutput> {
  constructor(
    readonly context: Context<Func<I, O, "StreamFunc">>,
    public input: z.infer<I>,
    readonly port: T.PStreamPort<z.infer<O>>,
    readonly stream: T.PStream<z.infer<O>>,
  ) {}

  $(): any {
    throw new Error("Method not implemented.");
  }
}
function _StreamClass_<
  I extends FuncInput,
  O extends FuncOutput,
  Cls extends BaseStreamClass<I, O>,
>(
  implementation: new (
    context: Context<Func<I, O, "StreamFunc">>,
    input: z.infer<I>,
    port: T.PStreamPort<z.infer<O>>,
    stream: T.PStream<z.infer<O>>,
  ) => Cls,
  context: Context<Func<I, O, "StreamFunc">>,
  input: z.infer<I>,
): T.PStream<z.infer<O>> {
  const [port, stream] = T.$stream<z.infer<O>>();
  try {
    new implementation(context, input, port, stream).$();
  } catch (err) {
    port.throw(err);
  }
  return stream;
}

/**
 * @example
 * ```ts
 * const listenUserChanges = streamFunc()
 *   .$input(z.number().int().positive())
 *   .$output(z.object({ name: z.string(), age: z.number().int().positive() }))
 *   .$wrap(new WFParser())
 *   .$(StreamClass((Cls) =>
 *     class extends Cls {
 *       onData(topic, message) {
 *         this.port.emit(JSON.parse(message.toString()));
 *       }
 *       override $() {
 *         const client = new Mqtt();
 *         client.on("message", this.onData.bind(this));
 *         client.on("error", this.port.throw.bind(this.port));
 *         client.on("error", client.end.bind(client));
 *         client.on("close", client.end.bind(client));
 *         client.connect();
 *         client.subscribe(`/changes/user/${this.input}`);
 *       }
 *     }
 *   ));
 * ```
 */
export function StreamClass<
  I extends FuncInput,
  O extends FuncOutput,
  Cls extends BaseStreamClass<I, O>,
>(
  implementationBuilder: (
    BaseStreamClass: new (
      context: Context<Func<I, O, "StreamFunc">>,
      input: z.infer<I>,
      port: T.PStreamPort<z.infer<O>>,
      stream: T.PStream<z.infer<O>>,
    ) => BaseStreamClass<I, O>,
  ) => new (
    context: Context<Func<I, O, "StreamFunc">>,
    input: z.infer<I>,
    port: T.PStreamPort<z.infer<O>>,
    stream: T.PStream<z.infer<O>>,
  ) => Cls,
): FuncImplementation<I, O, "StreamFunc"> {
  return (_StreamClass_<I, O, Cls>).bind(null, implementationBuilder(BaseStreamClass<I, O>));
}
