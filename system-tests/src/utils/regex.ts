/** Escapes `value` for use as a literal inside a RegExp. */
export function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
