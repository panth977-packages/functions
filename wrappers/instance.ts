const instance = Symbol();
export function is(w: any, type: any): boolean {
  return typeof w === "function" && instance in w && w[instance] === type;
}
export function assign<W>(w: any, type: W) {
  if (instance in w) throw new Error("Already assigned [instance]");
  Object.assign(w, { [instance]: type });
}
