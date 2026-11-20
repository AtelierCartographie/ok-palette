/**
 * Lets Node load the TypeScript sources of `src/` directly: they import their
 * modules without extension ("./utils"), so ".ts" is added on resolution.
 * Import this module before importing anything from `src/`.
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        // fall back to the default resolution
      }
    }
    return nextResolve(specifier, context);
  },
});
