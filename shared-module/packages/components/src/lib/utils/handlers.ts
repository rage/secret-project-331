type CancellableEvent = {
  defaultPrevented?: boolean
  isDefaultPrevented?: () => boolean
}

function isEventCancelled(event: unknown): boolean {
  if (!event || typeof event !== "object") {
    return false
  }

  const cancellableEvent = event as CancellableEvent

  return Boolean(
    cancellableEvent.defaultPrevented ||
    (typeof cancellableEvent.isDefaultPrevented === "function" &&
      cancellableEvent.isDefaultPrevented()),
  )
}

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
    if (isEventCancelled(event)) {
      return
    }
    b(event)
  }
}
