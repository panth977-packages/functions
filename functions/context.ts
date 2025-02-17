import { randomUUID } from "crypto";

export type ContextStateKey<T> = {
  readonly key: symbol;
  readonly _type: T;
  readonly scope: "global" | "local";
};
export type ContextState<T> = {
  get(): T;
  set(val: T | undefined): void;
  del(): void;
};
export type Context = {
  readonly id: string;
  readonly path: readonly string[];
  log(...args: unknown[]): void;
  dispose(exe: () => any): void;
  useState<T>(arg: ContextStateKey<T>): ContextState<T>;
};

export type BuildContext<C extends Context> = {
  fromParent(context: Context, ref: string): C;
  createContext(id: string | null): readonly [C, VoidFunction];
  runTask<R>(
    id: string | null,
    task: (context: C, done: VoidFunction) => R
  ): Promise<R>;
};

export class DefaultContextState<T> implements ContextState<T> {
  private state: Record<symbol, any>;
  readonly key: ContextStateKey<T>;

  static CreateKey<T>({
    label,
    scope,
  }: {
    label: string;
    scope: "global" | "local";
  }): ContextStateKey<T> {
    return { _type: {} as T, key: Symbol(label), scope };
  }

  constructor(state: Record<symbol, unknown>, key: ContextStateKey<T>) {
    this.state = state;
    this.key = key;
  }
  get(): T {
    return this.state[this.key.key];
  }
  set(val: T) {
    this.state[this.key.key] = val;
  }
  del(): void {
    delete this.state[this.key.key];
  }
}

export class DefaultContext implements Context {
  private localState: Record<symbol, unknown>;
  private globalState: Record<symbol, unknown>;
  private disposeFns: (() => any)[];
  readonly id: string;
  readonly path: readonly string[];

  private static onCreateFn = new Set<(context: Context) => any>();
  private static onLogFn = new Set<
    (context: Context, args: unknown[]) => any
  >();
  private static onDisposeFn = new Set<(context: Context) => any>();

  static onCreate(initFn: (context: Context) => any): VoidFunction {
    DefaultContext.onCreateFn.add(initFn);
    return function () {
      DefaultContext.onCreateFn.delete(initFn);
    };
  }
  static onLog(
    logger: (context: Context, args: unknown[]) => any
  ): VoidFunction {
    DefaultContext.onLogFn.add(logger);
    return function () {
      DefaultContext.onLogFn.delete(logger);
    };
  }
  static onDispose(onDisposeExe: (context: Context) => any): VoidFunction {
    DefaultContext.onDisposeFn.add(onDisposeExe);
    return function () {
      DefaultContext.onDisposeFn.delete(onDisposeExe);
    };
  }

  static Builder: BuildContext<DefaultContext> = {
    fromParent(context, ref) {
      return new DefaultContext({
        id: context.id,
        path: [...context.path, ref],
        disposeFns: context instanceof DefaultContext ? context.disposeFns : [],
        globalState:
          context instanceof DefaultContext ? context.globalState : {},
      });
    },
    createContext(id) {
      const context = new DefaultContext({ id: id });
      Promise.allSettled(
        [...DefaultContext.onCreateFn].map((exe) => exe(context))
      );
      let completed = false;
      function dispose() {
        if (completed) return;
        Promise.allSettled(context.disposeFns.map((exe) => exe())).then(() =>
          Promise.allSettled(
            [...DefaultContext.onDisposeFn].map((exe) => exe(context))
          )
        );
        completed = true;
      }
      return [context, dispose] as const;
    },
    async runTask(id, task) {
      const [context, dispose] = this.createContext(id);
      return await task(context, dispose);
    },
  };
  constructor(context: {
    globalState?: Record<symbol, unknown>;
    id?: string | null;
    path?: string[];
    disposeFns?: (() => any)[];
  }) {
    this.localState = {};
    this.globalState = context.globalState ?? {};
    this.id = context.id ?? randomUUID();
    this.path = context.path ?? [];
    this.disposeFns = context.disposeFns ?? [];
  }
  dispose(exe: () => any): void {
    this.disposeFns.push(exe);
  }
  log(...args: unknown[]): void {
    Promise.allSettled([
      ...[...DefaultContext.onLogFn].map((fn) => fn(this, args)),
    ]);
  }
  useState<T>(arg: ContextStateKey<T>): ContextState<T> {
    return new DefaultContextState(
      arg.scope === "global" ? this.globalState : this.localState,
      arg
    );
  }
}
