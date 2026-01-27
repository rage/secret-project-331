export function assertNever(value: never): never {
  throw new Error("Unhandled case: " + JSON.stringify(value))
}
