/**
 * Registers diffResolveHook.mjs as a Node ESM resolver via module.register().
 * Loaded with `--import` (from NODE_OPTIONS) so the hook is active before any
 * user/tsx modules are evaluated.
 */
import { register } from "node:module"

register("./diffResolveHook.mjs", import.meta.url)
