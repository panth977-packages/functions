export class AsyncCbSender<OT> {
  protected cancels?: VoidFunction[] = [];
  protected handler?: AsyncCbReceiver<OT> = new AsyncCbReceiver(this);
  protected wasCanceled?: boolean;
  getHandler(): AsyncCbReceiver<OT> {
    if (this.handler === undefined) throw new Error("Handler was removed, possibly because the sender was closed!");
    return this.handler;
  }
  protected close(): void {
    delete this.handler;
    delete this.cancels;
  }
  static cancel<OT>(callback: AsyncCbSender<OT>): void {
    callback.wasCanceled = true;
    if (callback.cancels === undefined) return;
    const { cancels } = callback;
    callback.close();
    for (const cb of cancels) {
      cb();
    }
  }
  return(data: OT): void {
    if (this.handler === undefined) return;
    const { handler } = this;
    this.close();
    AsyncCbReceiver.resolve(handler, data);
  }
  throw(error: unknown): void {
    if (this.handler === undefined) return;
    const { handler } = this;
    this.close();
    AsyncCbReceiver.reject(handler, error);
  }
  set onCancel(cb: VoidFunction | null) {
    if (this.wasCanceled) {
      cb?.();
      this.return;
    }
    if (this.cancels === undefined) return;
    if (cb === null) {
      this.cancels = [];
    } else {
      this.cancels = [cb];
    }
  }
  on(event: "cancel", cb: VoidFunction): void {
    if (this.wasCanceled) {
      cb();
      this.return;
    }
    if (event !== "cancel") throw new Error("Unknown Event found");
    if (this.cancels === undefined) return;
    this.cancels.push(cb);
  }
  off(event: "cancel", cb: VoidFunction): void {
    if (event !== "cancel") throw new Error("Unknown Event found");
    if (this.cancels === undefined) return;
    const index = this.cancels.indexOf(cb);
    if (index === -1) return;
    this.cancels.splice(index, 1);
  }
}
export class AsyncCbReceiver<OT> {
  // 0 => pending
  // 1 => done
  // 2 => error
  // 3 => canceled
  protected result: [0] | [1, OT] | [2, unknown] | [3] = [0];
  protected callback?: AsyncCbSender<OT>;
  protected thens?: ((data: OT) => void)[] = [];
  protected catches?: ((error: unknown) => void)[] = [];
  protected finales?: (() => void)[] = [];
  constructor(callback?: AsyncCbSender<OT>) {
    this.callback = callback;
  }
  protected close(): void {
    delete this.callback;
    delete this.thens;
    delete this.catches;
  }
  static resolve<OT>(handler: AsyncCbReceiver<OT>, data: OT): void {
    if (handler.thens === undefined) return;
    handler.result = [1, data];
    const { thens, finales } = handler;
    handler.close();
    try {
      for (const cb of thens) {
        cb(data);
      }
    } finally {
      if (finales !== undefined) {
        for (const cb of finales) {
          cb();
        }
      }
    }
  }
  static reject<OT>(handler: AsyncCbReceiver<OT>, error: unknown): void {
    if (handler.catches === undefined) return;
    handler.result = [2, error];
    const { catches, finales } = handler;
    handler.close();
    try {
      for (const cb of catches) {
        cb(error);
      }
    } finally {
      if (finales !== undefined) {
        for (const cb of finales) {
          cb();
        }
      }
    }
  }
  then(cb: (data: OT) => void): this {
    if (this.thens === undefined) {
      if (this.result[0] === 1) {
        cb(this.result[1]);
      }
      return this;
    }
    this.thens.push(cb);
    return this;
  }
  catch(cb: (error: unknown) => void): this {
    if (this.catches === undefined) {
      if (this.result[0] === 2) {
        cb(this.result[1]);
      }
      return this;
    }
    this.catches.push(cb);
    return this;
  }
  finally(cb: () => void): this {
    if (this.finales === undefined) {
      if (this.result[0] !== 0) {
        cb();
      }
      return this;
    }
    this.finales.push(cb);
    return this;
  }
  cancel(): void {
    if (this.callback === undefined) return;
    this.result = [3];
    const { callback, finales } = this;
    this.close();
    try {
      AsyncCbSender.cancel(callback);
    } finally {
      if (finales !== undefined) {
        for (const cb of finales) {
          cb();
        }
      }
    }
  }

  private static _pipeThen<OT, NT>(cb: (data: OT) => NT, port: AsyncCbSender<NT>, data: OT): void {
    let result;
    try {
      result = cb(data);
    } catch (err) {
      port.throw(err);
      return;
    }
    port.return(result);
  }
  pipeThen<NT>(cb: (data: OT) => NT): AsyncCbReceiver<NT> {
    const port = new AsyncCbSender<NT>();
    this.then((AsyncCbReceiver._pipeThen as (cb: (data: OT) => NT, port: AsyncCbSender<NT>, data: OT) => void).bind(AsyncCbReceiver, cb, port));
    this.catch(port.throw.bind(port));
    return port.getHandler();
  }
  private static _pipeCatch<OT, NT>(cb: (error: unknown) => NT, port: AsyncCbSender<NT | OT>, error: unknown): void {
    let result;
    try {
      result = cb(error);
    } catch (err) {
      port.throw(err);
      return;
    }
    port.return(result);
  }
  pipeCatch<NT>(cb: (error: unknown) => NT): AsyncCbReceiver<NT | OT> {
    const port = new AsyncCbSender<NT | OT>();
    this.then(port.return.bind(port));
    this.catch(
      (AsyncCbReceiver._pipeCatch as (cb: (error: unknown) => NT, port: AsyncCbSender<NT | OT>, error: unknown) => void).bind(
        AsyncCbReceiver,
        cb,
        port,
      ),
    );
    return port.getHandler();
  }
  private static _pipe<OT, NT>(pipe: (data: OT) => AsyncCbReceiver<NT>, port: AsyncCbSender<NT>, data: OT): void {
    let process;
    try {
      process = pipe(data);
    } catch (err) {
      port.throw(err);
      return;
    }
    process.then(port.return.bind(port));
    process.catch(port.throw.bind(port));
  }
  pipe<NT>(pipe: (data: OT) => AsyncCbReceiver<NT>): AsyncCbReceiver<NT> {
    const port = new AsyncCbSender<NT>();
    this.then(
      (AsyncCbReceiver._pipe as (pipe: (data: OT) => AsyncCbReceiver<NT>, port: AsyncCbSender<NT>, data: OT) => void).bind(
        AsyncCbReceiver,
        pipe,
        port,
      ),
    );
    this.catch(port.throw.bind(port));
    return port.getHandler();
  }
  static value<T>(value: T): AsyncCbReceiver<T> {
    const handler = new AsyncCbReceiver<T>();
    AsyncCbReceiver.resolve(handler, value);
    return handler;
  }
  static error<T>(error: unknown): AsyncCbReceiver<T> {
    const handler = new AsyncCbReceiver<T>();
    AsyncCbReceiver.reject(handler, error);
    return handler;
  }
  private static _all<T>(len: number) {
    let result: any = new Array(len);
    let completed: number = 0;
    const completedAt = len * (len + 1) / 2;
    const handler = new AsyncCbReceiver<T>();
    function resolve(i: number, value: any) {
      if (completed == -1) return;
      completed += i;
      result[i] = value;
      if (completed >= completedAt) {
        AsyncCbReceiver.resolve(handler, result);
        result = null;
      }
    }
    function reject(error: unknown) {
      if (completed == -1) return;
      completed = -1;
      AsyncCbReceiver.reject(handler, error);
      result = null;
    }
    return [handler, resolve, reject] as const;
  }
  /**
   * ```ts
   * AsyncCbReceiver.all([
   *   Promise.resolve(0).toAsyncCb(),
   *   Promise.resolve("1").toAsyncCb(),
   *   AsyncCbReceiver.value({ t: 3 }).pipeThen((x) => x.t).pipeCatch(() => 0).pipe((x) => AsyncCbReceiver.value(`${x}`)),
   * ]);
   * ```
   */
  static all<T extends readonly AsyncCbReceiver<any>[] | []>(data: T): AsyncCbReceiver<{ -readonly [P in keyof T]: AwaitedCb<T[P]> }> {
    const [handler, resolve, reject] = this._all<{ -readonly [P in keyof T]: AwaitedCb<T[P]> }>(data.length);
    for (let i = 0; i < data.length; i++) {
      data[i].then(resolve.bind(null, i));
      data[i].catch(reject);
    }
    return handler;
  }
  static fromPromise<T>(promise: Promise<T>): AsyncCbReceiver<T> {
    const handler = new AsyncCbReceiver<T>();
    promise
      .then((AsyncCbReceiver.resolve as ((handler: AsyncCbReceiver<T>, data: T) => void)).bind(AsyncCbReceiver, handler))
      .catch((AsyncCbReceiver.reject as ((handler: AsyncCbReceiver<T>, error: unknown) => void)).bind(AsyncCbReceiver, handler));
    return handler;
  }
  promisified(): Promise<OT> {
    return new Promise((resolve, reject) => {
      this.then(resolve).catch(reject);
    });
  }
}
export type AwaitedCb<T> = T extends AsyncCbReceiver<infer R> ? R : never;

// declare global {
//   interface Promise<T> {
//     toAsyncCb(): AsyncCbReceiver<T>;
//   }
// }

// Promise.prototype.toAsyncCb = function (this) {
//   return AsyncCbReceiver.fromPromise(this);
// };
