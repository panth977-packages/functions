export class SubsCbSender<OT> {
  protected cancels?: VoidFunction[] = [];
  protected handler?: SubsCbReceiver<OT> = new SubsCbReceiver();
  protected wasCanceled?: boolean;
  getHandler(): SubsCbReceiver<OT> {
    if (this.handler === undefined) throw new Error("Handler was removed, possibly because the sender was closed!");
    return this.handler;
  }
  private close(): void {
    delete this.handler;
    delete this.cancels;
  }
  static cancel<OT>(callback: SubsCbSender<OT>) {
    callback.wasCanceled = true;
    if (callback.cancels === undefined) return;
    const { cancels } = callback;
    callback.close();
    for (const cb of cancels) {
      cb();
    }
  }
  yield(data: OT): void {
    if (this.handler === undefined) return;
    SubsCbReceiver.emit(this.handler, data);
  }
  throw(error: unknown): void {
    if (this.handler === undefined) return;
    const { handler } = this;
    this.close();
    SubsCbReceiver.reject(handler, error);
  }
  end(): void {
    if (this.handler === undefined) return;
    const { handler } = this;
    this.close();
    SubsCbReceiver.end(handler);
  }
  set onCancel(cb: VoidFunction | null) {
    if (this.wasCanceled === true) {
      cb?.();
      return;
    }
    if (this.cancels === undefined) return;
    if (cb === null) {
      this.cancels = [];
    } else {
      this.cancels = [cb];
    }
  }
  on(event: "cancel", cb: VoidFunction): void {
    if (this.wasCanceled === true) {
      cb();
      return;
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
export class SubsCbReceiver<OT> {
  // 0 => emitting
  // 1 => done
  // 2 => error
  // 3 => canceled
  protected result: [0] | [1] | [2, unknown] | [3] = [0];
  protected emitHistory?: OT[] = [];
  protected callback?: SubsCbSender<OT>;
  protected listeners?: ((data: OT) => void)[] = [];
  protected ends?: (() => void)[] = [];
  protected catches?: ((error: unknown) => void)[] = [];
  protected finales?: (() => void)[] = [];
  protected close(): void {
    delete this.callback;
    delete this.listeners;
    delete this.ends;
    delete this.catches;
    delete this.emitHistory;
    delete this.finales;
  }
  static emit<OT>(handler: SubsCbReceiver<OT>, data: OT): void {
    if (handler.emitHistory !== undefined) {
      handler.emitHistory.push(data);
    } else if (handler.listeners !== undefined) {
      for (const cb of handler.listeners) {
        cb(data);
      }
    }
  }
  static reject<OT>(handler: SubsCbReceiver<OT>, error: unknown): void {
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
  static end<OT>(handler: SubsCbReceiver<OT>): void {
    if (handler.ends === undefined) return;
    handler.result = [1];
    const { ends, finales } = handler;
    handler.close();
    try {
      for (const cb of ends) {
        cb();
      }
    } finally {
      if (finales !== undefined) {
        for (const cb of finales) {
          cb();
        }
      }
    }
  }
  static value<T>(value: T): SubsCbReceiver<T> {
    const handler = new SubsCbReceiver<T>();
    SubsCbReceiver.emit(handler, value);
    SubsCbReceiver.end(handler);
    return handler;
  }
  static error<T>(error: unknown): SubsCbReceiver<T> {
    const handler = new SubsCbReceiver<T>();
    SubsCbReceiver.reject(handler, error);
    return handler;
  }
  static finished<T>(): SubsCbReceiver<T> {
    const handler = new SubsCbReceiver<T>();
    SubsCbReceiver.end(handler);
    return handler;
  }
  listen(listener: (data: OT) => void) {
    if (this.result[0] !== 0) return;
    if (this.listeners === undefined) return;
    this.listeners.push(listener);
  }
  startFlush(): this {
    if (this.emitHistory === undefined || this.listeners === undefined) return this;
    for (const data of this.emitHistory) {
      for (const cb of this.listeners) {
        cb(data);
      }
    }
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
  onEnd(cb: () => void): this {
    if (this.ends === undefined) {
      if (this.result[0] === 1) {
        cb();
      }
      return this;
    }
    this.ends.push(cb);
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
      SubsCbSender.cancel(callback);
    } finally {
      if (finales !== undefined) {
        for (const cb of finales) {
          cb();
        }
      }
    }
  }
  static _pipeEmit<OT, RT>(port: SubsCbSender<RT>, cb: (data: OT) => RT, onError: undefined | ((error: unknown) => void), data: OT): void {
    try {
      port.yield(cb(data));
    } catch (error) {
      onError?.(error);
    }
  }
  pipeEmit<RT>(cb: (data: OT) => RT, onError?: (error: unknown) => void): SubsCbReceiver<RT> {
    const port = new SubsCbSender<RT>();
    this.catch(port.throw.bind(port));
    this.onEnd(port.end.bind(port));
    this.listen(
      (SubsCbReceiver._pipeEmit as (port: SubsCbSender<RT>, cb: (data: OT) => RT, onError: undefined | ((error: unknown) => void), data: OT) => void)
        .bind(SubsCbReceiver, port, cb, onError),
    );
    this.startFlush();
    return port.getHandler();
  }
}
