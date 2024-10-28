/**
 * These are function builder from Panth977, who has certain design principles in coding! This makes his life in coding very very easy! 🎉
 * @module
 *
 * @example
 * ```ts
 * import { FUNCTIONS } from "@panth977/functions";
 *
 * FUNCTIONS.{api}
 * ```
 */

export * as FUNCTIONS from "./exports.ts";

// mod.ts (entry point for your package)

if (typeof Deno !== "undefined") {
  // If running in Deno
  await import("https://deno.land/x/zod@v3.21.4/mod.ts");
} else {
  // If running in Node.js
  await import("npm:zod");
}
