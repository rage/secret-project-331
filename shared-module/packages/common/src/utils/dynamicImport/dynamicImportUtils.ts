import { DYNAMIC_IMPORT_MAX_ATTEMPTS } from "./dynamicImportStore"

/**
 * Detects Webpack-style chunk load errors from dynamic imports.
 */
export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error && error.name === "ChunkLoadError"

/**
 * Heuristically checks whether a value looks like a React component.
 */
export const isProbablyReactComponent = (value: unknown): boolean => {
  if (typeof value === "function") {
    return true
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "$$typeof" in (value as Record<string, unknown>)
  ) {
    return true
  }
  return false
}

/**
 * Wraps a promise with a timeout that rejects using the provided message.
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

type SleepFn = (ms: number) => Promise<void>

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * Runs an async operation with retry and exponential backoff.
 */
export const importWithRetry = async <T>(
  fn: () => Promise<T>,
  maxAttempts = DYNAMIC_IMPORT_MAX_ATTEMPTS,
  delayMs = 1_000,
  onRetry?: (attempt: number, error: unknown) => void,
  sleep: SleepFn = defaultSleep,
): Promise<T> => {
  let attempt = 0

  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxAttempts - 1) {
        throw error
      }
      if (onRetry) {
        onRetry(attempt + 1, error)
      }
      const backoff = delayMs * 2 ** attempt
      await sleep(backoff)
      attempt += 1
    }
  }
}
