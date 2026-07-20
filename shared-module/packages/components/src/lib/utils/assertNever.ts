function safeInspect(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    if (typeof value === "bigint") {
      return value.toString() + "n"
    }
    return String(value)
  }
}

export function assertNever(value: never): never {
  throw new Error("Unhandled case: " + safeInspect(value))
}
