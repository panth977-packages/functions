/**
 * Context & Node & State
 * @module
 */

export class ContextState<T = unknown> {
  readonly label: string;
  readonly scope: "internal" | "cascade" | "tree";
  readonly mode: "create&read" | "read&write";
  constructor(
    label: string,
    scope: "internal" | "cascade" | "tree",
    mode: "create&read" | "read&write",
  ) {
    this.label = label;
    this.scope = scope;
    this.mode = mode;
  }
  /**
   * This can be used with in the function tree (ie, passing data from wrappers).
   * @param label - The label of the state.
   * @returns A new internal state.
   */
  static Internal<T>(
    label: string,
    mode: "create&read" | "read&write",
  ): ContextState<T> {
    return new ContextState<T>(label, "internal", mode);
  }
  /**
   * This can be used with in the function tree & sub-function trees (ie, passing data to children).
   * @param label - The label of the state.
   * @returns A new cascade state.
   */
  static Cascade<T>(
    label: string,
    mode: "create&read" | "read&write",
  ): ContextState<T> {
    return new ContextState<T>(label, "cascade", mode);
  }

  /**
   * This can be used with in the callstack tree (ie, passing data to parent).
   * @param label - The label of the state.
   * @returns A new tree state.
   */
  static Tree<T>(
    label: string,
    mode: "create&read" | "read&write",
  ): ContextState<T> {
    return new ContextState<T>(label, "tree", mode);
  }
  get _type(): T {
    throw new Error("Just a Type Hint");
  }
  toString(): string {
    return `ContextState<${this.label}>`;
  }

  /**
   * Get the value of a state.
   * @param context - The context to get the value of.
   * @returns The value of the state.
   */
  of(context: Context): T | undefined {
    return Context.getState<T>(context, this as unknown as ContextState<T>);
  }

  /**
   * Set the value of a state.
   * @param context - The context to set the value of.
   * @param value - The value to set the state to.
   */
  set(context: Context, value: T) {
    Context.setState(context, this as unknown as ContextState<T>, value);
  }
}

export class Context<N = any> {
  readonly node: N;
  private readonly parent: Context | null;
  private readonly internalState: Map<ContextState, unknown>;
  private readonly cascadeState: Map<ContextState, unknown>;
  private readonly treeState: Map<ContextState, unknown>;
  readonly id: string;
  readonly path: string;

  static getStackTree(context: Context): string[] {
    const tree: string[] = [];
    let current: Context | null = context;
    while (current) {
      tree.push(current.path);
      current = current.parent;
    }
    return tree.reverse();
  }

  constructor(c: Context | string, path: string, node: N) {
    this.path = path;
    this.node = node;
    this.internalState = new Map();
    this.cascadeState = new Map();
    if (c instanceof Context) {
      const context = c;
      this.parent = context.parent;
      this.treeState = context.treeState;
      this.id = context.id;
    } else {
      this.parent = null;
      this.treeState = new Map();
      this.id = c;
    }
    this.init();
  }

  /**
   * Get the value of a state.
   * @param state - The state to get the value of.
   * @returns The value of the state.
   */
  static getState<T>(context: Context, state: ContextState<T>): T | undefined {
    if (state.scope === "internal") {
      return context.internalState.get(state) as T | undefined;
    } else if (state.scope === "cascade") {
      let current: Context | null = context;
      while (current) {
        if (current.cascadeState.has(state)) {
          return current.cascadeState.get(state) as T;
        }
        current = current.parent;
      }
      return undefined;
    } else {
      return context.treeState.get(state) as T | undefined;
    }
  }

  /**
   * Get all the values of a state.
   * @param context - The context to get the values of.
   * @param state - The state to get the values of.
   * @returns The values of the state.
   */
  static getAllStates<T>(context: Context, state: ContextState<T>): T[] {
    if (state.scope === "internal") {
      if (context.internalState.has(state)) {
        return [context.internalState.get(state) as T];
      } else {
        return [];
      }
    } else if (state.scope === "cascade") {
      let current: Context | null = context;
      const states: T[] = [];
      while (current) {
        if (current.cascadeState.has(state)) {
          states.push(current.cascadeState.get(state) as T);
        }
        current = current.parent;
      }
      return states;
    } else {
      if (context.treeState.has(state)) {
        return [context.treeState.get(state) as T];
      } else {
        return [];
      }
    }
  }

  /**
   * Set the value of a state.
   * @param state - The state to set the value of.
   * @param value - The value to set the state to.
   */
  static setState<T>(context: Context, state: ContextState<T>, value: T) {
    if (state.mode === "create&read") {
      let current: Context | null = context;
      let hasState = false;
      while (current) {
        if (current.cascadeState.has(state)) {
          hasState = true;
          break;
        }
        current = current.parent;
      }
      if (hasState) throw new Error("Cannot set a readonly state");
    }
    if (state.scope === "internal") {
      context.internalState.set(state, value);
    } else if (state.scope === "cascade") {
      context.cascadeState.set(state, value);
    } else {
      context.treeState.set(state, value);
    }
  }

  private static runHooks<K extends keyof typeof hooks>(
    context: Context,
    event: K,
    arg: $HooksArg<K>,
  ) {
    const state = hooks[event];
    if (!state) throw new Error(`Invalid event: ${event}`);
    type TState = ContextState<Array<THooksFn<any[]>>>;
    const allCbs = Context.getAllStates(context, state as TState);
    for (const cbs of allCbs) {
      for (const cb of cbs) {
        try {
          cb(context, ...arg);
        } catch (error) {
          console.error(error);
        }
      }
    }
  }

  /**
   * Dispose of a context.
   * @param context - The context to dispose of.
   */
  static dispose(context: Context) {
    context.dispose();
  }

  /**
   * Add a hook to a context.
   * event:
   * - `tInit`: Called when any node context in whole tree is initialized.
   * - `cInit`: Called when any node context in the branch is initialized.
   * - `iLogMsg`: Called when a message is logged from the context.
   * - `cLogMsg`: Called when a message is logged from the branch context.
   * - `iLogError`: Called when an error is logged from the context.
   * - `cLogError`: Called when an error is logged from the branch context.
   * - `iLogDebug`: Called when a debug message is logged from the context.
   * - `cLogDebug`: Called when a debug message is logged from the branch context.
   * - `iDispose`: Called when the context is disposed.
   * - `tDispose`: Called when the tree is disposed.
   * @param event - The event to add the hook to.
   * @param fn - The function to add the hook to.
   * @returns The context.
   */
  on<K extends keyof typeof hooks>(event: K, fn: $HooksFn<K>): this {
    const state = hooks[event];
    if (!state) throw new Error(`Invalid event: ${event}`);
    type TState = ContextState<Array<THooksFn<any[]>>>;
    type TCb = THooksFn<any[]>;
    const cbs = Context.getState(this, state as TState);
    if (cbs) {
      cbs.push(fn as TCb);
    } else {
      Context.setState(this, state as TState, [fn as TCb]);
    }
    return this;
  }
  off<K extends keyof typeof hooks>(event: K, fn: $HooksFn<K>): this {
    const state = hooks[event];
    if (!state) throw new Error(`Invalid event: ${event}`);
    type TState = ContextState<Array<THooksFn<any[]>>>;
    type TCb = THooksFn<any[]>;
    const cbs = Context.getState(this, state as TState);
    if (cbs) {
      const index = cbs.indexOf(fn as TCb);
      if (index !== -1) {
        cbs.splice(index, 1);
      }
    }
    return this;
  }
  private init() {
    Context.runHooks(this, "tInit", []);
    Context.runHooks(this, "cInit", []);
  }
  logMsg(label: string, message: string) {
    Context.runHooks(this, "cLogMsg", [label, message]);
    Context.runHooks(this, "iLogMsg", [label, message]);
  }
  logError(label: string, error: unknown) {
    Context.runHooks(this, "cLogError", [label, error]);
    Context.runHooks(this, "iLogError", [label, error]);
  }
  logDebug(label: string, data: unknown) {
    Context.runHooks(this, "cLogDebug", [label, data]);
    Context.runHooks(this, "iLogDebug", [label, data]);
  }
  private dispose() {
    Context.runHooks(this, "iDispose", []);
    if (!this.parent) {
      Context.runHooks(this, "tDispose", []);
    }
  }
}

type THooksFn<Arg extends any[]> = (context: Context, ...args: Arg) => void;
function HooksState<Arg extends any[]>(
  type: string,
  scope: "internal" | "tree" | "cascade",
): ContextState<Array<THooksFn<Arg>>> {
  if (scope === "internal") {
    return ContextState.Internal(type, "create&read");
  } else if (scope === "tree") {
    return ContextState.Tree(type, "create&read");
  } else if (scope === "cascade") {
    return ContextState.Cascade(type, "create&read");
  } else {
    throw new Error(`Invalid scope: ${scope}`);
  }
}
type $HooksFn<K extends keyof typeof hooks> =
  (typeof hooks)[K] extends ContextState<Array<infer X>> ? X : never;
type $HooksArg<K extends keyof typeof hooks> =
  (typeof hooks)[K] extends ContextState<
    Array<(context: Context, ...args: infer X) => void>
  >
    ? X
    : never;

export const hooks: {
  tInit: ContextState<THooksFn<[]>[]>;
  cInit: ContextState<THooksFn<[]>[]>;
  iLogMsg: ContextState<THooksFn<[string, string]>[]>;
  cLogMsg: ContextState<THooksFn<[string, string]>[]>;
  iLogError: ContextState<THooksFn<[string, unknown]>[]>;
  cLogError: ContextState<THooksFn<[string, unknown]>[]>;
  iLogDebug: ContextState<THooksFn<[string, unknown]>[]>;
  cLogDebug: ContextState<THooksFn<[string, unknown]>[]>;
  iDispose: ContextState<THooksFn<[]>[]>;
  tDispose: ContextState<THooksFn<[]>[]>;
} = Object.freeze({
  tInit: HooksState<[]>("T_INIT", "tree"),
  cInit: HooksState<[]>("C_INIT", "cascade"),
  iLogMsg: HooksState<[string, string]>("I_LOG_MSG", "internal"),
  cLogMsg: HooksState<[string, string]>("C_LOG_MSG", "cascade"),
  iLogError: HooksState<[string, unknown]>("I_LOG_ERROR", "internal"),
  cLogError: HooksState<[string, unknown]>("C_LOG_ERROR", "cascade"),
  iLogDebug: HooksState<[string, unknown]>("I_LOG_DEBUG", "internal"),
  cLogDebug: HooksState<[string, unknown]>("C_LOG_DEBUG", "cascade"),
  iDispose: HooksState<[]>("I_DISPOSE", "internal"),
  tDispose: HooksState<[]>("T_DISPOSE", "tree"),
});
