export type Context = {
  id: string;
  log(...args: unknown[]): void;
  onDispose: (exe: () => void) => void;
  dispose: () => Promise<void>;
  getStack(): string | undefined;
};

export type BuildContext<C extends Context> = (context: Context | string | null) => C;

type OnCreateInitFn = (context: Context) => void;
type Logger = (context: Omit<Context, "log">, args: unknown[]) => void;
type OnDisposeExe = (context: Omit<Context, "onDispose" | "dispose">) => void;
const onCreateInitFn = new Set<OnCreateInitFn>();
const loggers = new Set<Logger>();
const onDisposeExes = new Set<OnDisposeExe>();

export const DefaultBuildContextOptions: {
  onCreate(initFn: OnCreateInitFn): () => void;
  onLog(logger: Logger): () => void;
  onDisposeExe(onDisposeExe: OnDisposeExe): () => void;
} = {
  onCreate(initFn) {
    onCreateInitFn.add(initFn);
    return function () {
      onCreateInitFn.delete(initFn);
    };
  },
  onLog(logger) {
    loggers.add(logger);
    return function () {
      loggers.delete(logger);
    };
  },
  onDisposeExe(onDisposeExe) {
    onDisposeExes.add(onDisposeExe);
    return function () {
      onDisposeExes.delete(onDisposeExe);
    };
  },
};

export const DefaultBuildContext: BuildContext<Context> = function (_context) {
  _context ??= crypto.randomUUID();
  if (typeof _context !== "string") {
    return Object.assign({}, _context);
  }
  const dispose: Parameters<Context["onDispose"]>[0][] = [];
  const context: Context = {
    id: _context,
    async log(...args) {
      await Promise.allSettled([...[...loggers].map((fn) => fn(this, args))]);
    },
    onDispose(exe) {
      dispose.push(exe);
    },
    async dispose() {
      await Promise.allSettled([
        ...dispose.map((exe) => exe()),
        ...[...onDisposeExes].map((exe) => exe(this)),
      ]);
    },
    getStack() {
      return new Error().stack?.substring(5);
    },
  };
  Promise.allSettled([...[...onCreateInitFn].map((fn) => fn(context))]);
  return context;
};
