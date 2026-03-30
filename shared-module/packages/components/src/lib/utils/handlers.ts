export function mergeHandlers<E>(
  a: ((event: E) => void) | undefined,
  b: ((event: E) => void) | undefined,
): ((event: E) => void) | undefined {
  if (!a) {
    return b
  }
  if (!b) {
    return a
  }
  return (event: E) => {
    a(event)
    b(event)
  }
}
