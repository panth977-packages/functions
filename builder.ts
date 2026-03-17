import type { z } from "zod";
import type {
  Context,
  Func,
  FuncImplementation,
  FuncInput,
  FuncOutput,
} from "./exports.ts";
import { T } from "@panth977/tools";

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
  return (_StreamClass_<I, O, Cls>).bind(
    null,
    implementationBuilder(BaseStreamClass<I, O>),
  );
}
